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
import Phaser from 'phaser';
import { TILE_SIZE, TILE_COUNT, TILES, CHAR, PALETTE } from '../config.js';
import { ITEMS, ICON_MATERIALS } from '../data/items.js';
import { OUTLINE, shade, light } from './styleGuide.js';

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
  // Force NEAREST filtering so scaled-up pixel art stays crisp, never blurry
  // (style-guide rule 5; pixelArt:true covers most cases but canvas textures
  // can default to LINEAR - set it explicitly at the source).
  if (tex.setFilter) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
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

// Leg vertical offset per walk step (shared so bottoms + body align).
function legYs(step) {
  return [12 + (step === 1 ? -1 : 0), 12 + (step === -1 ? -1 : 0)];
}

// =========================================================================
// CHARACTER - COMPOSITE PAPER DOLL (P.1 root-cause fix).
//
// Root cause of the recurring "character breaks apart" bug: the layers were
// SEPARATE sprite objects repositioned/frame-copied in preUpdate, which runs
// BEFORE the physics step moves the body - so overlays rendered at the body's
// previous position and visibly detached on a real GPU.
//
// Fix: bake body + bottoms + top + hair into ONE 12-frame spritesheet per
// appearance and animate a single sprite. One object, one position, one frame
// set -> separation is structurally impossible. These color-aware drawers paint
// directly with the final colors (no runtime tint), composited in order.
// =========================================================================

// BODY: head + skin torso + bare legs (covered by clothes) + facing eyes.
function drawBody(ctx, ox, oy, dir, step, c) {
  const skin = c.skin;
  const sh = shade(skin, 0.82);
  const hi = light(skin, 1.1);
  const eye = 0x241c28;
  const narrow = c.bodyType === 'fem';
  const tx = narrow ? 6 : 5;
  const tw = narrow ? 4 : 6;
  // torso (mostly covered by the top)
  px(ctx, ox, oy, tx, 7, skin, tw, 5);
  // head with a touch of shading
  px(ctx, ox, oy, 5, 2, skin, 6, 5);
  px(ctx, ox, oy, 5, 2, hi, 6, 1);
  px(ctx, ox, oy, 5, 6, sh, 6, 1); // neck shade
  // bare legs (covered by bottoms)
  const [ly1, ly2] = legYs(step);
  px(ctx, ox, oy, 5, ly1, skin, 2, 3);
  px(ctx, ox, oy, 9, ly2, skin, 2, 3);
  // facing eyes
  if (dir === 'down') { px(ctx, ox, oy, 6, 4, eye, 1, 1); px(ctx, ox, oy, 9, 4, eye, 1, 1); }
  else if (dir === 'left') px(ctx, ox, oy, 6, 4, eye, 1, 1);
  else if (dir === 'right') px(ctx, ox, oy, 9, 4, eye, 1, 1);
  // up: back of head, no eyes
}

// BOTTOMS: trousers/shorts over the legs + shoes, with shading + a seam.
function drawBottoms(ctx, ox, oy, dir, step, c) {
  const cloth = c.color;
  const sh = shade(cloth, 0.72);
  const shoe = shade(cloth, 0.5);
  const [ly1, ly2] = legYs(step);
  px(ctx, ox, oy, 5, 11, cloth, 6, 1); // waistband
  const legH = c.variant === 0 ? 2 : 3; // variant 0 = shorts
  px(ctx, ox, oy, 5, ly1, cloth, 2, legH);
  px(ctx, ox, oy, 9, ly2, cloth, 2, legH);
  px(ctx, ox, oy, 8, ly1, sh, 1, legH); // inseam shadow
  // shoes at the feet
  px(ctx, ox, oy, 5, ly1 + legH, shoe, 2, 1);
  px(ctx, ox, oy, 9, ly2 + legH, shoe, 2, 1);
}

// TOP: shirt/jacket over the torso, with sleeves, collar/zip per variant.
function drawTop(ctx, ox, oy, dir, step, c) {
  const cloth = c.color;
  const sh = shade(cloth, 0.72);
  const hi = light(cloth, 1.18);
  px(ctx, ox, oy, 5, 7, cloth, 6, 5); // torso shirt
  px(ctx, ox, oy, 5, 7, hi, 6, 1); // shoulder highlight
  px(ctx, ox, oy, 4, 7, cloth, 1, 4); // sleeves
  px(ctx, ox, oy, 11, 7, cloth, 1, 4);
  px(ctx, ox, oy, 5, 11, sh, 6, 1); // hem shadow
  if (c.variant === 1) px(ctx, ox, oy, 7, 7, sh, 2, 1); // collar
  if (c.variant === 2) px(ctx, ox, oy, 7, 7, sh, 1, 5); // jacket zip
  if (c.variant === 3) px(ctx, ox, oy, 5, 9, hi, 6, 1); // stripe
  void step;
}

// HAIR: hairstyle silhouette with shading.
function drawHair(ctx, ox, oy, dir, c) {
  const hair = c.color;
  const sh = shade(hair, 0.72);
  const hi = light(hair, 1.2);
  px(ctx, ox, oy, 5, 1, hair, 6, 2);
  px(ctx, ox, oy, 4, 1, hair, 1, 2);
  px(ctx, ox, oy, 11, 1, hair, 1, 2);
  px(ctx, ox, oy, 5, 1, hi, 6, 1); // top sheen
  const style = c.style;
  if (style % 4 === 1) { px(ctx, ox, oy, 4, 3, hair, 1, 3); px(ctx, ox, oy, 11, 3, hair, 1, 3); } // long sides
  if (style % 4 === 2) { px(ctx, ox, oy, 6, 0, hair, 1, 1); px(ctx, ox, oy, 9, 0, hair, 1, 1); } // spiky
  if (style % 4 === 3) px(ctx, ox, oy, 5, 0, hair, 6, 1); // flat top
  if (style >= 4) px(ctx, ox, oy, 4, 2, hair, 8, 1); // fuller
  if (dir === 'up') px(ctx, ox, oy, 5, 2, hair, 6, 3); // back of head
  else if (dir === 'left') { px(ctx, ox, oy, 5, 3, hair, 2, 1); px(ctx, ox, oy, 5, 4, sh, 1, 1); }
  else if (dir === 'right') { px(ctx, ox, oy, 9, 3, hair, 2, 1); px(ctx, ox, oy, 10, 4, sh, 1, 1); }
}

// Build ONE composited 12-frame character sheet from a resolved color set.
// colors: { skin, bodyType, bottoms:{color,variant}, top:{color,variant},
//           hair:{color,style} }
export function generateCharacterComposite(scene, key, colors) {
  if (scene.textures.exists(key)) return key;
  const dirs = ['down', 'left', 'right', 'up'];
  const steps = [0, 1, -1];
  const total = dirs.length * steps.length;
  const { tex, ctx } = newCanvas(scene, key, total * CHAR.FRAME_WIDTH, CHAR.FRAME_HEIGHT);
  let f = 0;
  dirs.forEach((dir) => steps.forEach((step) => {
    const ox = f * CHAR.FRAME_WIDTH;
    // Draw in order: body, bottoms, top, hair - all into the SAME frame.
    drawBody(ctx, ox, 0, dir, step, { skin: colors.skin, bodyType: colors.bodyType });
    drawBottoms(ctx, ox, 0, dir, step, colors.bottoms);
    drawTop(ctx, ox, 0, dir, step, colors.top);
    drawHair(ctx, ox, 0, dir, colors.hair);
    f++;
  }));
  tex.refresh();
  for (let i = 0; i < total; i++) tex.add(i, 0, i * CHAR.FRAME_WIDTH, 0, CHAR.FRAME_WIDTH, CHAR.FRAME_HEIGHT);
  return key;
}

// Legacy per-layer sheet builder retained ONLY for the dog (single-texture
// animal, no layering) and any non-composited use.
function buildCharSheet(scene, key, drawFn) {
  const dirs = ['down', 'left', 'right', 'up'];
  const steps = [0, 1, -1];
  const total = dirs.length * steps.length;
  const { tex, ctx } = newCanvas(scene, key, total * CHAR.FRAME_WIDTH, CHAR.FRAME_HEIGHT);
  let f = 0;
  dirs.forEach((dir) => steps.forEach((step) => { drawFn(ctx, f * CHAR.FRAME_WIDTH, 0, dir, step); f++; }));
  tex.refresh();
  for (let i = 0; i < total; i++) tex.add(i, 0, i * CHAR.FRAME_WIDTH, 0, CHAR.FRAME_WIDTH, CHAR.FRAME_HEIGHT);
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
// ITEM ICONS - one 32x32 icon per findable item, drawn from shape+material to
// the style guide (3-tone shade ramp, upper-left light, single silhouette
// outline). Higher res than the 16px world sprites because icons are plain
// images (no physics frame grid). Produced as one atlas (key 'items'); each
// item id becomes a named frame for scene.add.image(x,y,'items', itemId).
// =========================================================================
const ICON_SZ = 32;

// Rounded-rect-ish fill with a top-left light band and bottom-right shade band,
// then a 1px outline around the given bounds. The workhorse for most shapes.
function panel(ctx, ox, oy, x, y, w, h, base) {
  const dk = shade(base, 0.68);
  const lt = light(base, 1.22);
  px(ctx, ox, oy, x, y, base, w, h);
  px(ctx, ox, oy, x, y, lt, w, 2); // top light
  px(ctx, ox, oy, x, y, lt, 2, h); // left light
  px(ctx, ox, oy, x, y + h - 2, dk, w, 2); // bottom shade
  px(ctx, ox, oy, x + w - 2, y, dk, 2, h); // right shade
  outlineRect(ctx, ox, oy, x, y, w, h);
}
function outlineRect(ctx, ox, oy, x, y, w, h) {
  px(ctx, ox, oy, x, y - 1, OUTLINE, w, 1);
  px(ctx, ox, oy, x, y + h, OUTLINE, w, 1);
  px(ctx, ox, oy, x - 1, y, OUTLINE, 1, h);
  px(ctx, ox, oy, x + w, y, OUTLINE, 1, h);
}
function disc(ctx, ox, oy, cx, cy, r, base) {
  const dk = shade(base, 0.68);
  const lt = light(base, 1.22);
  ctx.fillStyle = css(OUTLINE);
  ctx.beginPath(); ctx.arc(ox + cx, oy + cy, r + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css(base);
  ctx.beginPath(); ctx.arc(ox + cx, oy + cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css(dk);
  ctx.beginPath(); ctx.arc(ox + cx + r * 0.25, oy + cy + r * 0.3, r * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css(base);
  ctx.beginPath(); ctx.arc(ox + cx, oy + cy, r * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css(lt);
  ctx.beginPath(); ctx.arc(ox + cx - r * 0.3, oy + cy - r * 0.35, r * 0.28, 0, Math.PI * 2); ctx.fill();
}

// Per-shape drawer at 32px. (ox,oy) is the icon's top-left in the atlas.
function drawIcon(ctx, ox, oy, shape, base) {
  const dk = shade(base, 0.6);
  const lt = light(base, 1.3);
  const P = (x, y, w, h, c) => px(ctx, ox, oy, x, y, c, w, h);
  switch (shape) {
    case 'box':
      panel(ctx, ox, oy, 6, 9, 20, 16, base);
      P(6, 16, 20, 1, dk); P(15, 9, 2, 16, shade(base, 0.8)); // tape seams
      break;
    case 'bottle':
      P(13, 3, 6, 4, dk); // cap
      panel(ctx, ox, oy, 11, 7, 10, 22, base);
      P(13, 11, 6, 6, lt); // label highlight
      break;
    case 'phone':
      panel(ctx, ox, oy, 9, 3, 14, 26, shade(base, 0.5));
      P(11, 6, 10, 18, lt); P(11, 6, 10, 18, base); // screen
      P(13, 8, 6, 2, light(base, 1.5)); // screen glint
      disc(ctx, ox, oy, 16, 26, 1.5, dk); break;
    case 'ring': {
      const gold = base;
      ctx.fillStyle = css(OUTLINE);
      ctx.beginPath(); ctx.arc(ox + 16, oy + 20, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = css(gold);
      ctx.beginPath(); ctx.arc(ox + 16, oy + 20, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = css(shade(0x0a0a12, 1));
      ctx.beginPath(); ctx.arc(ox + 16, oy + 20, 5, 0, Math.PI * 2); ctx.fill();
      P(13, 6, 6, 6, lt); outlineRect(ctx, ox, oy, 13, 6, 6, 6); // gem
      P(14, 7, 2, 2, 0xffffff); break;
    }
    case 'watch':
      P(13, 2, 6, 6, dk); P(13, 24, 6, 6, dk); // straps
      disc(ctx, ox, oy, 16, 16, 9, base);
      P(15, 10, 2, 6, OUTLINE); P(16, 16, 5, 2, OUTLINE); break; // hands
    case 'disc':
      disc(ctx, ox, oy, 16, 16, 12, base);
      disc(ctx, ox, oy, 16, 16, 3, 0x2a2a32); break;
    case 'book':
      panel(ctx, ox, oy, 7, 5, 18, 22, base);
      P(7, 5, 4, 22, dk); // spine
      P(13, 9, 9, 1, lt); P(13, 12, 8, 1, lt); P(13, 15, 9, 1, lt); break;
    case 'can':
      panel(ctx, ox, oy, 10, 5, 12, 22, base);
      P(10, 5, 12, 2, lt); P(10, 25, 12, 2, dk); P(10, 12, 12, 1, shade(base, 0.85)); break;
    case 'cup':
      panel(ctx, ox, oy, 8, 8, 14, 16, base);
      P(22, 12, 4, 7, base); outlineRect(ctx, ox, oy, 22, 12, 4, 7); // handle
      P(10, 10, 10, 2, lt); break;
    case 'tool':
      P(14, 4, 4, 16, base); P(14, 4, 2, 16, lt); // shaft
      panel(ctx, ox, oy, 10, 18, 12, 8, dk); // head
      outlineRect(ctx, ox, oy, 14, 4, 4, 16); break;
    case 'shoe':
      panel(ctx, ox, oy, 5, 16, 22, 8, base);
      P(5, 22, 22, 2, dk); // sole
      P(18, 11, 8, 6, base); outlineRect(ctx, ox, oy, 18, 11, 8, 6); // ankle
      P(8, 16, 8, 2, lt); break;
    case 'ball':
      disc(ctx, ox, oy, 16, 16, 11, base);
      P(8, 14, 16, 1, dk); P(16, 6, 1, 20, shade(base, 0.85)); break;
    case 'gem':
      P(11, 8, 10, 4, lt); P(9, 12, 14, 6, base); P(12, 18, 8, 6, dk); P(15, 24, 2, 2, dk);
      P(11, 12, 2, 6, lt); outlineRect(ctx, ox, oy, 9, 8, 14, 18); break;
    case 'card':
      panel(ctx, ox, oy, 6, 8, 20, 16, base);
      P(9, 12, 14, 2, lt); P(9, 16, 10, 1, lt); P(9, 19, 12, 1, lt); break;
    case 'key': {
      disc(ctx, ox, oy, 11, 12, 6, base);
      disc(ctx, ox, oy, 11, 12, 2.5, 0x0a0a12);
      P(15, 11, 12, 3, base); P(24, 14, 2, 4, base); P(21, 14, 2, 3, base);
      outlineRect(ctx, ox, oy, 15, 11, 12, 3); break;
    }
    case 'bulb':
      disc(ctx, ox, oy, 16, 12, 8, base);
      P(12, 19, 8, 4, shade(base, 0.7)); P(13, 23, 6, 2, dk); // base
      P(13, 8, 3, 3, 0xffffff); break;
    case 'headphones':
      // band + two ear cups
      P(9, 7, 14, 3, dk); P(9, 7, 14, 1, lt);
      panel(ctx, ox, oy, 6, 10, 6, 12, base);
      panel(ctx, ox, oy, 20, 10, 6, 12, base); break;
    case 'glasses':
      disc(ctx, ox, oy, 11, 16, 5, shade(base, 0.5));
      disc(ctx, ox, oy, 21, 16, 5, shade(base, 0.5));
      disc(ctx, ox, oy, 11, 16, 3.5, light(base, 1.4));
      disc(ctx, ox, oy, 21, 16, 3.5, light(base, 1.4));
      P(15, 15, 2, 2, dk); break; // bridge
    case 'lamp':
      P(11, 5, 10, 6, base); P(11, 5, 10, 2, lt); outlineRect(ctx, ox, oy, 11, 5, 10, 6); // shade
      P(15, 11, 2, 12, dk); // stem
      P(11, 23, 10, 3, shade(base, 0.7)); outlineRect(ctx, ox, oy, 11, 23, 10, 3); break; // base
    case 'bag':
      panel(ctx, ox, oy, 7, 11, 18, 15, base);
      P(11, 7, 10, 5, base); outlineRect(ctx, ox, oy, 11, 7, 10, 5); // flap/handle
      P(7, 11, 18, 2, lt); break;
    case 'pan':
      disc(ctx, ox, oy, 13, 17, 8, base);
      disc(ctx, ox, oy, 13, 17, 6, light(base, 1.1));
      P(21, 16, 8, 3, dk); outlineRect(ctx, ox, oy, 21, 16, 8, 3); break; // handle
    case 'speaker':
      panel(ctx, ox, oy, 9, 5, 14, 22, base);
      disc(ctx, ox, oy, 16, 12, 4, dk); disc(ctx, ox, oy, 16, 21, 3, dk); break;
    case 'camera':
      panel(ctx, ox, oy, 6, 11, 20, 14, base);
      P(10, 8, 8, 3, shade(base, 0.7)); // top hump
      disc(ctx, ox, oy, 16, 18, 5, shade(base, 0.55));
      disc(ctx, ox, oy, 16, 18, 3, light(base, 1.3)); break;
    case 'board':
      panel(ctx, ox, oy, 5, 13, 22, 6, base);
      disc(ctx, ox, oy, 9, 20, 2, dk); disc(ctx, ox, oy, 23, 20, 2, dk); break; // skateboard
    default:
      panel(ctx, ox, oy, 8, 8, 16, 16, base);
  }
}

// Wear overlay: scuff marks for worse conditions (drawn faint over the icon).
function applyWear(ctx, ox, oy, condition) {
  if (condition === 'mint' || condition === 'good') return;
  ctx.fillStyle = condition === 'broken' ? 'rgba(20,16,24,0.5)' : 'rgba(20,16,24,0.28)';
  const marks = condition === 'broken' ? 6 : condition === 'worn' ? 4 : 2;
  // deterministic-ish scuffs
  let seed = ox * 7 + oy * 13 + marks;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < marks; i++) {
    const x = 6 + Math.floor(rnd() * 20);
    const y = 6 + Math.floor(rnd() * 20);
    ctx.fillRect(ox + x, oy + y, 1 + Math.floor(rnd() * 2), 1);
  }
}

export function generateItemIcons(scene, key = 'items') {
  if (scene.textures.exists(key)) return;
  const sz = ICON_SZ;
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
  ITEMS.forEach((item, i) => {
    const ox = (i % cols) * sz;
    const oy = Math.floor(i / cols) * sz;
    tex.add(item.id, 0, ox, oy, sz, sz);
  });
}

export function generate(scene, genId, key) {
  if (scene.textures.exists(key)) return; // already generated
  if (genId === 'tiles') return genTiles(scene, key);
  // Character layers are no longer generated as separate sheets - characters
  // are composited into one sheet on demand (generateCharacterComposite).
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
