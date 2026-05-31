import Phaser from 'phaser';
// Bundled pixel font — pulled in by `npm install`, so there is no manual
// download and no runtime CDN request. Swap this import to change the font.
import '@fontsource/press-start-2p';

import { GAME_WIDTH, GAME_HEIGHT, PALETTE } from './config.js';
import PreloadScene from './scenes/PreloadScene.js';
import TitleScene from './scenes/TitleScene.js';
import WorldScene from './scenes/WorldScene.js';
import UIScene from './scenes/UIScene.js';

// The Phaser game configuration. The retro look lives here:
//   - low internal resolution (320x240) scaled up to fill the window
//   - pixelArt + roundPixels + nearest-neighbor -> crisp, never blurry
const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#' + PALETTE.bg.toString(16).padStart(6, '0'),
  pixelArt: true, // disables texture smoothing (nearest-neighbor)
  roundPixels: true, // keep sprites on whole pixels -> no shimmer
  scale: {
    mode: Phaser.Scale.FIT, // scale up to fit the window, preserve aspect
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // top-down: no gravity
      debug: false,
    },
  },
  // Scene order: Preload runs first; Title/World/UI are started on demand.
  scene: [PreloadScene, TitleScene, WorldScene, UIScene],
};

// Make sure the pixel font is ready before Phaser starts drawing text, so the
// very first frame (LOADING / title) already uses it. We don't block forever if
// the font API misbehaves.
async function start() {
  try {
    await document.fonts.load('10px "Press Start 2P"');
    await document.fonts.ready;
  } catch (e) {
    // Non-fatal: the game still runs with a fallback font.
    console.warn('Font preload skipped:', e);
  }
  // eslint-disable-next-line no-new
  new Phaser.Game(gameConfig);
}

start();
