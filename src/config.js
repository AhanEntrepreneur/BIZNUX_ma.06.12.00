// ---------------------------------------------------------------------------
// Global game configuration.
//
// Everything here is meant to be tweaked without touching scene/game logic.
// When you later swap the programmatic placeholder art for real spritesheets
// (Kenney.nl, itch.io, etc.), most of your changes happen in THIS file and in
// PreloadScene — not in WorldScene/Player/NPC.
// ---------------------------------------------------------------------------

// Internal (low) resolution. The whole point of retro: render small, scale up.
// At 16px tiles this shows a 20x15 tile viewport, very GBA-like.
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 240;

// One tile = 16x16 pixels. Used by maps, the camera, collision, everything.
export const TILE_SIZE = 16;

// The pixel font (bundled via @fontsource, so `npm install` is all you need).
export const FONT_FAMILY = '"Press Start 2P"';

// Texture keys. Centralized so nothing hardcodes magic strings.
export const TEXTURES = {
  TILES: 'tiles', // the tileset (one row of 16x16 tiles)
  PLAYER: 'player', // 4-direction character spritesheet
  NPC: 'npc', // re-uses the player sheet shape, recolored per-NPC via tint
  SIGN: 'sign', // a static wooden sign prop (16x16)
};

// Tile indices inside the tileset texture. These map 1:1 to the column order
// the placeholder generator draws them in. A real tileset just needs to match
// this index order (or update these numbers).
export const TILES = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  TREE: 3,
  FLOWER: 4, // decorative, non-colliding grass variant
  BUILDING_WALL: 5,
  BUILDING_ROOF: 6,
  BUILDING_DOOR: 7,
  SAND: 8,
};

// How many distinct tiles the placeholder generator should draw. Keep in sync
// with the TILES table above.
export const TILE_COUNT = 9;

// Player/NPC spritesheet layout. 4 directions x 3 frames (idle, stepA, stepB).
export const CHAR = {
  FRAME_WIDTH: 16,
  FRAME_HEIGHT: 16,
  // Frame index of the first frame for each facing direction.
  DIRECTION_OFFSET: {
    down: 0,
    left: 3,
    right: 6,
    up: 9,
  },
  FRAMES_PER_DIR: 3, // [idle, stepA, stepB]
};

export const PLAYER = {
  SPEED: 80, // pixels/second
};

// ---------------------------------------------------------------------------
// Asset source switch.
//
// v1 ships with USE_PLACEHOLDER_ART = true: PreloadScene draws all art in code,
// so the game runs with zero downloads.
//
// To use real art later:
//   1. Drop your files into /public/assets (e.g. tiles.png, player.png).
//   2. Set USE_PLACEHOLDER_ART = false.
//   3. Make sure frame sizes / tile order match the tables above.
// No game logic needs to change.
// ---------------------------------------------------------------------------
export const USE_PLACEHOLDER_ART = true;

export const ASSET_PATHS = {
  // Paths are relative to /public (Vite serves that folder at the web root).
  TILES: 'assets/tiles.png',
  PLAYER: 'assets/player.png',
};

// Color palette (cohesive, limited). Used by the placeholder art generator and
// the UI so everything feels like one world.
export const PALETTE = {
  bg: 0x0b0d1a,
  grass: 0x4a9c3a,
  grassDark: 0x3c8030,
  path: 0xc9a86a,
  pathDark: 0xb08f52,
  water: 0x3a72c4,
  waterLight: 0x5a92e4,
  treeLeaf: 0x2f7d32,
  treeLeafDark: 0x256127,
  treeTrunk: 0x6b4423,
  wall: 0xd9b48f,
  wallDark: 0xb8946f,
  roof: 0xb5443a,
  roofDark: 0x933630,
  door: 0x5a3a22,
  flower: 0xf2d24b,
  sand: 0xe3d6a3,
  // UI
  panel: 0x1a1c2e,
  panelBorder: 0xf4f4f4,
  text: 0xffffff,
};
