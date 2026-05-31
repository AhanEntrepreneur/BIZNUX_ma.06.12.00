// ---------------------------------------------------------------------------
// Programmatic placeholder pixel art.
//
// This draws the tileset and character spritesheet straight into canvas-backed
// textures at runtime, so v1 needs zero downloaded assets. The output is shaped
// exactly like real assets would be:
//   - tiles texture: a horizontal strip of 16x16 tiles, indexed by TILES.*
//   - player texture: a horizontal strip of 16x16 frames (4 dirs x 3 frames)
//
// To replace with real art, see USE_PLACEHOLDER_ART in config.js. Game logic
// only ever references texture keys + frame indices, never this file.
// ---------------------------------------------------------------------------
import { TILE_SIZE, TILE_COUNT, TILES, CHAR, PALETTE } from '../config.js';

// Convert a 0xRRGGBB number into a CSS color string for canvas drawing.
function css(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

// Fill a single pixel (or block of pixels) at tile-local coordinates.
function px(ctx, ox, oy, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = css(color);
  ctx.fillRect(ox + x, oy + y, w, h);
}

// --- Tile drawing ----------------------------------------------------------
// Each function draws one 16x16 tile at canvas offset (ox, oy).

function drawGrass(ctx, ox, oy) {
  px(ctx, ox, oy, 0, 0, PALETTE.grass, TILE_SIZE, TILE_SIZE);
  // scattered darker blades for texture
  const blades = [
    [3, 4], [10, 2], [6, 9], [13, 11], [2, 12], [8, 6], [12, 5],
  ];
  blades.forEach(([x, y]) => px(ctx, ox, oy, x, y, PALETTE.grassDark, 1, 2));
}

function drawPath(ctx, ox, oy) {
  px(ctx, ox, oy, 0, 0, PALETTE.path, TILE_SIZE, TILE_SIZE);
  const specks = [
    [2, 3], [11, 2], [5, 8], [13, 10], [7, 13], [9, 6], [4, 11],
  ];
  specks.forEach(([x, y]) => px(ctx, ox, oy, x, y, PALETTE.pathDark, 1, 1));
}

function drawSand(ctx, ox, oy) {
  px(ctx, ox, oy, 0, 0, PALETTE.sand, TILE_SIZE, TILE_SIZE);
  const specks = [[3, 5], [9, 3], [12, 9], [6, 12]];
  specks.forEach(([x, y]) => px(ctx, ox, oy, x, y, PALETTE.pathDark, 1, 1));
}

function drawWater(ctx, ox, oy) {
  px(ctx, ox, oy, 0, 0, PALETTE.water, TILE_SIZE, TILE_SIZE);
  // little wave highlights
  px(ctx, ox, oy, 2, 4, PALETTE.waterLight, 4, 1);
  px(ctx, ox, oy, 9, 7, PALETTE.waterLight, 4, 1);
  px(ctx, ox, oy, 4, 11, PALETTE.waterLight, 3, 1);
}

function drawTree(ctx, ox, oy) {
  // grass underneath, then trunk + round canopy
  drawGrass(ctx, ox, oy);
  px(ctx, ox, oy, 7, 11, PALETTE.treeTrunk, 2, 4);
  // canopy
  px(ctx, ox, oy, 4, 2, PALETTE.treeLeaf, 8, 8);
  px(ctx, ox, oy, 3, 4, PALETTE.treeLeaf, 10, 4);
  px(ctx, ox, oy, 5, 1, PALETTE.treeLeaf, 6, 2);
  // shading
  px(ctx, ox, oy, 4, 7, PALETTE.treeLeafDark, 8, 2);
  px(ctx, ox, oy, 9, 3, PALETTE.treeLeafDark, 2, 3);
}

function drawFlower(ctx, ox, oy) {
  drawGrass(ctx, ox, oy);
  px(ctx, ox, oy, 7, 7, PALETTE.flower, 2, 2);
  px(ctx, ox, oy, 6, 8, PALETTE.flower, 1, 1);
  px(ctx, ox, oy, 9, 8, PALETTE.flower, 1, 1);
  px(ctx, ox, oy, 2, 11, PALETTE.flower, 1, 1);
  px(ctx, ox, oy, 12, 4, PALETTE.flower, 1, 1);
}

function drawWall(ctx, ox, oy) {
  px(ctx, ox, oy, 0, 0, PALETTE.wall, TILE_SIZE, TILE_SIZE);
  // brick lines
  for (let y = 3; y < TILE_SIZE; y += 4) {
    px(ctx, ox, oy, 0, y, PALETTE.wallDark, TILE_SIZE, 1);
  }
  px(ctx, ox, oy, 4, 0, PALETTE.wallDark, 1, 3);
  px(ctx, ox, oy, 8, 4, PALETTE.wallDark, 1, 3);
  px(ctx, ox, oy, 12, 8, PALETTE.wallDark, 1, 3);
}

function drawRoof(ctx, ox, oy) {
  px(ctx, ox, oy, 0, 0, PALETTE.roof, TILE_SIZE, TILE_SIZE);
  // shingle rows
  for (let y = 2; y < TILE_SIZE; y += 4) {
    px(ctx, ox, oy, 0, y, PALETTE.roofDark, TILE_SIZE, 1);
  }
}

function drawDoor(ctx, ox, oy) {
  px(ctx, ox, oy, 0, 0, PALETTE.wall, TILE_SIZE, TILE_SIZE);
  // doorway
  px(ctx, ox, oy, 4, 3, PALETTE.door, 8, 13);
  px(ctx, ox, oy, 9, 9, PALETTE.flower, 1, 1); // tiny knob
}

// Map TILES index -> drawing function.
const TILE_DRAWERS = {
  [TILES.GRASS]: drawGrass,
  [TILES.PATH]: drawPath,
  [TILES.WATER]: drawWater,
  [TILES.TREE]: drawTree,
  [TILES.FLOWER]: drawFlower,
  [TILES.BUILDING_WALL]: drawWall,
  [TILES.BUILDING_ROOF]: drawRoof,
  [TILES.BUILDING_DOOR]: drawDoor,
  [TILES.SAND]: drawSand,
};

// Build the tileset texture: one 16x16 tile per column.
export function generateTileset(scene, key) {
  const width = TILE_COUNT * TILE_SIZE;
  const texture = scene.textures.createCanvas(key, width, TILE_SIZE);
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < TILE_COUNT; i++) {
    const drawer = TILE_DRAWERS[i] || drawGrass;
    drawer(ctx, i * TILE_SIZE, 0);
  }
  texture.refresh();
}

// --- Character drawing -----------------------------------------------------
// A tiny humanoid seen top-down-ish. `step` shifts the legs for a walk frame:
//   step = 0 -> idle, 1 -> left foot, -1 -> right foot.
function drawChar(ctx, ox, oy, dir, step) {
  const skin = 0xf0c090;
  const shirt = 0x3d7de0;
  const pants = 0x2b3a55;
  const hair = 0x4a2f1a;
  const eye = 0x101010;

  // body / shirt
  px(ctx, ox, oy, 5, 7, shirt, 6, 5);
  // head
  px(ctx, ox, oy, 5, 2, skin, 6, 5);
  // hair on top
  px(ctx, ox, oy, 5, 1, hair, 6, 2);

  // legs with walk offset
  const ly1 = 12 + (step === 1 ? -1 : 0);
  const ly2 = 12 + (step === -1 ? -1 : 0);
  px(ctx, ox, oy, 5, ly1, pants, 2, 3);
  px(ctx, ox, oy, 9, ly2, pants, 2, 3);

  // facing details (eyes / hair fringe)
  if (dir === 'down') {
    px(ctx, ox, oy, 6, 4, eye, 1, 1);
    px(ctx, ox, oy, 9, 4, eye, 1, 1);
  } else if (dir === 'up') {
    // back of head: all hair, no eyes
    px(ctx, ox, oy, 5, 2, hair, 6, 3);
  } else if (dir === 'left') {
    px(ctx, ox, oy, 6, 4, eye, 1, 1);
    px(ctx, ox, oy, 5, 3, hair, 2, 2); // fringe shifted left
  } else if (dir === 'right') {
    px(ctx, ox, oy, 9, 4, eye, 1, 1);
    px(ctx, ox, oy, 9, 3, hair, 2, 2); // fringe shifted right
  }
}

// Build a simple wooden sign prop (used for static interactables).
export function generateSign(scene, key) {
  const texture = scene.textures.createCanvas(key, TILE_SIZE, TILE_SIZE);
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  const ox = 0;
  const oy = 0;
  const board = 0xb5824a;
  const boardDark = 0x8a6035;
  const post = PALETTE.treeTrunk;
  // post
  px(ctx, ox, oy, 7, 9, post, 2, 6);
  // board
  px(ctx, ox, oy, 3, 3, board, 10, 6);
  px(ctx, ox, oy, 3, 3, boardDark, 10, 1);
  px(ctx, ox, oy, 3, 8, boardDark, 10, 1);
  // a couple of "text" scratches
  px(ctx, ox, oy, 5, 5, boardDark, 6, 1);
  px(ctx, ox, oy, 5, 7, boardDark, 4, 1);
  texture.refresh();
}

// Build the character spritesheet: 4 directions x 3 frames laid in one row.
// Frame order matches CHAR.DIRECTION_OFFSET (down, left, right, up), each as
// [idle, stepA, stepB].
export function generatePlayer(scene, key) {
  const dirs = ['down', 'left', 'right', 'up'];
  const framesPerDir = CHAR.FRAMES_PER_DIR;
  const totalFrames = dirs.length * framesPerDir;
  const width = totalFrames * CHAR.FRAME_WIDTH;

  const texture = scene.textures.createCanvas(key, width, CHAR.FRAME_HEIGHT);
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;

  const steps = [0, 1, -1]; // idle, stepA, stepB
  let frame = 0;
  dirs.forEach((dir) => {
    steps.forEach((step) => {
      drawChar(ctx, frame * CHAR.FRAME_WIDTH, 0, dir, step);
      frame++;
    });
  });
  texture.refresh();

  // Register grid frames so the sheet can be used like a loaded spritesheet.
  for (let i = 0; i < totalFrames; i++) {
    texture.add(i, 0, i * CHAR.FRAME_WIDTH, 0, CHAR.FRAME_WIDTH, CHAR.FRAME_HEIGHT);
  }
}
