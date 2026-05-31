// ---------------------------------------------------------------------------
// Asset manifest - the keyed, FULLY SELF-AUTHORED art pipeline.
//
// As of MA.06.12.01 there are NO external/downloaded assets. Every texture is
// authored procedurally in code (see utils/generateArt.js + utils/artkit.js).
// This module is the single registry mapping a stable texture KEY -> the
// generator id + (for spritesheets) the frame size. Game logic references only
// KEYS, never raw strings, so art can be re-styled in one place.
//
// PreloadScene generates every entry synchronously (canvas textures, no network
// loader) and validates each sheet's dimensions are exact multiples of the
// frame size. No file loads => no 404s => zero console errors by construction.
// ---------------------------------------------------------------------------
import { TILE_SIZE, CHAR } from '../config.js';

export const KEYS = {
  TILES: 'tiles',
  // Layered paper-doll character: body + bottoms + top + hair, each its own
  // sheet (4 dirs x 3 frames) so they recolor and swap independently.
  BODY_MASC: 'char_body_masc',
  BODY_FEM: 'char_body_fem',
  BOTTOMS: 'char_bottoms_', // + variant index
  TOP: 'char_top_', // + variant index
  HAIR: 'char_hair_', // + style index
  // Animals / props / FX
  SHADOW: 'fx_shadow',
  DOG: 'dog',
  RAINDROP: 'fx_raindrop',
  DUST: 'fx_dust',
  LEAF: 'fx_leaf',
  POOP: 'prop_poop',
  PROMPT: 'ui_prompt', // interaction key-bubble
  SPARK: 'fx_spark',
  // Items (the findable economy) live on one generated atlas; see ITEMS data.
  ITEMS: 'items',
};

export const VARIANTS = {
  BOTTOMS: 4,
  TOP: 4,
  HAIR: 8,
};

// Declarative manifest. Each entry: { key, gen, frame? }.
//   gen   - generator id dispatched in utils/generateArt.js
//   frame - { frameWidth, frameHeight } for spritesheets (omit for single images)
// No `file` field exists anymore: everything is generated.
export function buildManifest() {
  const charFrame = { frameWidth: CHAR.FRAME_WIDTH, frameHeight: CHAR.FRAME_HEIGHT };
  const m = [];

  m.push({ key: KEYS.TILES, gen: 'tiles', frame: { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE } });

  m.push({ key: KEYS.BODY_MASC, gen: 'body:masc', frame: charFrame });
  m.push({ key: KEYS.BODY_FEM, gen: 'body:fem', frame: charFrame });
  for (let i = 0; i < VARIANTS.BOTTOMS; i++) m.push({ key: KEYS.BOTTOMS + i, gen: 'bottoms:' + i, frame: charFrame });
  for (let i = 0; i < VARIANTS.TOP; i++) m.push({ key: KEYS.TOP + i, gen: 'top:' + i, frame: charFrame });
  for (let i = 0; i < VARIANTS.HAIR; i++) m.push({ key: KEYS.HAIR + i, gen: 'hair:' + i, frame: charFrame });

  m.push({ key: KEYS.DOG, gen: 'dog', frame: charFrame });

  // Single-texture props / FX.
  m.push({ key: KEYS.SHADOW, gen: 'shadow' });
  m.push({ key: KEYS.RAINDROP, gen: 'raindrop' });
  m.push({ key: KEYS.DUST, gen: 'dust' });
  m.push({ key: KEYS.LEAF, gen: 'leaf' });
  m.push({ key: KEYS.POOP, gen: 'poop' });
  m.push({ key: KEYS.PROMPT, gen: 'prompt' });
  m.push({ key: KEYS.SPARK, gen: 'spark' });

  return m;
}
