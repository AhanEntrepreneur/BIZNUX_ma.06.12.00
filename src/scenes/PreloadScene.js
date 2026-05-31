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
import { generateTileset, generateCharacter } from '../utils/generateArt.js';
import { gameState } from '../core/GameState.js';

// Loads or generates all assets, then routes to the title screen.
// The single place where "where do assets come from" is decided.
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'LOADING...', {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    if (USE_PLACEHOLDER_ART) {
      generateTileset(this, TEXTURES.TILES);
      generateCharacter(this); // builds char_body_*, char_hair_*, char_outfit_*
    } else {
      // Real-art path: drop matching files in /public/assets.
      this.load.spritesheet(TEXTURES.TILES, ASSET_PATHS.TILES, {
        frameWidth: TILE_SIZE,
        frameHeight: TILE_SIZE,
      });
      // (Real layered char sheets would be loaded here with matching keys.)
    }
  }

  create() {
    // Decide first scene: returning players with a save skip character creation.
    if (gameState.hasSave() && gameState.load()) {
      this.scene.start('TitleScene', { hasSave: true });
    } else {
      this.scene.start('TitleScene', { hasSave: false });
    }
  }
}
