// ---------------------------------------------------------------------------
// Procedural art generator (Phaser 4 canvas textures) - the SELF-AUTHORED art
// pipeline. Every visual asset in the game is drawn here in code from a shared
// palette. No external/downloaded art (MA.06.12.01 Part 0.A).
//
// The character is a 4-LAYER paper doll, each layer a 4-dir x 3-frame sheet:
//   body  -> skin + head + eyes      (tinted by face)
//   bottoms -> TROUSERS + shoes      (tinted by outfit)
//   top   -> shirt/jacket            (tinted by outfit)
//   hair  -> hairstyle               (tinted by hair color)
// Layers are drawn white so a tint fully recolors them.
//
// generate(scene, genId, key) dispatches by the manifest's `gen` id. Item icons
// are drawn on demand via generateItemIcons() into one atlas keyed by item id.
// ---------------------------------------------------------------------------
import { TILE_SIZE, TILE_COUNT, TILES, CHAR, PALETTE } from '../config.js';
import { ITEMS, ICON_MATERIALS } from '../data/items.js';

function css(hex) {
  return '#' + (hex >>> 0).toString(16).padStart(6, '0').slice(-6);
}
function px(ctx, ox, oy, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = css(color);
  ctx.fillRect(ox + x, oy + y, w, h);
}
function newCanvas(scene, key, w, h) {
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  return { tex, ctx };
}

// =========================================================================
// TILES
// =========================================================================
function drawGrass(c, o, p) {
  px(c, o, p, 0, 0, PALETTE.grass, 16, 16);
  [[3, 4], [10, 2], [6, 9], [13, 11], [2, 12], [8, 6]].forEach(([x, y]) => px(c, o, p, x, y, PALETTE.grassDark, 1, 2));
}
function drawRoad(c, o, p) {
  px(c, o, p, 0, 0, PALETTE.road, 16, 16);
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
  [TILES.GRASS]: drawGrass, [TILES.ROAD]: drawRoad, [TILES.SIDEWALK]: drawSidewalk,
  [TILES.WATER]: drawWater, [TILES.TREE]: drawTree, [TILES.PLAZA]: drawPlaza,
  [TILES.WALL]: drawWall, [TILES.CROSSWALK]: drawCrosswalk, [TILES.PLANTER]: drawPlanter,
};
function genTiles(scene, key) {
  const { tex, ctx } = newCanvas(scene, key, TILE_COUNT * TILE_SIZE, TILE_SIZE);
  for (let i = 0; i < TILE_COUNT; i++) (TILE_DRAWERS[i] || drawGrass)(ctx, i * TILE_SIZE, 0);
  tex.refresh();
  // Register per-tile frames so individual tiles can also be used as sprites
  // (e.g. Y-sorted tree sprites for depth/occlusion).
  for (let i = 0; i < TILE_COUNT; i++) tex.add(i, 0, i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
}

// =========================================================================
// CHARACTER LAYERS (4 dir x 3 frames). Walk a frame grid + register frames.
// =========================================================================
function buildCharSheet(scene, key, drawFn) {
  const dirs = ['down', 'left', 'right', 'up'];
  const steps = [0, 1, -1]; // idle, stepA, stepB
  const total = dirs.length * steps.length;
  const { tex, ctx } = newCanvas(scene, key, total * CHAR.FRAME_WIDTH, CHAR.FRAME_HEIGHT);
  let f = 0;
  dirs.forEach((dir) => steps.forEach((step) => { drawFn(ctx, f * CHAR.FRAME_WIDTH, 0, dir, step); f++; }));
  tex.refresh();
  for (let i = 0; i < total; i++) tex.add(i, 0, i * CHAR.FRAME_WIDTH, 0, CHAR.FRAME_WIDTH, CHAR.FRAME_HEIGHT);
}
// Leg vertical offset per walk step (shared so bottoms + body align).
function legYs(step) {
  return [12 + (step === 1 ? -1 : 0), 12 + (step === -1 ? -1 : 0)];
}

// BODY: head + skin torso + bare legs + eyes. Drawn in skin so face-tint works.
function bodyDrawer(bodyType) {
  const narrow = bodyType === 'fem';
  return (ctx, ox, oy, dir, step) => {
    const skin = 0xffffff; // tinted by face
    const shade = 0xdddddd;
    const eye = 0x202020;
    const tx = narrow ? 6 : 5;
    const tw = narrow ? 4 : 6;
    px(ctx, ox, oy, tx, 7, skin, tw, 5); // torso (covered by top)
    px(ctx, ox, oy, 5, 2, skin, 6, 5); // head
    px(ctx, ox, oy, 5, 6, shade, 6, 1); // neck shade
    const [ly1, ly2] = legYs(step); // bare legs (covered by bottoms)
    px(ctx, ox, oy, 5, ly1, skin, 2, 3);
    px(ctx, ox, oy, 9, ly2, skin, 2, 3);
    if (dir === 'down') { px(ctx, ox, oy, 6, 4, eye, 1, 1); px(ctx, ox, oy, 9, 4, eye, 1, 1); }
    else if (dir === 'left') px(ctx, ox, oy, 6, 4, eye, 1, 1);
    else if (dir === 'right') px(ctx, ox, oy, 9, 4, eye, 1, 1);
  };
}

// BOTTOMS: TROUSERS over the legs + shoes. White -> tinted by outfit.
// THIS is the fix for Bug 1: the previous build had no trousers layer, so the
// skin legs showed through. Now trousers fully cover the legs in all 4 dirs.
function bottomsDrawer(variant) {
  return (ctx, ox, oy, dir, step) => {
    const cloth = 0xffffff; // tinted
    const shoe = 0xcccccc;
    const [ly1, ly2] = legYs(step);
    // waistband
    px(ctx, ox, oy, 5, 11, cloth, 6, 1);
    // trouser legs (cover the body's skin legs, slightly taller)
    px(ctx, ox, oy, 5, ly1, cloth, 2, 3);
    px(ctx, ox, oy, 9, ly2, cloth, 2, 3);
    // variant 0 = shorts (shorter), others full-length seam detail
    if (variant === 1) { px(ctx, ox, oy, 6, ly1, shoe, 1, 3); px(ctx, ox, oy, 9, ly2, shoe, 1, 3); }
    if (variant === 2) px(ctx, ox, oy, 5, 13, shoe, 6, 1); // cuff line
    // shoes at the very bottom
    px(ctx, ox, oy, 5, ly1 + 3, shoe, 2, 1);
    px(ctx, ox, oy, 9, ly2 + 3, shoe, 2, 1);
  };
}

// TOP: shirt/jacket over the torso. White -> tinted by outfit.
function topDrawer(variant) {
  return (ctx, ox, oy, dir, step) => {
    const cloth = 0xffffff;
    const shade = 0xdddddd;
    px(ctx, ox, oy, 5, 7, cloth, 6, 5); // torso shirt
    // sleeves nudge with the step for a hint of motion
    const [ly1, ly2] = legYs(step);
    px(ctx, ox, oy, 4, 7, cloth, 1, 3 + (ly1 === 11 ? 0 : 0));
    px(ctx, ox, oy, 11, 7, cloth, 1, 3);
    if (variant === 1) px(ctx, ox, oy, 5, 7, shade, 6, 1); // collar
    if (variant === 2) px(ctx, ox, oy, 7, 7, shade, 2, 5); // jacket zipper
    if (variant === 3) { px(ctx, ox, oy, 5, 9, shade, 6, 1); } // stripe
    void ly2;
  };
}

// HAIR: hairstyle silhouette. White -> tinted by hair color.
function hairDrawer(style) {
  return (ctx, ox, oy, dir) => {
    const hair = 0xffffff;
    px(ctx, ox, oy, 5, 1, hair, 6, 2);
    px(ctx, ox, oy, 4, 1, hair, 1, 2);
    px(ctx, ox, oy, 11, 1, hair, 1, 2);
    if (style % 4 === 1) { px(ctx, ox, oy, 4, 3, hair, 1, 3); px(ctx, ox, oy, 11, 3, hair, 1, 3); } // long sides
    if (style % 4 === 2) { px(ctx, ox, oy, 6, 0, hair, 1, 1); px(ctx, ox, oy, 9, 0, hair, 1, 1); } // spiky
    if (style % 4 === 3) { px(ctx, ox, oy, 5, 0, hair, 6, 1); } // flat top
    if (style >= 4) px(ctx, ox, oy, 4, 2, hair, 8, 1); // fuller variant
    if (dir === 'up') px(ctx, ox, oy, 5, 2, hair, 6, 3);
    else if (dir === 'left') px(ctx, ox, oy, 5, 3, hair, 2, 1);
    else if (dir === 'right') px(ctx, ox, oy, 9, 3, hair, 2, 1);
  };
}

// =========================================================================
// PROPS / FX (single textures)
// =========================================================================
function genShadow(scene, key) {
  const { tex, ctx } = newCanvas(scene, key, 16, 8);
  // soft ellipse: concentric translucent rings
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(8, 4, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath(); ctx.ellipse(8, 4, 7, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  tex.refresh();
}
function genDog(scene, key) {
  // A small dog as a 4-dir x 3-frame sheet so it can face + trot.
  buildCharSheet(scene, key, (ctx, ox, oy, dir, step) => {
    const fur = 0xb5824a, dark = 0x8a6035, nose = 0x202020;
    const bob = step === 1 ? -1 : 0;
    px(ctx, ox, oy, 4, 9 + bob, fur, 8, 4); // body
    px(ctx, ox, oy, 3, 10 + bob, dark, 1, 3); // tail
    // head by facing
    if (dir === 'down') { px(ctx, ox, oy, 6, 6 + bob, fur, 4, 4); px(ctx, ox, oy, 7, 8 + bob, nose, 2, 1); }
    else if (dir === 'up') px(ctx, ox, oy, 6, 6 + bob, dark, 4, 4);
    else if (dir === 'left') { px(ctx, ox, oy, 3, 7 + bob, fur, 4, 4); px(ctx, ox, oy, 3, 9 + bob, nose, 1, 1); }
    else { px(ctx, ox, oy, 9, 7 + bob, fur, 4, 4); px(ctx, ox, oy, 12, 9 + bob, nose, 1, 1); }
    px(ctx, ox, oy, 5, 12, dark, 1, 2); // legs
    px(ctx, ox, oy, 10, 12, dark, 1, 2);
  });
}
function genRaindrop(scene, key) {
  const { tex, ctx } = newCanvas(scene, key, 2, 6);
  px(ctx, 0, 0, 0, 0, 0xaad4ff, 1, 6);
  px(ctx, 0, 0, 1, 1, 0xcce6ff, 1, 4);
  tex.refresh();
}
function genDust(scene, key) {
  const { tex, ctx } = newCanvas(scene, key, 4, 4);
  ctx.fillStyle = 'rgba(220,210,190,0.9)';
  ctx.beginPath(); ctx.arc(2, 2, 1.6, 0, Math.PI * 2); ctx.fill();
  tex.refresh();
}
function genLeaf(scene, key) {
  const { tex, ctx } = newCanvas(scene, key, 4, 4);
  px(ctx, 0, 0, 1, 0, 0x3f8a33, 2, 1);
  px(ctx, 0, 0, 0, 1, 0x4f9c3f, 4, 2);
  px(ctx, 0, 0, 1, 3, 0x3f8a33, 2, 1);
  tex.refresh();
}
function genPoop(scene, key) {
  const { tex, ctx } = newCanvas(scene, key, 8, 8);
  px(ctx, 0, 0, 2, 4, 0x5a3a1a, 4, 2);
  px(ctx, 0, 0, 3, 2, 0x6b4423, 2, 2);
  px(ctx, 0, 0, 3, 1, 0x6b4423, 1, 1);
  // tiny stink marks
  px(ctx, 0, 0, 1, 0, 0x9c8, 1, 1); px(ctx, 0, 0, 6, 1, 0x9c8, 1, 1);
  tex.refresh();
}
function genPrompt(scene, key) {
  // A small rounded key-bubble with an "E", the polished interaction prompt.
  const { tex, ctx } = newCanvas(scene, key, 14, 16);
  // bubble
  ctx.fillStyle = css(PALETTE.accent);
  ctx.fillRect(1, 1, 12, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(2, 2, 10, 10);
  ctx.fillStyle = css(PALETTE.accent);
  // letter E
  px(ctx, 0, 0, 4, 4, 0xffffff, 5, 1);
  px(ctx, 0, 0, 4, 6, 0xffffff, 4, 1);
  px(ctx, 0, 0, 4, 8, 0xffffff, 5, 1);
  px(ctx, 0, 0, 4, 4, 0xffffff, 1, 5);
  // little pointer tail at the bottom
  ctx.fillStyle = css(PALETTE.accent);
  ctx.fillRect(6, 13, 2, 2);
  tex.refresh();
}
function genSpark(scene, key) {
  const { tex, ctx } = newCanvas(scene, key, 4, 4);
  ctx.fillStyle = css(PALETTE.accent);
  px(ctx, 0, 0, 1, 0, PALETTE.accent, 2, 4);
  px(ctx, 0, 0, 0, 1, PALETTE.accent, 4, 2);
  tex.refresh();
}

// =========================================================================
// DISPATCH
// =========================================================================
// =========================================================================
// ITEM ICONS - one 16x16 icon per findable item, drawn from shape+material.
// Produced as a single atlas texture (key 'items'); each item id becomes a
// named frame so an Image can do scene.add.image(x,y,'items', itemId).
// =========================================================================
function shadeOf(hex, f) {
  const r = Math.min(255, Math.max(0, ((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (hex & 255) * f));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// Per-shape drawer. (ox,oy) is the icon's top-left in the atlas.
function drawIcon(ctx, ox, oy, shape, base) {
  const dk = shadeOf(base, 0.65);
  const lt = shadeOf(base, 1.25);
  const outline = 0x141018;
  const O = (x, y, w, h, c) => px(ctx, ox, oy, x, y, c, w, h);
  switch (shape) {
    case 'box':
      O(3, 4, 10, 9, base); O(3, 4, 10, 1, lt); O(3, 12, 10, 1, dk); O(7, 4, 1, 9, dk);
      O(2, 3, 12, 1, outline); O(2, 13, 12, 1, outline); O(2, 4, 1, 9, outline); O(13, 4, 1, 9, outline); break;
    case 'bottle':
      O(6, 2, 4, 2, lt); O(5, 4, 6, 10, base); O(5, 4, 1, 10, dk); O(10, 4, 1, 10, lt);
      O(5, 2, 1, 12, outline); O(10, 2, 1, 12, outline); O(5, 13, 6, 1, outline); break;
    case 'phone':
      O(4, 2, 8, 12, dk); O(5, 3, 6, 9, lt); O(5, 3, 6, 9, base); O(6, 12, 4, 1, lt);
      O(4, 2, 8, 1, outline); O(4, 13, 8, 1, outline); O(4, 2, 1, 12, outline); O(11, 2, 1, 12, outline); break;
    case 'ring':
      O(5, 5, 6, 6, base); O(6, 6, 4, 4, 0x000000); O(7, 3, 2, 2, lt); // gem on top
      O(5, 5, 6, 1, lt); O(5, 10, 6, 1, dk); break;
    case 'watch':
      O(6, 2, 4, 2, dk); O(6, 12, 4, 2, dk); O(4, 4, 8, 8, base); O(6, 6, 4, 4, lt);
      O(4, 4, 8, 1, outline); O(4, 11, 8, 1, outline); break;
    case 'disc':
      O(3, 6, 10, 4, base); O(4, 5, 8, 1, lt); O(4, 10, 8, 1, dk); O(7, 7, 2, 2, 0x202020); break;
    case 'book':
      O(3, 3, 10, 11, base); O(3, 3, 2, 11, dk); O(5, 4, 7, 1, lt); O(5, 6, 6, 1, lt);
      O(2, 3, 1, 11, outline); O(13, 3, 1, 11, outline); O(3, 2, 10, 1, outline); break;
    case 'can':
      O(5, 3, 6, 10, base); O(5, 3, 6, 1, lt); O(5, 12, 6, 1, dk); O(5, 6, 6, 1, dk);
      O(5, 3, 1, 10, outline); O(10, 3, 1, 10, outline); break;
    case 'cup':
      O(4, 4, 7, 8, base); O(11, 6, 2, 3, base); O(4, 4, 7, 1, lt); O(4, 11, 7, 1, dk);
      O(4, 4, 1, 8, outline); O(10, 4, 1, 8, outline); break;
    case 'tool':
      O(7, 2, 2, 8, base); O(5, 9, 6, 4, dk); O(7, 2, 1, 8, lt); O(5, 9, 6, 1, lt); break;
    case 'shoe':
      O(3, 8, 11, 4, base); O(3, 11, 11, 1, dk); O(3, 8, 6, 1, lt); O(9, 6, 3, 3, base);
      O(3, 12, 11, 1, outline); break;
    case 'ball':
      O(5, 5, 6, 6, base); O(6, 4, 4, 1, lt); O(6, 11, 4, 1, dk); O(4, 6, 1, 4, dk); O(11, 6, 1, 4, lt); break;
    case 'gem':
      O(7, 3, 2, 2, lt); O(5, 5, 6, 3, base); O(6, 8, 4, 3, dk); O(7, 11, 2, 1, dk); O(6, 5, 1, 3, lt); break;
    case 'card':
      O(3, 4, 10, 8, base); O(3, 4, 10, 1, lt); O(3, 11, 10, 1, dk); O(5, 6, 6, 1, lt); O(5, 8, 4, 1, lt);
      O(2, 3, 12, 1, outline); O(2, 12, 12, 1, outline); break;
    case 'key':
      O(4, 5, 4, 4, base); O(5, 6, 2, 2, 0x000000); O(8, 6, 5, 2, base); O(11, 8, 1, 2, base); O(9, 8, 1, 2, base); break;
    case 'bulb':
      O(5, 3, 6, 6, lt); O(6, 9, 4, 2, dk); O(6, 11, 4, 1, base); O(6, 4, 2, 2, 0xffffff); break;
    default:
      O(4, 4, 8, 8, base);
  }
}

export function generateItemIcons(scene, key = 'items') {
  if (scene.textures.exists(key)) return;
  const sz = 16;
  const cols = 8;
  const rows = Math.ceil(ITEMS.length / cols);
  const { tex, ctx } = newCanvas(scene, key, cols * sz, rows * sz);
  ITEMS.forEach((item, i) => {
    const ox = (i % cols) * sz;
    const oy = Math.floor(i / cols) * sz;
    const base = ICON_MATERIALS[item.material] || 0xb0b6c0;
    drawIcon(ctx, ox, oy, item.shape, base);
  });
  tex.refresh();
  // Register a named frame per item id.
  ITEMS.forEach((item, i) => {
    const ox = (i % cols) * sz;
    const oy = Math.floor(i / cols) * sz;
    tex.add(item.id, 0, ox, oy, sz, sz);
  });
}

export function generate(scene, genId, key) {
  if (scene.textures.exists(key)) return; // already generated
  if (genId === 'tiles') return genTiles(scene, key);
  if (genId.startsWith('body:')) return buildCharSheet(scene, key, bodyDrawer(genId.split(':')[1]));
  if (genId.startsWith('bottoms:')) return buildCharSheet(scene, key, bottomsDrawer(+genId.split(':')[1]));
  if (genId.startsWith('top:')) return buildCharSheet(scene, key, topDrawer(+genId.split(':')[1]));
  if (genId.startsWith('hair:')) return buildCharSheet(scene, key, hairDrawer(+genId.split(':')[1]));
  if (genId === 'shadow') return genShadow(scene, key);
  if (genId === 'dog') return genDog(scene, key);
  if (genId === 'raindrop') return genRaindrop(scene, key);
  if (genId === 'dust') return genDust(scene, key);
  if (genId === 'leaf') return genLeaf(scene, key);
  if (genId === 'poop') return genPoop(scene, key);
  if (genId === 'prompt') return genPrompt(scene, key);
  if (genId === 'spark') return genSpark(scene, key);
  if (genId === 'items') return generateItemIcons(scene, key);
  console.warn('Unknown gen id:', genId);
}
