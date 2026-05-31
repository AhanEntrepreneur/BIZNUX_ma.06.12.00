import Phaser from 'phaser';
// Bundled pixel font (installed by npm; no manual download / CDN request).
import '@fontsource/press-start-2p';

import { GAME_WIDTH, GAME_HEIGHT, PALETTE } from './config.js';
import { GameState } from './core/GameState.js';
import { JOBS } from './data/jobs.js';
import PreloadScene from './scenes/PreloadScene.js';
import TitleScene from './scenes/TitleScene.js';
import CharacterScene from './scenes/CharacterScene.js';
import WorldScene from './scenes/WorldScene.js';
import MiniGameScene from './scenes/MiniGameScene.js';
import UIScene from './scenes/UIScene.js';

// Inject the jobs table into GameState so daily wage settlement can look up
// wages without a static import cycle between core/ and data/.
GameState._jobsTable = JOBS;

// Phaser game config. Retro look: low internal resolution scaled up, pixelArt +
// roundPixels + nearest-neighbor -> crisp, never blurry. Top-down, no gravity.
const gameConfig = {
  // Phaser 4: the lighting + unified Filter features are WebGL-only, so we
  // require the WebGL renderer (AUTO would fall back to Canvas and silently
  // drop all the post-processing). WEBGL throws loudly if unavailable.
  type: Phaser.WEBGL,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#' + PALETTE.bg.toString(16).padStart(6, '0'),
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  // Scene registry. Preload boots first; the rest start on demand.
  scene: [PreloadScene, TitleScene, CharacterScene, WorldScene, MiniGameScene, UIScene],
};

async function start() {
  try {
    await document.fonts.load('10px "Press Start 2P"');
    await document.fonts.ready;
  } catch (e) {
    console.warn('Font preload skipped:', e);
  }
  // eslint-disable-next-line no-new
  new Phaser.Game(gameConfig);
}

start();
