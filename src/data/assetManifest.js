// ---------------------------------------------------------------------------
// Asset manifest - the keyed art pipeline.
//
// This is the SINGLE place that declares every piece of art the game uses. Each
// entry maps a stable texture KEY (referenced everywhere in game logic) to:
//   - a real-art FILE path under /public (e.g. the purchased LimeZu PNGs), and
//   - a PLACEHOLDER generator id used when that file isn't present yet.
//
// PreloadScene attempts to load every `file`; any that 404 fall back to the
// procedural placeholder for the same key. So dropping the LimeZu files into
// /public/assets makes them appear automatically, "by key, with no logic
// changes" - game code never references a filename, only a key.
//
// frame: spritesheet frame size (omit for single images).
// ---------------------------------------------------------------------------
import { TILE_SIZE, CHAR } from '../config.js';

// Texture keys used throughout the game. Import these, never raw strings.
export const KEYS = {
  TILES: 'tiles',
  // Layered paper-doll character: body + bottoms + top + hair, each its own
  // sheet (4 dirs x 3 frames) so they recolor and swap independently.
  BODY_MASC: 'char_body_masc',
  BODY_FEM: 'char_body_fem',
  BOTTOMS: 'char_bottoms_', // + variant index
  TOP: 'char_top_', // + variant index
  HAIR: 'char_hair_', // + style index
  // Props / FX
  SHADOW: 'fx_shadow',
  DOG: 'dog',
  RAINDROP: 'fx_raindrop',
  DUST: 'fx_dust',
  LEAF: 'fx_leaf',
  POOP: 'prop_poop',
  PROMPT: 'ui_prompt', // interaction key-bubble
  SPARK: 'fx_spark',
};

// Number of art variants the placeholder generator produces (and that real art
// should match). Bumping these requires matching art.
export const VARIANTS = {
  BOTTOMS: 4, // trouser/skirt colors+cuts
  TOP: 4, // shirt/jacket cuts
  HAIR: 8, // hairstyles
};

// Declarative manifest. `gen` is the placeholder generator id (see generateArt).
// `file` is where the real asset will live; if absent/404 we generate.
export function buildManifest() {
  const charFrame = { frameWidth: CHAR.FRAME_WIDTH, frameHeight: CHAR.FRAME_HEIGHT };
  const m = [];

  m.push({ key: KEYS.TILES, file: 'assets/tiles.png', gen: 'tiles', frame: { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE } });

  m.push({ key: KEYS.BODY_MASC, file: 'assets/char/body_masc.png', gen: 'body:masc', frame: charFrame });
  m.push({ key: KEYS.BODY_FEM, file: 'assets/char/body_fem.png', gen: 'body:fem', frame: charFrame });
  for (let i = 0; i < VARIANTS.BOTTOMS; i++)
    m.push({ key: KEYS.BOTTOMS + i, file: `assets/char/bottoms_${i}.png`, gen: 'bottoms:' + i, frame: charFrame });
  for (let i = 0; i < VARIANTS.TOP; i++)
    m.push({ key: KEYS.TOP + i, file: `assets/char/top_${i}.png`, gen: 'top:' + i, frame: charFrame });
  for (let i = 0; i < VARIANTS.HAIR; i++)
    m.push({ key: KEYS.HAIR + i, file: `assets/char/hair_${i}.png`, gen: 'hair:' + i, frame: charFrame });

  // Props / FX are single textures, generated procedurally (cheap, not worth
  // real art). They still go through the same key pipeline for consistency.
  m.push({ key: KEYS.SHADOW, gen: 'shadow' });
  m.push({ key: KEYS.DOG, file: 'assets/dog.png', gen: 'dog', frame: charFrame });
  m.push({ key: KEYS.RAINDROP, gen: 'raindrop' });
  m.push({ key: KEYS.DUST, gen: 'dust' });
  m.push({ key: KEYS.LEAF, gen: 'leaf' });
  m.push({ key: KEYS.POOP, gen: 'poop' });
  m.push({ key: KEYS.PROMPT, gen: 'prompt' });
  m.push({ key: KEYS.SPARK, gen: 'spark' });

  return m;
}
