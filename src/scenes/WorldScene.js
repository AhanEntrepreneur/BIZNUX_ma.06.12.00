import Phaser from 'phaser';
import { TILE_SIZE, PALETTE, FONT_FAMILY, TIME, COLLIDING_TILES, TILES, DOGWALK_CFG } from '../config.js';
import { CITY, BUILDING_BY_ID } from '../data/city.js';
import { KEYS } from '../data/assetManifest.js';
import { NPCS } from '../data/npcs.js';
import { DIALOGUE } from '../data/dialogue.js';
import { JOBS } from '../data/jobs.js';
import { EventBus, EVENTS } from '../eventbus.js';
import { gameState } from '../core/GameState.js';
import { rollAvailability } from '../core/LuckEngine.js';
import InputController from '../core/InputController.js';
import Player from '../entities/Player.js';
import NPC from '../entities/NPC.js';
import Atmosphere from '../core/Atmosphere.js';
import DogWalk from '../activities/DogWalk.js';

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

    // During a dog walk the player MOVES FREELY (real navigation); Space is
    // routed to the activity first (clean up / hold leash / hand back dog).
    if (this.dogWalk.active) {
      if (confirm && this.dogWalk.onConfirm()) {
        // handled by the activity
      } else if (confirm) {
        this.tryInteract();
      }
      this.dogWalk.update(delta);
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
    const npc = this.getFacingNPC();
    if (!npc) return;
    this.dispatchInteraction(npc);
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
      case 'job':
        this.offerJob(npc.jobId);
        break;
      case 'jobboard':
        this.openJobBoard();
        break;
      case 'college':
        this.openCollege();
        break;
      case 'realtor':
        this.openRealtor();
        break;
      default:
        break; // flavor NPCs: intro only
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
    ['delivery', 'busker'].forEach((id) => {
      options.push({
        label: `${JOBS[id].title}  $${JOBS[id].dailyWage}/day`,
        onSelect: () => {
          this.gs.setJob(id);
          this.toast(`Now working: ${JOBS[id].title}`);
          this.time.delayedCall(50, () => this.offerShiftPrompt(id));
        },
      });
    });
    options.push({ label: 'Never mind', onSelect: () => {} });
    this.ui.openMenu('Gig App', [
      `Bags: ${this.gs.data.poopBags}   Dog rating: ${rating}/5`,
      'Look for work - no guarantee of a client.',
    ], options);
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

  // Launch the work mini-game scene for a job, then apply the result.
  startShift(jobId) {
    const job = JOBS[jobId];
    const hour = this.gs.hour;
    if (hour < job.shift.start || hour >= job.shift.end) {
      this.toast(`${job.title} shift is ${job.shift.start}:00-${job.shift.end}:00`, PALETTE.danger);
      return;
    }
    this.scene.launch('MiniGameScene', { jobId });
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
