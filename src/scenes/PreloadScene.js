import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, PALETTE } from '../config.js';
import { buildManifest } from '../data/assetManifest.js';
import { generate } from '../utils/generateArt.js';
import { gameState } from '../core/GameState.js';

// Loads art through the KEYED PIPELINE, then routes to the title screen.
//
// For every manifest entry with a real-art `file`, we try to load it. Anything
// that 404s (i.e. the LimeZu PNGs aren't in /public yet) is remembered and, in
// create(), regenerated as a procedural placeholder for the SAME key. So real
// art drops in by key with zero logic changes; missing art degrades gracefully.
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 6, 'BIZNUX', {
        fontFamily: FONT_FAMILY, fontSize: '14px', color: '#ffffff',
      })
      .setOrigin(0.5);
    const loading = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 12, 'loading...', {
        fontFamily: FONT_FAMILY, fontSize: '7px', color: '#9aa0c0',
      })
      .setOrigin(0.5);
    this.load.on('progress', (p) => loading.setText(`loading ${Math.round(p * 100)}%`));

    this.manifest = buildManifest();
    this.failedKeys = new Set();

    // Track which real-art files fail to load so we can fall back per key.
    this.load.on('loaderror', (file) => {
      if (file?.key) this.failedKeys.add(file.key);
    });

    // Attempt every manifest entry that declares a real file.
    for (const entry of this.manifest) {
      if (!entry.file) {
        this.failedKeys.add(entry.key); // no file at all -> always generate
        continue;
      }
      if (entry.frame) {
        this.load.spritesheet(entry.key, entry.file, entry.frame);
      } else {
        this.load.image(entry.key, entry.file);
      }
    }
  }

  create() {
    // For any key whose real art didn't load, generate the placeholder. Pixel
    // art crispness is set globally via pixelArt:true in the game config.
    for (const entry of this.manifest) {
      const missing = this.failedKeys.has(entry.key) || !this.textures.exists(entry.key);
      if (missing && entry.gen) generate(this, entry.gen, entry.key);
    }

    // Returning players (with a save) skip character creation.
    const hasSave = gameState.hasSave() && gameState.load();
    this.scene.start('TitleScene', { hasSave });
  }
}
