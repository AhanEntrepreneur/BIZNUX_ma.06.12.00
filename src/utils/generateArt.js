// ---------------------------------------------------------------------------
// Programmatic placeholder pixel art (zero downloads for v1).
//
// Produces canvas-backed textures shaped exactly like real assets would be:
//   - tiles:        a horizontal strip of 16x16 tiles, indexed by TILES.*
//   - char_body:    4 dir x 3 frames of a bare body (skin), per body type
//   - char_hair:    matching sheet of just-hair overlays (tintable)
//   - char_outfit:  matching sheet of just-clothes overlays (tintable)
//
// The character is drawn in THREE layered sheets so the engine can stack
// body + hair + outfit and recolor each independently - exactly the layering
// the spec calls for. Real art swaps in via USE_PLACEHOLDER_ART (config.js).
// ---------------------------------------------------------------------------
import { TILE_SIZE, TILE_COUNT, TILES, CHAR, PALETTE } from '../config.js';

function css(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}
function px(ctx, ox, oy, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = css(color);
  ctx.fillRect(ox + x, oy + y, w, h);
}

// --- Tiles -----------------------------------------------------------------
function drawGrass(c, o, p) {
  px(c, o, p, 0, 0, PALETTE.grass, 16, 16);
  [[3, 4], [10, 2], [6, 9], [13, 11], [2, 12], [8, 6]].forEach(([x, y]) =>
    px(c, o, p, x, y, PALETTE.grassDark, 1, 2)
  );
}
function drawRoad(c, o, p) {
  px(c, o, p, 0, 0, PALETTE.road, 16, 16);
  // faint center dashes drawn on the tile so long roads read as lanes
  px(c, o, p, 7, 2, PALETTE.roadLine, 2, 4);
  px(c, o, p, 7, 10, PALETTE.roadLine, 2, 4);
}
function drawSidewalk(c, o, p) {
  px(c, o, p, 0, 0, PALETTE.sidewalk, 16, 16);
  px(c, o, p, 0, 0, PALETTE.sidewalkDark, 16, 1);
  px(c, o, p, 0, 8, PALETTE.sidewalkDark, 16, 1);
  px(c, o, p, 8, 0, PALETTE.sidewalkDark, 1, 16);
}
function drawWater(c, o, p) {
  px(c, o, p, 0, 0, PALETTE.water, 16, 16);
  px(c, o, p, 2, 4, PALETTE.waterLight, 4, 1);
  px(c, o, p, 9, 8, PALETTE.waterLight, 4, 1);
  px(c, o, p, 4, 12, PALETTE.waterLight, 3, 1);
}
function drawTree(c, o, p) {
  drawGrass(c, o, p);
  px(c, o, p, 7, 11, PALETTE.treeTrunk, 2, 4);
  px(c, o, p, 4, 2, PALETTE.treeLeaf, 8, 8);
  px(c, o, p, 3, 4, PALETTE.treeLeaf, 10, 4);
  px(c, o, p, 5, 1, PALETTE.treeLeaf, 6, 2);
  px(c, o, p, 4, 7, PALETTE.treeLeafDark, 8, 2);
}
function drawPlaza(c, o, p) {
  px(c, o, p, 0, 0, PALETTE.plaza, 16, 16);
  px(c, o, p, 0, 0, PALETTE.plazaLine, 16, 1);
  px(c, o, p, 0, 0, PALETTE.plazaLine, 1, 16);
}
function drawWall(c, o, p) {
  px(c, o, p, 0, 0, PALETTE.wall, 16, 16);
  for (let y = 3; y < 16; y += 4) px(c, o, p, 0, y, PALETTE.wallDark, 16, 1);
  px(c, o, p, 4, 0, PALETTE.wallDark, 1, 3);
  px(c, o, p, 8, 4, PALETTE.wallDark, 1, 3);
  px(c, o, p, 12, 8, PALETTE.wallDark, 1, 3);
}
function drawCrosswalk(c, o, p) {
  px(c, o, p, 0, 0, PALETTE.road, 16, 16);
  for (let x = 1; x < 16; x += 4) px(c, o, p, x, 0, PALETTE.crosswalk, 2, 16);
}
function drawPlanter(c, o, p) {
  drawSidewalk(c, o, p);
  px(c, o, p, 3, 3, PALETTE.treeTrunk, 10, 10);
  px(c, o, p, 4, 2, PALETTE.planter, 8, 8);
  px(c, o, p, 5, 1, PALETTE.planter, 6, 3);
}

const TILE_DRAWERS = {
  [TILES.GRASS]: drawGrass,
  [TILES.ROAD]: drawRoad,
  [TILES.SIDEWALK]: drawSidewalk,
  [TILES.WATER]: drawWater,
  [TILES.TREE]: drawTree,
  [TILES.PLAZA]: drawPlaza,
  [TILES.WALL]: drawWall,
  [TILES.CROSSWALK]: drawCrosswalk,
  [TILES.PLANTER]: drawPlanter,
};

export function generateTileset(scene, key) {
  const width = TILE_COUNT * TILE_SIZE;
  const tex = scene.textures.createCanvas(key, width, TILE_SIZE);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < TILE_COUNT; i++) (TILE_DRAWERS[i] || drawGrass)(ctx, i * TILE_SIZE, 0);
  tex.refresh();
}

// --- Character layers ------------------------------------------------------
// Shared frame walker: calls drawFn(ctx, ox, oy, dir, step) for all 12 frames
// in the canonical order (down, left, right, up) x (idle, stepA, stepB), then
// registers grid frames so the texture behaves like a loaded spritesheet.
function buildCharSheet(scene, key, drawFn) {
  const dirs = ['down', 'left', 'right', 'up'];
  const steps = [0, 1, -1];
  const total = dirs.length * steps.length;
  const tex = scene.textures.createCanvas(key, total * CHAR.FRAME_WIDTH, CHAR.FRAME_HEIGHT);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  let f = 0;
  dirs.forEach((dir) => {
    steps.forEach((step) => {
      drawFn(ctx, f * CHAR.FRAME_WIDTH, 0, dir, step);
      f++;
    });
  });
  tex.refresh();
  for (let i = 0; i < total; i++) {
    tex.add(i, 0, i * CHAR.FRAME_WIDTH, 0, CHAR.FRAME_WIDTH, CHAR.FRAME_HEIGHT);
  }
}

// Leg Y positions for a given walk step (shared by body + outfit so they sync).
function legYs(step) {
  return [12 + (step === 1 ? -1 : 0), 12 + (step === -1 ? -1 : 0)];
}

// Body: head + skin torso + legs + facing eyes. `fem` gives a slightly narrower
// frame; otherwise identical. Drawn in white-ish skin so a tint can recolor it.
function makeBodyDrawer(body) {
  const narrow = body === 'fem';
  return (ctx, ox, oy, dir, step) => {
    const skin = PALETTE.skin;
    const shadow = PALETTE.skinShadow;
    const eye = 0x101010;
    const torsoX = narrow ? 6 : 5;
    const torsoW = narrow ? 4 : 6;
    // torso (bare; outfit layer covers it)
    px(ctx, ox, oy, torsoX, 7, skin, torsoW, 5);
    // head
    px(ctx, ox, oy, 5, 2, skin, 6, 5);
    px(ctx, ox, oy, 5, 6, shadow, 6, 1); // neck shade
    // legs
    const [ly1, ly2] = legYs(step);
    px(ctx, ox, oy, 5, ly1, shadow, 2, 3);
    px(ctx, ox, oy, 9, ly2, shadow, 2, 3);
    // eyes per facing
    if (dir === 'down') {
      px(ctx, ox, oy, 6, 4, eye, 1, 1);
      px(ctx, ox, oy, 9, 4, eye, 1, 1);
    } else if (dir === 'left') {
      px(ctx, ox, oy, 6, 4, eye, 1, 1);
    } else if (dir === 'right') {
      px(ctx, ox, oy, 9, 4, eye, 1, 1);
    }
    // up: no eyes (back of head)
  };
}

// Hair overlay: just the hair, white so it can be tinted to any hair color.
// `style` slightly varies the silhouette. Drawn on its own transparent sheet.
function makeHairDrawer(style) {
  return (ctx, ox, oy, dir) => {
    const hair = 0xffffff; // tinted at runtime
    // base cap
    px(ctx, ox, oy, 5, 1, hair, 6, 2);
    px(ctx, ox, oy, 4, 1, hair, 1, 2);
    px(ctx, ox, oy, 11, 1, hair, 1, 2);
    if (style % 3 === 1) {
      // longer: sides down past the ears
      px(ctx, ox, oy, 4, 3, hair, 1, 3);
      px(ctx, ox, oy, 11, 3, hair, 1, 3);
    }
    if (style % 3 === 2) {
      // spiky top
      px(ctx, ox, oy, 6, 0, hair, 1, 1);
      px(ctx, ox, oy, 9, 0, hair, 1, 1);
    }
    if (dir === 'up') {
      // full back of head
      px(ctx, ox, oy, 5, 2, hair, 6, 3);
    } else if (dir === 'left') {
      px(ctx, ox, oy, 5, 3, hair, 2, 1);
    } else if (dir === 'right') {
      px(ctx, ox, oy, 9, 3, hair, 2, 1);
    }
  };
}

// Outfit overlay: shirt over torso + shoes, white so it tints to any color.
// Variant changes the shirt cut so different outfit indices look different.
function makeOutfitDrawer(variant) {
  return (ctx, ox, oy, dir, step) => {
    const c = 0xffffff; // tinted at runtime
    // shirt over the torso
    px(ctx, ox, oy, 5, 7, c, 6, 5);
    if (variant === 1) px(ctx, ox, oy, 5, 7, 0xdddddd, 6, 1); // collar shade
    if (variant === 2) px(ctx, ox, oy, 7, 7, 0xdddddd, 2, 5); // jacket seam
    // shoes at the feet
    const [ly1, ly2] = legYs(step);
    px(ctx, ox, oy, 5, ly1 + 2, 0xdddddd, 2, 1);
    px(ctx, ox, oy, 9, ly2 + 2, 0xdddddd, 2, 1);
  };
}

// Build all character layer sheets. We bake one body sheet per body type under
// keyed names, plus a hair sheet per style and an outfit sheet per variant, so
// CharacterSprite can pick the right frames by appearance.
export function generateCharacter(scene) {
  // Bodies
  buildCharSheet(scene, 'char_body_masc', makeBodyDrawer('masc'));
  buildCharSheet(scene, 'char_body_fem', makeBodyDrawer('fem'));
  // Hair styles 0..7 (silhouettes cycle every 3; color applied via tint)
  for (let s = 0; s < 8; s++) buildCharSheet(scene, 'char_hair_' + s, makeHairDrawer(s));
  // Outfit variants 0..2 (casual cuts; color applied via tint)
  for (let v = 0; v < 3; v++) buildCharSheet(scene, 'char_outfit_' + v, makeOutfitDrawer(v));
}
