import Phaser from 'phaser';
import {
  TEXTURES,
  TILE_SIZE,
  CHAR,
  USE_PLACEHOLDER_ART,
  ASSET_PATHS,
  GAME_WIDTH,
  GAME_HEIGHT,
  FONT_FAMILY,
  PALETTE,
} from '../config.js';
import {
  generateTileset,
  generatePlayer,
  generateSign,
} from '../utils/generateArt.js';

// Loads (or generates) every asset, then hands off to the title screen.
//
// This is the ONE place where "where do assets come from" is decided. v1 draws
// placeholder art in code. Flip USE_PLACEHOLDER_ART in config.js to load real
// files from /public/assets instead — no other scene changes.
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.showLoadingText();

    if (USE_PLACEHOLDER_ART) {
      // Generated synchronously into canvas textures — nothing to download.
      generateTileset(this, TEXTURES.TILES);
      generatePlayer(this, TEXTURES.PLAYER);
      // NPCs reuse the character generator under their own key (recolored via
      // per-NPC tint at spawn). Later, swap this for a dedicated NPC sheet.
      generatePlayer(this, TEXTURES.NPC);
      generateSign(this, TEXTURES.SIGN);
    } else {
      // Real-art path: drop matching files in /public/assets and they load here.
      this.load.spritesheet(TEXTURES.TILES, ASSET_PATHS.TILES, {
        frameWidth: TILE_SIZE,
        frameHeight: TILE_SIZE,
      });
      this.load.spritesheet(TEXTURES.PLAYER, ASSET_PATHS.PLAYER, {
        frameWidth: CHAR.FRAME_WIDTH,
        frameHeight: CHAR.FRAME_HEIGHT,
      });
    }
  }

  create() {
    // Real-art path only: if no dedicated NPC sheet was loaded, alias the player
    // texture so NPCs have something to render. (The placeholder path already
    // generated a real TEXTURES.NPC canvas in preload.)
    if (!this.textures.exists(TEXTURES.NPC)) {
      this.textures.addImage(
        TEXTURES.NPC,
        this.textures.get(TEXTURES.PLAYER).getSourceImage()
      );
      const tex = this.textures.get(TEXTURES.NPC);
      const total =
        Object.keys(CHAR.DIRECTION_OFFSET).length * CHAR.FRAMES_PER_DIR;
      for (let i = 0; i < total; i++) {
        tex.add(i, 0, i * CHAR.FRAME_WIDTH, 0, CHAR.FRAME_WIDTH, CHAR.FRAME_HEIGHT);
      }
    }

    this.scene.start('TitleScene');
  }

  // A minimal retro loading splash (mostly relevant in the real-art path).
  showLoadingText() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'LOADING...', {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }
}
