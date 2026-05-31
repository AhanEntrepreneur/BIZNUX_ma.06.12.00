import Phaser from 'phaser';
import { TEXTURES, TILE_SIZE, PALETTE } from '../config.js';
import { MAP, COLLIDING_TILES } from '../data/map.js';
import { NPCS } from '../data/npcs.js';
import { DIALOGUE } from '../data/dialogue.js';
import { EventBus, EVENTS } from '../eventbus.js';
import Player from '../entities/Player.js';
import NPC from '../entities/NPC.js';

// The overworld. Builds the tile map + collision, spawns the player and NPCs,
// follows the player with a clamped camera, and runs the interaction system.
//
// Dialogue rendering lives in UIScene; this scene just decides WHEN to talk.
export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);

    this.buildMap();
    this.createPlayer();
    this.createNPCs();
    this.setupCollision();
    this.setupCamera();
    this.setupInput();

    // The UIScene overlay; we ask it whether dialogue is open and to advance it.
    this.ui = this.scene.get('UIScene');
  }

  // --- World construction ---------------------------------------------------

  buildMap() {
    // Ground layer comes straight from the data array.
    const map = this.make.tilemap({
      data: MAP.ground,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage(
      'tiles',
      TEXTURES.TILES,
      TILE_SIZE,
      TILE_SIZE,
      0,
      0
    );
    map.createLayer(0, tileset, 0, 0);

    // Object layer (trees, water, buildings) painted on a blank layer so we can
    // set collision independently of the walkable ground.
    const objectLayer = map.createBlankLayer('objects', tileset, 0, 0);
    for (let y = 0; y < MAP.height; y++) {
      for (let x = 0; x < MAP.width; x++) {
        const idx = MAP.objects[y][x];
        if (idx !== -1) objectLayer.putTileAt(idx, x, y);
      }
    }
    objectLayer.setCollision(COLLIDING_TILES, true);

    this.map = map;
    this.objectLayer = objectLayer;
  }

  createPlayer() {
    const px = MAP.spawn.tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = MAP.spawn.tileY * TILE_SIZE + TILE_SIZE / 2;
    this.player = new Player(this, px, py);
  }

  createNPCs() {
    this.npcs = NPCS.map((data) => {
      const npc = new NPC(this, data);
      npc.setPosition(
        data.tileX * TILE_SIZE + TILE_SIZE / 2,
        data.tileY * TILE_SIZE + TILE_SIZE / 2
      );
      return npc;
    });
  }

  setupCollision() {
    this.physics.add.collider(this.player, this.objectLayer);
    this.npcs.forEach((npc) => this.physics.add.collider(this.player, npc));
  }

  setupCamera() {
    this.physics.world.setBounds(0, 0, MAP.pixelWidth, MAP.pixelHeight);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP.pixelWidth, MAP.pixelHeight);
    cam.roundPixels = true;
    // Smoothly follow with a gentle lerp; bounds keep it from showing the void.
    cam.startFollow(this.player, true, 0.12, 0.12);
  }

  setupInput() {
    const kb = this.input.keyboard;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.interactKeys = [
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    ];
  }

  // --- Per-frame loop -------------------------------------------------------

  update() {
    const interactPressed = this.interactKeys.some((k) =>
      Phaser.Input.Keyboard.JustDown(k)
    );

    // While dialogue is open: freeze the player and route input to the box.
    if (this.ui.isOpen) {
      this.player.freeze();
      if (interactPressed) this.ui.advanceDialogue();
      this.updateMarkers();
      return;
    }

    // Try to start a conversation. May open the dialogue box this frame.
    if (interactPressed) this.tryInteract();
    if (this.ui.isOpen) {
      this.player.freeze();
      return;
    }

    this.player.update(this.getMoveInput());
    this.updateMarkers();
  }

  getMoveInput() {
    return {
      left: this.cursors.left.isDown || this.wasd.left.isDown,
      right: this.cursors.right.isDown || this.wasd.right.isDown,
      up: this.cursors.up.isDown || this.wasd.up.isDown,
      down: this.cursors.down.isDown || this.wasd.down.isDown,
    };
  }

  // --- Interaction ----------------------------------------------------------

  // Find the interactable the player is facing (if any) and start its dialogue.
  tryInteract() {
    const target = this.getFacingInteractable();
    if (!target) return;
    const data = DIALOGUE[target.dialogueKey];
    if (!data) return;
    EventBus.emit(EVENTS.DIALOGUE_START, { name: data.name, lines: data.lines });
  }

  // Returns the NPC/sign closest to the tile in front of the player, if one is
  // within reach.
  getFacingInteractable() {
    const front = this.player.getFrontPoint();
    let best = null;
    let bestDist = TILE_SIZE * 0.9; // must be roughly the tile we're facing
    this.npcs.forEach((npc) => {
      const d = Phaser.Math.Distance.Between(front.x, front.y, npc.x, npc.y);
      if (d < bestDist) {
        bestDist = d;
        best = npc;
      }
    });
    return best;
  }

  // Show the "!" marker over whatever the player could currently talk to.
  updateMarkers() {
    const target = this.ui.isOpen ? null : this.getFacingInteractable();
    this.npcs.forEach((npc) => npc.setMarkerVisible(npc === target));
  }
}
