import Phaser from 'phaser';
import { TEXTURES, TILE_SIZE, PALETTE, FONT_FAMILY, TIME, PLAYER } from '../config.js';
import { CITY, BUILDING_BY_ID } from '../data/city.js';
import { COLLIDING_TILES } from '../config.js';
import { NPCS } from '../data/npcs.js';
import { DIALOGUE } from '../data/dialogue.js';
import { JOBS } from '../data/jobs.js';
import { EventBus, EVENTS } from '../eventbus.js';
import { gameState } from '../core/GameState.js';
import InputController from '../core/InputController.js';
import Player from '../entities/Player.js';
import NPC from '../entities/NPC.js';

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

    this.input_ = new InputController(this);
    // Stop the browser from stealing TAB (focus traversal) so the phone opens.
    this.input.keyboard.addCapture('TAB');
    this.ui = this.scene.get('UIScene');

    this.setupClock();
    this.maybeRollWeather();

    // React to day changes for weather + toasts.
    EventBus.on(EVENTS.DAY_PASSED, this.onNewDay, this);
    this.events.once('shutdown', () => {
      EventBus.off(EVENTS.DAY_PASSED, this.onNewDay, this);
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
    const tileset = map.addTilesetImage('tiles', TEXTURES.TILES, TILE_SIZE, TILE_SIZE, 0, 0);
    const ground = map.createLayer(0, tileset, 0, 0);
    ground.setDepth(-1000);

    const objects = map.createBlankLayer('objects', tileset, 0, 0);
    for (let y = 0; y < CITY.height; y++) {
      for (let x = 0; x < CITY.width; x++) {
        const idx = CITY.objects[y][x];
        if (idx !== -1) objects.putTileAt(idx, x, y);
      }
    }
    objects.setCollision(COLLIDING_TILES, true);
    // Objects depth-sort with the world so the player can pass behind tall bits.
    objects.setDepth(0);

    this.map = map;
    this.objectLayer = objects;

    this.addBuildingLabels();
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
    this.npcs = NPCS.map((data) => new NPC(this, data).placeAtTile(data.tileX, data.tileY));
  }

  setupCollision() {
    this.physics.add.collider(this.player, this.objectLayer);
    this.npcs.forEach((npc) => this.physics.add.collider(this.player, npc));
  }

  setupCamera() {
    this.physics.world.setBounds(0, 0, CITY.pixelWidth, CITY.pixelHeight);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, CITY.pixelWidth, CITY.pixelHeight);
    cam.roundPixels = true;
    cam.startFollow(this.player, true, 0.12, 0.12);
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
  update() {
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
    if (confirm) this.tryInteract();
    // tryInteract may have opened a dialogue; only move if still free.
    if (this.ui.mode === 'none') this.player.update(this.input_.axis());
    else this.player.freeze();
    this.updateMarkers();
  }

  // --- Interaction ----------------------------------------------------------

  tryInteract() {
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

  // Job offer for a single job (cafe barista).
  offerJob(jobId) {
    const job = JOBS[jobId];
    const current = this.gs.data.job?.id;
    const options = [];
    if (current === jobId) {
      options.push({ label: 'Start my shift', onSelect: () => this.startShift(jobId) });
    } else {
      options.push({ label: `Take the job (${job.title})`, onSelect: () => { this.gs.setJob(jobId); this.toast(`Hired as ${job.title}!`); } });
    }
    options.push({ label: 'Maybe later', onSelect: () => {} });
    this.ui.openMenu(job.title, [job.blurb, `$${job.dailyWage}/day`], options);
  }

  // Gig board: pick delivery / dogwalk / busker.
  openJobBoard() {
    const gigs = ['delivery', 'dogwalk', 'busker'];
    const options = gigs.map((id) => ({
      label: `${JOBS[id].title}  $${JOBS[id].dailyWage}/day`,
      onSelect: () => {
        this.gs.setJob(id);
        this.toast(`Now working: ${JOBS[id].title}`);
        // Offer to work a shift right away.
        this.time.delayedCall(50, () => this.offerShiftPrompt(id));
      },
    }));
    options.push({ label: 'Never mind', onSelect: () => {} });
    this.ui.openMenu('Gig Board', ['No contract, daily pay.', 'Pick a gig:'], options);
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
  }

  trySleep() {
    const apt = BUILDING_BY_ID.apartment;
    const ptx = Math.floor(this.player.x / TILE_SIZE);
    const pty = Math.floor(this.player.y / TILE_SIZE);
    const near = Math.abs(ptx - apt.door.x) <= 1 && Math.abs(pty - apt.door.y) <= 1;
    if (!near) {
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
