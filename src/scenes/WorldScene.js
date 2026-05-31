import Phaser from 'phaser';
import { TILE_SIZE, PALETTE, FONT_FAMILY, TIME, COLLIDING_TILES, TILES, DOGWALK_CFG } from '../config.js';
import { CITY, BUILDING_BY_ID } from '../data/city.js';
import { KEYS } from '../data/assetManifest.js';
import { NPCS } from '../data/npcs.js';
import { DIALOGUE } from '../data/dialogue.js';
import { JOBS } from '../data/jobs.js';
import { EventBus, EVENTS } from '../eventbus.js';
import { gameState } from '../core/GameState.js';
import { rollAvailability, resolveOutcome } from '../core/LuckEngine.js';
import { searchSpot, trueValue, flipStoreOffer, pawnOffer, pawnAccepts, npcBuyerFor } from '../core/Market.js';
import { ITEMS_BY_ID } from '../data/items.js';
import { GIGS } from '../data/gigs.js';
import InputController from '../core/InputController.js';
import Player from '../entities/Player.js';
import NPC from '../entities/NPC.js';
import Atmosphere from '../core/Atmosphere.js';
import DogWalk from '../activities/DogWalk.js';
import DeliveryRun from '../activities/DeliveryRun.js';

// The overworld city. Owns: the tile map + collision, the world clock that
// advances in-game time, the player + NPCs, the smooth follow camera, and the
// interaction dispatcher that turns "face an NPC + press Space" into the right
// flow (talk, job offer, course, buy a home).
export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.gs = gameState;

    this.buildCity();
    this.createPlayer();
    this.createNPCs();
    this.setupCollision();
    this.setupCamera();
    this.setupAtmosphere();

    // The procedural dog-walking activity (the realistic job template).
    this.dogWalk = new DogWalk(this);
    this.delivery = new DeliveryRun(this);

    this.input_ = new InputController(this);
    // Stop the browser from stealing TAB (focus traversal) so the phone opens.
    this.input.keyboard.addCapture('TAB');
    this.ui = this.scene.get('UIScene');

    this.setupClock();
    this.maybeRollWeather();

    // Smooth fade-in when entering the world (criterion #9: scene transitions).
    this.cameras.main.fadeIn(450, 0, 0, 0);

    // React to day changes for weather + toasts.
    EventBus.on(EVENTS.DAY_PASSED, this.onNewDay, this);
    // Significant events (eviction, firing) shake the screen.
    this._onToast = (p) => {
      // Subtle, major-events-only (Part 0.F): just eviction/firing get a small
      // shake. Routine toasts (warnings, missed bills) no longer shake.
      if (p.key === 'evicted' || p.key === 'fired') this.cameras.main.shake(220, 0.006);
    };
    EventBus.on(EVENTS.TOAST, this._onToast, this);
    this.events.once('shutdown', () => {
      EventBus.off(EVENTS.DAY_PASSED, this.onNewDay, this);
      EventBus.off(EVENTS.TOAST, this._onToast, this);
      if (this.clockTimer) this.clockTimer.remove();
    });

    // Welcome toast.
    this.time.delayedCall(400, () =>
      EventBus.emit(EVENTS.TOAST, { text: `Welcome, ${this.gs.data.name}!`, color: PALETTE.accent })
    );

    // Dev-only debug handle (stripped from production builds) for testing:
    // teleport the player and inspect interaction targets from the console.
    if (import.meta.env && import.meta.env.DEV) {
      window.__biznux = {
        scene: this,
        teleport: (tx, ty, facing = 'down') => {
          this.player.setPosition(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2);
          this.player.facing = facing;
          this.player.setFacing(facing, false);
        },
        interact: () => this.tryInteract(),
        facingNpc: () => this.getFacingNPC()?.npcId ?? null,
      };
      window.__CITY = CITY;
    }
  }

  // --- City construction ----------------------------------------------------

  buildCity() {
    const map = this.make.tilemap({
      data: CITY.ground,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage('tiles', KEYS.TILES, TILE_SIZE, TILE_SIZE, 0, 0);
    const ground = map.createLayer(0, tileset, 0, 0);
    ground.setDepth(-1000);
    ground.setLighting?.(true);

    // Object layer holds FLAT, collidable map objects (water, building walls).
    // Tall props (trees, planters) become Y-sorted SPRITES instead, so the
    // player can pass in front of and behind them (criterion #6).
    const objects = map.createBlankLayer('objects', tileset, 0, 0);
    this.treeSprites = [];
    this.lampPositions = [];
    for (let y = 0; y < CITY.height; y++) {
      for (let x = 0; x < CITY.width; x++) {
        const idx = CITY.objects[y][x];
        if (idx === -1) continue;
        if (idx === TILES.TREE || idx === TILES.PLANTER) {
          this.spawnTallProp(idx, x, y);
        } else {
          objects.putTileAt(idx, x, y);
        }
      }
    }
    objects.setCollision(COLLIDING_TILES, true);
    objects.setDepth(0);
    objects.setLighting?.(true);

    this.map = map;
    this.objectLayer = objects;

    // Park rect (for ambient leaf particles), in world pixels.
    this.parkRect = { x: 37 * TILE_SIZE, y: 28 * TILE_SIZE, w: 11 * TILE_SIZE, h: 8 * TILE_SIZE };

    this.addBuildingLabels();
    this.buildForeground();
  }

  // A tall prop (tree/planter) as a Y-sorted static sprite with a small foot
  // collider, so depth-sorting puts the player in front when below / behind
  // when above.
  spawnTallProp(tileIdx, tx, ty) {
    const wx = tx * TILE_SIZE + TILE_SIZE / 2;
    const wy = ty * TILE_SIZE + TILE_SIZE / 2;
    const spr = this.add.sprite(wx, wy, KEYS.TILES, tileIdx);
    spr.setDepth(wy);
    spr.setLighting?.(true);
    this.physics.add.existing(spr, true);
    spr.body.setSize(10, 6);
    spr.body.setOffset(3, 10);
    this.treeSprites.push(spr);
    if (tileIdx === TILES.TREE) {
      const sh = this.add.image(wx, wy + 6, KEYS.SHADOW).setDepth(wy - 1).setScale(1.2);
      sh.setLighting?.(false);
    }
  }

  // Foreground occlusion: an awning over each building door, rendered above the
  // player so they pass BEHIND it.
  buildForeground() {
    this.foreground = [];
    CITY.buildings.forEach((b) => {
      const ax = b.door.x * TILE_SIZE + TILE_SIZE / 2;
      const ay = (b.door.y - 1) * TILE_SIZE + TILE_SIZE / 2;
      const awn = this.add.rectangle(ax, ay - 2, TILE_SIZE + 6, 5, b.color, 1).setDepth(900200);
      awn.setStrokeStyle(1, 0x000000, 0.3);
      this.foreground.push(awn);
      this.lampPositions.push({ x: ax, y: ay - 8 });
    });
  }

  // Color each building's wall block by tinting tiles, and float a name label.
  addBuildingLabels() {
    CITY.buildings.forEach((b) => {
      // Tint the wall tiles of this lot to the building's color.
      for (let y = b.rect.y; y < b.rect.y + b.rect.h; y++) {
        for (let x = b.rect.x; x < b.rect.x + b.rect.w; x++) {
          const t = this.objectLayer.getTileAt(x, y);
          if (t) t.tint = b.color;
        }
      }
      // Name label centered over the lot.
      this.add
        .text(b.center.x * TILE_SIZE, (b.rect.y) * TILE_SIZE - 4, b.label, {
          fontFamily: FONT_FAMILY,
          fontSize: '6px',
          color: '#ffffff',
          backgroundColor: '#00000088',
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5, 1)
        .setDepth(5000);
    });
  }

  createPlayer() {
    const px = CITY.spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = CITY.spawn.tileY * TILE_SIZE + TILE_SIZE / 2;
    this.player = new Player(this, px, py, this.gs.data.appearance);
  }

  createNPCs() {
    this.npcs = NPCS.map((data) => {
      const npc = new NPC(this, data).placeAtTile(data.tileX, data.tileY);
      npc.enableLighting?.();
      return npc;
    });
  }

  setupCollision() {
    this.physics.add.collider(this.player, this.objectLayer);
    this.npcs.forEach((npc) => this.physics.add.collider(this.player, npc));
    this.treeSprites.forEach((t) => this.physics.add.collider(this.player, t));
  }

  setupCamera() {
    this.physics.world.setBounds(0, 0, CITY.pixelWidth, CITY.pixelHeight);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, CITY.pixelWidth, CITY.pixelHeight);
    cam.roundPixels = true;
    // Eased follow with a small deadzone so the camera lags slightly then
    // catches up, instead of locking rigidly (animation juice, criterion #9).
    cam.startFollow(this.player, true, 0.09, 0.09);
    cam.setDeadzone(24, 18);
  }

  // Build the full graphics atmosphere (lighting, grade, particles, post-fx).
  setupAtmosphere() {
    // Streetlamps along the two main avenues.
    const lamps = [...this.lampPositions];
    const windows = [];
    CITY.buildings.forEach((b) => {
      windows.push({ x: b.center.x * TILE_SIZE, y: (b.rect.y + 1) * TILE_SIZE, color: b.color });
    });
    this.atmo = new Atmosphere(this, {
      player: this.player,
      lamps,
      windows,
      litLayers: [this.objectLayer],
    });
    this.atmo.setWeather(this.gs.data.weather);
  }

  // 0=midnight, 0.5=noon - drives the day/night system.
  dayFraction() {
    return (this.gs.hour * 60 + this.gs.minute) / (TIME.HOURS_PER_DAY * 60);
  }

  // --- World clock ----------------------------------------------------------
  // 1 real second = 1 in-game minute. We tick every real second.
  setupClock() {
    // Catch up offline time first (bounded so returning players don't lose
    // their whole bank to weeks of rent; v1 caps catch-up at 2 in-game days).
    const realPerGameMinute = TIME.REAL_SECONDS_PER_GAME_HOUR / 60; // = 1s
    this.clockTimer = this.time.addEvent({
      delay: realPerGameMinute * 1000,
      loop: true,
      callback: () => {
        if (!this.ui.isBlocking()) this.gs.advanceMinutes(1);
      },
    });
  }

  onNewDay({ day }) {
    this.maybeRollWeather();
    EventBus.emit(EVENTS.TOAST, { text: `Day ${day}. Rent & wages settled.`, color: PALETTE.text });
  }

  maybeRollWeather() {
    const roll = Phaser.Math.RND.pick(['sunny', 'sunny', 'cloudy', 'rainy', 'rainy', 'cold']);
    this.gs.setWeather(roll);
  }

  // --- Per-frame loop -------------------------------------------------------

  // WorldScene is the SINGLE keyboard owner. Based on the UI mode it either
  // drives the open dialogue/menu/phone, or drives world movement+interaction.
  update(time, delta) {
    // Drive the whole graphics atmosphere from the clock every frame.
    if (this.atmo) this.atmo.update(this.dayFraction());

    const confirm = this.input_.confirmJustPressed();
    const nav = this.input_.navJustPressed();
    const cancel = this.input_.cancelJustPressed();
    const phone = this.input_.phoneJustPressed();
    const mode = this.ui.mode;

    // Phone toggles from world or while open (it sets mode to block movement).
    if (phone && (mode === 'none' || this.ui.phoneOpen)) {
      this.ui.togglePhone();
      this.player.freeze();
      return;
    }

    if (mode === 'dialogue') {
      this.player.freeze();
      if (confirm) this.ui.advanceDialogue();
      this.updateMarkers();
      return;
    }
    if (mode === 'menu') {
      this.player.freeze();
      if (!this.ui.phoneOpen) {
        if (nav) this.ui.moveMenu(nav);
        if (confirm) this.ui.selectMenu();
        if (cancel) this.ui.cancelMenu();
      }
      this.updateMarkers();
      return;
    }

    // mode === 'none': normal gameplay.
    this.player.unfreeze();
    if (this.input_.sleepJustPressed()) this.trySleep();
    if (this.input_.backpackJustPressed()) { this.openBackpack(); return; }
    if (this.input_.searchJustPressed()) { this.trySearchSpot(); return; }

    // In-world activities (dog walk, delivery run): the player MOVES FREELY
    // (real navigation); Space/E is routed to the activity first.
    if (this.dogWalk.active) {
      if (confirm && this.dogWalk.onConfirm()) { /* handled */ }
      else if (confirm) this.tryInteract();
      this.dogWalk.update(delta);
    } else if (this.delivery.active) {
      if (confirm) this.tryInteract();
      this.delivery.update(delta);
    } else if (confirm) {
      this.tryInteract();
    }

    // Move unless an interaction opened a blocking UI this frame.
    if (this.ui.mode === 'none') {
      const axis = this.input_.axis();
      this.player.update(axis);
      // Foot dust while actually walking on the ground.
      if ((axis.x || axis.y) && this.atmo && time - (this._lastPuff || 0) > 180) {
        this._lastPuff = time;
        this.atmo.puffDust(this.player.x, this.player.y + 7);
      }
    } else {
      this.player.freeze();
    }
    this.updateMarkers();
  }

  // --- Interaction ----------------------------------------------------------

  tryInteract() {
    // Picking up a booked dog at the client's door takes priority.
    if (this.checkDogPickup()) return;
    // A scavenge spot in reach?
    if (this.getNearbySearchSpot() && this.trySearchSpot()) return;
    const npc = this.getFacingNPC();
    if (npc) { this.dispatchInteraction(npc); return; }
    // Standing at a FACADE building's door -> coming-soon notice.
    const fac = this.getFacingFacadeDoor();
    if (fac) {
      this.ui.openMenu(fac.label, ['Coming soon.', 'This place isn\'t open yet.'], [
        { label: 'OK', onSelect: () => {} },
      ]);
    }
  }

  // Building (facade, non-functional) whose door the player is standing at.
  getFacingFacadeDoor() {
    const ptx = Math.floor(this.player.x / TILE_SIZE);
    const pty = Math.floor(this.player.y / TILE_SIZE);
    return CITY.buildings.find((b) => !b.functional &&
      Math.abs(ptx - b.door.x) <= 1 && Math.abs(pty - b.door.y) <= 1) || null;
  }

  getFacingNPC() {
    const front = this.player.getFrontPoint();
    let best = null;
    let bestDist = TILE_SIZE * 1.1;
    this.npcs.forEach((npc) => {
      const d = Phaser.Math.Distance.Between(front.x, front.y, npc.x, npc.y);
      if (d < bestDist) { bestDist = d; best = npc; }
    });
    return best;
  }

  // Route an NPC's interaction to the right flow based on its role. Each flow
  // first shows the intro dialogue, then (on close) opens a menu via UIScene.
  dispatchInteraction(npc) {
    const intro = DIALOGUE[npc.dialogueKey];
    const afterIntro = () => this.openRoleMenu(npc);
    this.ui.openDialogue(intro, afterIntro);
  }

  openRoleMenu(npc) {
    switch (npc.role) {
      case 'job': this.offerJob(npc.jobId); break;
      case 'jobboard': this.openJobBoard(); break;
      case 'college': this.openCollege(); break;
      case 'realtor': this.openRealtor(); break;
      case 'flipstore': this.openFlipStore(); break;
      case 'pawnshop': this.openPawnShop(); break;
      default: break; // flavor NPCs: intro only
    }
  }

  // Job offer for a single job (cafe barista). The cafe also serves food, so
  // the player can buy a meal here to clear hunger.
  offerJob(jobId) {
    const job = JOBS[jobId];
    const current = this.gs.data.job?.id;
    const options = [];
    if (current === jobId) {
      options.push({ label: 'Start my shift', onSelect: () => this.startShift(jobId) });
    } else {
      options.push({ label: `Take the job (${job.title})`, onSelect: () => { this.gs.setJob(jobId); this.toast(`Hired as ${job.title}!`); } });
    }
    if (jobId === 'cafe') {
      options.push({
        label: 'Grab a meal  $12',
        onSelect: () => {
          if (this.gs.eat()) this.toast('You eat. Hunger cleared.', PALETTE.money);
          else this.toast('Not enough cash to eat!', PALETTE.danger);
        },
      });
    }
    options.push({ label: 'Maybe later', onSelect: () => {} });
    this.ui.openMenu(job.title, [job.blurb, `$${job.dailyWage}/day`], options);
  }

  // Gig board (the dispatcher / "gig app"). Dog-walking is the realistic
  // procedural gig; the others remain simple clock-in jobs for now (they
  // convert to procedural activities in MA.06.12.01).
  openJobBoard() {
    const rating = this.gs.data.dogRating.toFixed(1);
    const options = [
      {
        label: `Dog Walking  (rating ${rating}/5)`,
        onSelect: () => this.lookForDogWalk(),
      },
      {
        label: 'Buy poop bags  $' + 5,
        onSelect: () => {
          if (this.gs.buyBags()) this.toast(`Bought bags (have ${this.gs.data.poopBags}).`, PALETTE.money);
          else this.toast('Not enough cash!', PALETTE.danger);
        },
      },
    ];
    options.push({ label: 'Delivery Run  (find a parcel)', onSelect: () => this.lookForDelivery() });
    options.push({ label: 'Minor gigs...', onSelect: () => this.openGigBoard() });
    options.push({ label: 'Never mind', onSelect: () => {} });
    this.ui.openMenu('Gig App', [
      `Bags: ${this.gs.data.poopBags}   Dog rating: ${rating}/5`,
      'Look for work - no guarantee of a client.',
    ], options);
  }

  // Minor gigs (Part 4): lighter, quick, lower-paid odd jobs. Each is an
  // availability roll then a short resolve through the luck engine. They reuse
  // the gig rating + money squeeze without a full activity scene.
  openGigBoard() {
    const rows = GIGS.map((g) => ({
      label: `${g.title}  ~$${g.pay}`,
      onSelect: () => this.doMinorGig(g),
    }));
    rows.push({ label: 'Back', onSelect: () => {} });
    this.ui.openMenu('Minor Gigs', ['Quick, low-pay, no contract.'], rows);
  }

  doMinorGig(g) {
    // Availability: sometimes nobody needs it right now.
    const avail = rollAvailability(
      { reputation: this.gs.data.stats.reputation, gigRating: 2.5, hour: this.gs.hour, weather: this.gs.data.weather },
      { baseRate: g.baseRate ?? 0.6, baseFee: 0, feeSpread: 0, durations: [1] }
    );
    this.gs.advanceMinutes(g.minutes ?? 20);
    this.gs.changeFatigue(g.fatigue ?? 3);
    if (!avail.available) {
      this.toast(`${g.title}: no work right now.`, PALETTE.textDim);
      return;
    }
    // Outcome variance: stats tilt, luck decides.
    const statBonus = Math.min(1, (this.gs.data.stats[g.stat] || 5) / 25);
    const outcome = resolveOutcome(0.6, statBonus);
    let pay = Math.round(g.pay * (0.5 + outcome.score));
    if (g.outdoor && this.gs.data.weather === 'rainy') pay = Math.round(pay * 0.7);
    this.gs.changeCash(pay, 'gig');
    if (outcome.score > 0.55) this.gs.changeStat(g.stat, 1);
    const col = outcome.tier === 'disaster' ? PALETTE.danger : PALETTE.money;
    this.toast(`${g.title}: ${outcome.tier}. +$${pay}`, col);
  }

  // STEP 1: availability roll. Sometimes there is no client (real precarity).
  lookForDogWalk() {
    if (this.dogWalk.active || this.pendingBooking) {
      this.toast('You already have a dog to walk!', PALETTE.danger);
      return;
    }
    const ctx = {
      reputation: this.gs.data.stats.reputation,
      gigRating: this.gs.data.dogRating,
      hour: this.gs.hour,
      weather: this.gs.data.weather,
    };
    const roll = rollAvailability(ctx, DOGWALK_CFG);
    // Looking for work costs a little time either way.
    this.gs.advanceMinutes(10);

    if (!roll.available) {
      this.ui.openMenu('Gig App', [
        'No clients available right now.',
        'Try again later, or do something else.',
      ], [{ label: 'OK', onSelect: () => {} }]);
      return;
    }

    // STEP 2: a booking. Pick a client building (not your apartment).
    const candidates = CITY.buildings.filter((b) => b.id !== 'apartment');
    const client = Phaser.Utils.Array.GetRandom(candidates);
    const dogName = Phaser.Utils.Array.GetRandom(DOGWALK_CFG.dogNames);
    this.pendingBooking = {
      dogName,
      fee: roll.fee,
      durationMin: roll.durationMin,
      clientMood: roll.clientMood,
      doorX: client.door.x,
      doorY: client.door.y,
      clientLabel: client.label,
    };

    this.ui.openMenu('New Booking!', [
      `${dogName} needs a ${roll.durationMin}-min walk.`,
      `Client: ${client.label}`,
      `Pay: $${roll.fee}   Dog: ${roll.clientMood}`,
    ], [
      {
        label: 'Accept & head there',
        onSelect: () => {
          this.setObjective(client.door.x, client.door.y, `Pick up ${dogName}`);
          this.toast(`Go to ${client.label} to pick up ${dogName}.`, PALETTE.accent);
        },
      },
      { label: 'Decline', onSelect: () => { this.pendingBooking = null; } },
    ]);
  }

  // Delivery: availability roll, then a real navigation run (DeliveryRun).
  lookForDelivery() {
    if (this.dogWalk.active || this.delivery.active) { this.toast('Finish your current job first.', PALETTE.danger); return; }
    const roll = rollAvailability(
      { reputation: this.gs.data.stats.reputation, gigRating: this.gs.jobRating('delivery'), hour: this.gs.hour, weather: this.gs.data.weather },
      { baseRate: 0.55, baseFee: 40, feeSpread: 50, durations: [1] }
    );
    this.gs.advanceMinutes(8);
    if (!roll.available) {
      this.ui.openMenu('Gig App', ['No delivery jobs right now.', 'Try again later.'], [{ label: 'OK', onSelect: () => {} }]);
      return;
    }
    const lots = CITY.buildings;
    const pickup = Phaser.Utils.Array.GetRandom(lots);
    let dropoff = Phaser.Utils.Array.GetRandom(lots);
    let guard = 0;
    while (dropoff === pickup && guard++ < 10) dropoff = Phaser.Utils.Array.GetRandom(lots);
    // Time window scales with distance so far runs are fair.
    const dist = Math.hypot(pickup.door.x - dropoff.door.x, pickup.door.y - dropoff.door.y);
    const secondsAllowed = Math.round(20 + dist * 1.1);
    this.ui.openMenu('Delivery Job!', [
      `Pickup: ${pickup.label}`,
      `Drop-off: ${dropoff.label}`,
      `Pay $${roll.fee}   Window ${secondsAllowed}s (scooter boost)`,
    ], [
      { label: 'Accept the run', onSelect: () => this.delivery.begin({
        fee: roll.fee,
        pickup: { x: pickup.door.x, y: pickup.door.y },
        dropoff: { x: dropoff.door.x, y: dropoff.door.y },
        secondsAllowed,
      }) },
      { label: 'Decline', onSelect: () => {} },
    ]);
  }

  // STEP 3: pickup. Called from tryInteract when at the booking's door.
  checkDogPickup() {
    if (!this.pendingBooking || this.dogWalk.active) return false;
    const px = Math.floor(this.player.x / TILE_SIZE);
    const py = Math.floor(this.player.y / TILE_SIZE);
    const b = this.pendingBooking;
    if (Math.abs(px - b.doorX) <= 1 && Math.abs(py - b.doorY) <= 1) {
      const booking = this.pendingBooking;
      this.pendingBooking = null;
      this.clearObjective();
      this.dogWalk.begin(booking);
      return true;
    }
    return false;
  }

  // --- Objective marker (a pulsing waypoint + offscreen arrow) --------------
  setObjective(tileX, tileY, label) {
    this.clearObjective();
    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;
    const ring = this.add.circle(wx, wy, 8, PALETTE.accent, 0).setStrokeStyle(2, PALETTE.accent).setDepth(900100);
    const lbl = this.add.text(wx, wy - 14, label, {
      fontFamily: FONT_FAMILY, fontSize: '6px', color: '#ffffff',
      backgroundColor: '#000000aa', padding: { x: 2, y: 1 },
    }).setOrigin(0.5, 1).setDepth(900101);
    this.tweens.add({ targets: ring, scale: 1.6, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });
    this.objective = { ring, lbl, x: wx, y: wy };
  }

  clearObjective() {
    if (this.objective) {
      this.objective.ring.destroy();
      this.objective.lbl.destroy();
      this.objective = null;
    }
  }

  // STEP 6: result card after the walk resolves (called by DogWalk.finish).
  showWalkResult(r) {
    const stars = '*'.repeat(r.stars) + '.'.repeat(5 - r.stars);
    const trend = r.newRating >= r.oldRating ? 'up' : 'down';
    this.ui.openMenu(`${r.dogName}: ${r.tier.toUpperCase()}`, [
      `Rating: ${stars}`,
      `Fee $${r.fee}  +Tip $${r.tip}  = $${r.total}`,
      `"${r.review}"`,
      `Dog rep ${r.oldRating.toFixed(1)} -> ${r.newRating.toFixed(1)} (${trend})`,
    ], [{ label: 'Done', onSelect: () => {} }]);
  }

  offerShiftPrompt(jobId) {
    this.ui.openMenu(JOBS[jobId].title, ['Clock in now?'], [
      { label: 'Start shift', onSelect: () => this.startShift(jobId) },
      { label: 'Not yet', onSelect: () => {} },
    ]);
  }

  // Community college: buy a stat course.
  openCollege() {
    const courses = [
      { stat: 'intelligence', label: 'Logic 101 (+3 INT)', cost: 120, gain: 3 },
      { stat: 'charisma', label: 'Public Speaking (+3 CHA)', cost: 120, gain: 3 },
      { stat: 'strength', label: 'Fitness Course (+3 STR)', cost: 100, gain: 3 },
    ];
    const options = courses.map((c) => ({
      label: `${c.label}  $${c.cost}`,
      onSelect: () => {
        if (this.gs.data.cash < c.cost) { this.toast('Not enough cash!', PALETTE.danger); return; }
        this.gs.changeCash(-c.cost, 'course');
        this.gs.changeStat(c.stat, c.gain);
        this.toast(`Course complete! +${c.gain} ${c.stat.toUpperCase()}`, PALETTE.money);
      },
    }));
    options.push({ label: 'Leave', onSelect: () => {} });
    this.ui.openMenu('Community College', ['Invest in yourself.'], options);
  }

  // Realtor: buy your first home (kills rent, grants rep/confidence).
  openRealtor() {
    if (this.gs.data.ownsHome) {
      this.ui.openMenu('Realtor', ['You already own your home!'], [
        { label: 'Great', onSelect: () => {} },
      ]);
      return;
    }
    const price = 1200;
    this.ui.openMenu('Realtor', [
      'Starter Apartment',
      `Price: $${price}`,
      'No more nightly rent.',
    ], [
      {
        label: `Buy for $${price}`,
        onSelect: () => {
          if (this.gs.buyHome(price)) this.toast('You own a home! Rent is gone.', PALETTE.money);
          else this.toast('Not enough cash!', PALETTE.danger);
        },
      },
      { label: 'Keep saving', onSelect: () => {} },
    ]);
  }

  // --- Item economy: Flip Store / Pawn Shop / backpack / search (Part 3) -----

  // Flip Store: buy from rotating stock, sell to store (below value), or flip
  // to an NPC buyer (higher, with haggling).
  openFlipStore() {
    const day = this.gs.day;
    const opts = [
      { label: 'Sell items to store', onSelect: () => this.openSellList('flip') },
      { label: 'Flip an item to a buyer', onSelect: () => this.openFlipList() },
      { label: 'Browse store stock', onSelect: () => this.openBuyList() },
      { label: 'Leave', onSelect: () => {} },
    ];
    this.ui.openMenu('Flip Store', [
      `Backpack ${this.gs.data.backpack.length}/${this.gs.data.backpackSlots}`,
      'I pay ~70% of value. Buyers pay more.',
    ], opts);
    void day;
  }

  openPawnShop() {
    this.ui.openMenu('Pawn Shop', [
      `Backpack ${this.gs.data.backpack.length}/${this.gs.data.backpackSlots}`,
      'Quick cash, lowest prices. I only take decent goods.',
    ], [
      { label: 'Pawn items', onSelect: () => this.openSellList('pawn') },
      { label: 'Leave', onSelect: () => {} },
    ]);
  }

  // Build a sell list for either store; each row sells one item at the offer.
  openSellList(where) {
    const day = this.gs.day;
    const bp = this.gs.data.backpack;
    if (bp.length === 0) { this.toast('Your backpack is empty.', PALETTE.textDim); return; }
    const rows = [];
    bp.forEach((inv, idx) => {
      const name = ITEMS_BY_ID[inv.itemId]?.name || inv.itemId;
      if (where === 'pawn' && !pawnAccepts(inv)) return; // pawn is pickier
      const offer = where === 'flip' ? flipStoreOffer(inv, day) : pawnOffer(inv, day);
      rows.push({
        label: `${name} (${inv.condition}) - $${offer}`,
        onSelect: () => {
          this.gs.sellItemAt(idx, offer);
          this.toast(`Sold ${name} for $${offer}.`, PALETTE.money);
          this.time.delayedCall(60, () => (where === 'flip' ? this.openSellList('flip') : this.openSellList('pawn')));
        },
      });
    });
    if (rows.length === 0) { this.toast('Nothing here they will buy.', PALETTE.textDim); return; }
    rows.push({ label: 'Back', onSelect: () => {} });
    this.ui.openMenu(where === 'flip' ? 'Sell to Flip Store' : 'Pawn Items',
      ['They pay below true value.'], rows);
  }

  // Flip-to-NPC: pick an item, meet a buyer, haggle (Charisma-driven).
  openFlipList() {
    const bp = this.gs.data.backpack;
    if (bp.length === 0) { this.toast('Nothing to flip.', PALETTE.textDim); return; }
    const rows = bp.map((inv, idx) => {
      const name = ITEMS_BY_ID[inv.itemId]?.name || inv.itemId;
      return { label: `${name} (${inv.condition})`, onSelect: () => this.startHaggle(idx) };
    });
    rows.push({ label: 'Back', onSelect: () => {} });
    this.ui.openMenu('Flip to a Buyer', ['Pick an item to sell to an NPC.'], rows);
  }

  // Haggle: a buyer offers; push for more (Charisma + roll) or accept. Push too
  // hard and they walk.
  startHaggle(idx) {
    const inv = this.gs.data.backpack[idx];
    if (!inv) return;
    const name = ITEMS_BY_ID[inv.itemId]?.name || inv.itemId;
    const cha = this.gs.data.stats.charisma;
    const buyer = npcBuyerFor(inv, this.gs.day, cha);
    let offer = buyer.baseOffer;
    let pushes = 0;

    const showOffer = () => {
      this.ui.openMenu(`Buyer wants: ${name}`, [
        `Offer: $${offer}   (value ~$${buyer.trueValue})`,
        pushes === 0 ? 'They look interested.' : `You have pushed ${pushes}x.`,
      ], [
        { label: `Accept $${offer}`, onSelect: () => {
          this.gs.sellItemAt(idx, offer);
          this.gs.changeStat('charisma', 0); // (charisma already helped odds)
          this.toast(`Flipped ${name} for $${offer}!`, PALETTE.money);
        } },
        { label: 'Push for more', onSelect: () => {
          pushes++;
          // Success chance falls as you push; charisma lifts it.
          const chance = Phaser.Math.Clamp(0.35 + cha * 0.02 - pushes * 0.18, 0.05, 0.85);
          if (Math.random() < chance) {
            offer = Math.round(offer * (1.1 + Math.random() * 0.15));
            this.time.delayedCall(40, showOffer);
          } else {
            // Buyer may walk if pushed too far.
            if (Math.random() < 0.4 + pushes * 0.15) {
              this.toast(`${name}: the buyer walked away.`, PALETTE.danger);
            } else {
              this.toast('They held firm.', PALETTE.textDim);
              this.time.delayedCall(40, showOffer);
            }
          }
        } },
        { label: 'Cancel', onSelect: () => {} },
      ]);
    };
    showOffer();
  }

  // Flip store buy: a small rotating stock the player can buy to resell.
  openBuyList() {
    const day = this.gs.day;
    if (!this._stockDay || this._stockDay !== day) {
      // Roll a fresh stock of 4 items once per day.
      this._stock = [];
      const ids = Object.keys(ITEMS_BY_ID);
      for (let i = 0; i < 4; i++) {
        const id = ids[Math.floor(Math.random() * ids.length)];
        const it = ITEMS_BY_ID[id];
        this._stock.push({ itemId: id, condition: 'good', ask: Math.round(it.value * (0.9 + Math.random() * 0.3)) });
      }
      this._stockDay = day;
    }
    const rows = this._stock.map((s, i) => {
      const name = ITEMS_BY_ID[s.itemId]?.name || s.itemId;
      return {
        label: `${name} - $${s.ask}`,
        onSelect: () => {
          if (this.gs.backpackFull()) { this.toast('Backpack full!', PALETTE.danger); return; }
          if (this.gs.data.cash < s.ask) { this.toast('Not enough cash!', PALETTE.danger); return; }
          this.gs.changeCash(-s.ask, 'buy');
          this.gs.addItem(s.itemId, s.condition, s.ask);
          this.toast(`Bought ${name}.`, PALETTE.money);
        },
      };
    });
    rows.push({ label: 'Back', onSelect: () => {} });
    this.ui.openMenu('Store Stock', ['Buy low, sell high elsewhere.'], rows);
  }

  // Search a scavenge spot: a luck-and-effort roll that costs time + fatigue.
  trySearchSpot() {
    const spot = this.getNearbySearchSpot();
    if (!spot) return false;
    // Cost: 12 in-game minutes + a little fatigue per search.
    this.gs.advanceMinutes(12);
    this.gs.changeFatigue(2);
    const found = searchSpot(spot.weight, {
      reputation: this.gs.data.stats.reputation,
      luckRating: 2.5,
      hour: this.gs.hour,
      weather: this.gs.data.weather,
    });
    if (!found) {
      this.toast(`Searched the ${spot.label.toLowerCase()}... nothing.`, PALETTE.textDim);
      return true;
    }
    if (this.gs.backpackFull()) {
      this.toast(`Found ${found.name} but your backpack is full!`, PALETTE.danger);
      return true;
    }
    this.gs.addItem(found.itemId, found.condition, found.value);
    const col = found.tier === 'rare' ? PALETTE.accent : PALETTE.money;
    this.toast(`Found: ${found.name} (${found.conditionLabel}) ~$${found.value}`, col);
    return true;
  }

  getNearbySearchSpot() {
    const ptx = this.player.x / TILE_SIZE;
    const pty = this.player.y / TILE_SIZE;
    let best = null;
    let bestD = 1.6;
    (CITY.searchSpots || []).forEach((s) => {
      const d = Math.hypot(ptx - (s.x + 0.5), pty - (s.y + 0.5));
      if (d < bestD) { bestD = d; best = s; }
    });
    return best;
  }

  // Open the backpack (phone extension) - inspect items.
  openBackpack() {
    const bp = this.gs.data.backpack;
    const day = this.gs.day;
    const info = [`Backpack ${bp.length}/${this.gs.data.backpackSlots}`];
    if (bp.length === 0) {
      this.ui.openMenu('Backpack', [...info, 'Empty. Search the city for items.'], [
        { label: 'Close', onSelect: () => {} },
      ]);
      return;
    }
    const rows = bp.map((inv, idx) => {
      const it = ITEMS_BY_ID[inv.itemId];
      const tv = trueValue(inv, day);
      return {
        label: `${it?.name || inv.itemId} (${inv.condition}) ~$${tv}`,
        onSelect: () => {
          this.ui.openMenu(it?.name || inv.itemId, [
            `Condition: ${inv.condition}`,
            `Est. value: ~$${tv}`,
            `Tier: ${it?.tier || '?'}`,
          ], [
            { label: 'Drop', onSelect: () => { this.gs.removeItemAt(idx); this.toast('Dropped.', PALETTE.textDim); } },
            { label: 'Back', onSelect: () => this.openBackpack() },
          ]);
        },
      };
    });
    rows.push({ label: 'Close', onSelect: () => {} });
    this.ui.openMenu('Backpack', info, rows);
  }

  // Launch the deep, procedural work shift (JobActivity owns pay/rating).
  startShift(jobId) {
    const job = JOBS[jobId];
    const hour = this.gs.hour;
    if (hour < job.shift.start || hour >= job.shift.end) {
      this.toast(`${job.title} shift is ${job.shift.start}:00-${job.shift.end}:00`, PALETTE.danger);
      return;
    }
    // A shift takes time off the clock (real work, not instant).
    this.gs.advanceMinutes(Phaser.Math.Between(60, 120));
    this.scene.launch('JobActivity', { jobId });
    this.scene.pause();
  }

  // Called by MiniGameScene when it finishes (via the scene resume handshake).
  resolveShift(jobId, score) {
    const job = JOBS[jobId];
    // Score 0..1 scales a per-shift bonus; outdoor jobs are docked in the rain.
    let mult = 0.5 + score; // 0.5..1.5
    if (job.outdoor && this.gs.data.weather === 'rainy') mult *= 0.6;
    const bonus = Math.round(job.dailyWage * 0.5 * mult);
    this.gs.changeCash(bonus, 'shift');
    this.gs.changeStat(job.trains, 1);
    if (this.gs.data.job) this.gs.data.job.shiftsWorked++;
    this.toast(`Shift done! +$${bonus}`, PALETTE.money);
    // Boss pressure: a poor shift counts as a strike (warn -> fire).
    if (score < 0.3) this.gs.recordJobProblem();
  }

  trySleep() {
    const apt = BUILDING_BY_ID.apartment;
    const ptx = Math.floor(this.player.x / TILE_SIZE);
    const pty = Math.floor(this.player.y / TILE_SIZE);
    const near = Math.abs(ptx - apt.door.x) <= 1 && Math.abs(pty - apt.door.y) <= 1;
    // Evicted players can sleep rough anywhere (but rest poorly - see sleep()).
    if (!near && !this.gs.data.evicted) {
      this.toast('Find your apartment door to sleep (Z).');
      return;
    }
    // Fade out, skip to 08:00 next morning, restore fatigue.
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const minsToMorning = ((24 - this.gs.hour + TIME.START_HOUR) % 24) * 60 - this.gs.minute;
      this.gs.advanceMinutes(minsToMorning <= 0 ? 24 * 60 : minsToMorning);
      this.gs.sleep();
      this.cameras.main.fadeIn(500, 0, 0, 0);
      this.toast('You wake up rested.', PALETTE.money);
    });
  }

  toast(text, color = PALETTE.text) {
    EventBus.emit(EVENTS.TOAST, { text, color });
  }

  updateMarkers() {
    const target = this.ui.isBlocking() ? null : this.getFacingNPC();
    this.npcs.forEach((npc) => npc.setMarkerVisible(npc === target));
  }
}
