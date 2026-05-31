import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, PALETTE } from '../config.js';
import { buildManifest } from '../data/assetManifest.js';
import { generate } from '../utils/generateArt.js';
import { gameState } from '../core/GameState.js';

// Generates ALL art procedurally (no network loads, no 404s), validates every
// spritesheet's dimensions against its declared frame size, then routes to the
// title screen.
//
// Validation (Part 0.B): a sheet whose width/height aren't exact multiples of
// the frame size cannot be sliced. We assert that here and log actual vs
// declared dimensions, failing loudly in dev so a bad generator is caught at
// the source rather than as a vague runtime error later.
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
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 12, 'generating world...', {
        fontFamily: FONT_FAMILY, fontSize: '7px', color: '#9aa0c0',
      })
      .setOrigin(0.5);
  }

  create() {
    const manifest = buildManifest();
    const dev = !!(import.meta.env && import.meta.env.DEV);
    let problems = 0;

    for (const entry of manifest) {
      generate(this, entry.gen, entry.key, entry.frame);

      if (!this.textures.exists(entry.key)) {
        console.error(`[art] generator '${entry.gen}' produced no texture for key '${entry.key}'`);
        problems++;
        continue;
      }

      // Validate spritesheet dimensions are exact multiples of the frame size.
      if (entry.frame) {
        const src = this.textures.get(entry.key).getSourceImage();
        const w = src.width;
        const h = src.height;
        const fw = entry.frame.frameWidth;
        const fh = entry.frame.frameHeight;
        const ok = w % fw === 0 && h % fh === 0;
        if (!ok) {
          console.error(`[art] '${entry.key}' is ${w}x${h}, not a multiple of frame ${fw}x${fh}`);
          problems++;
        } else if (dev) {
          // Quiet confirmation in dev (info, not error) of the slice grid.
          console.info(`[art] ${entry.key}: ${w}x${h} = ${w / fw}x${h / fh} frames of ${fw}x${fh}`);
        }
      }
    }

    if (problems > 0) console.error(`[art] ${problems} asset validation problem(s)`);

    const hasSave = gameState.hasSave() && gameState.load();
    this.scene.start('TitleScene', { hasSave });
  }
}
