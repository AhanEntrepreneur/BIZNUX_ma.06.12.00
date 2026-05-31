// ---------------------------------------------------------------------------
// Biznux 2D - global configuration.
//
// Everything tweakable lives here so gameplay/scene logic stays clean. When the
// project grows toward multiplayer, the server will own GameState (see
// src/core/GameState.js) but most of THESE constants stay shared client/server.
// ---------------------------------------------------------------------------

// Internal (low) resolution. Render small, scale up -> retro look.
// 320x180 is a 16:9 GBA-ish frame; at 16px tiles that's a 20x11 viewport.
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;

export const TILE_SIZE = 16;

export const FONT_FAMILY = '"Press Start 2P"';

// --- Time -------------------------------------------------------------------
// Spec: 1 real minute = 1 in-game hour -> a full day in 24 real minutes.
// So one in-game hour = 60 real seconds; one in-game minute = 1 real second.
export const TIME = {
  REAL_SECONDS_PER_GAME_HOUR: 60,
  HOURS_PER_DAY: 24,
  DAYS_PER_MONTH: 28, // 4 weeks
  START_HOUR: 8, // new players wake at 08:00
};

// --- Economy ----------------------------------------------------------------
// Tuned toward the "always slightly squeezed" principle: obligations drain on a
// schedule whether or not the week went well.
export const ECONOMY = {
  STARTING_CASH: 500,

  // Rent: charged daily at midnight if you don't own a home.
  DAILY_RENT: 40,
  RENT_MISS_LIMIT: 3, // missed rent days before eviction

  // One starter loan (EMI) the player carries from day one.
  LOAN_PRINCIPAL: 600, // a small debt that funded the move to the city
  EMI_AMOUNT: 55, // due on a monthly schedule
  EMI_INTERVAL_DAYS: 7, // "monthly" = every in-game week for a brisk loop
  EMI_MISS_LIMIT: 3, // missed EMIs before default escalation

  // Basic recurring bills (drain on a schedule).
  PHONE_BILL: 18,
  UTILITIES_BILL: 25,
  BILL_INTERVAL_DAYS: 7,

  // Food / hunger: not eating worsens fatigue/performance.
  MEAL_COST: 12,
  HUNGER_PER_GAME_HOUR: 4, // 0..100; high hunger penalizes
  HUNGER_HIGH: 70,

  // Credit score band.
  CREDIT_START: 600,
  CREDIT_MIN: 300,
  CREDIT_MAX: 850,

  // Consumable: poop bags for dog-walking cleanups.
  POOP_BAG_COST: 5,
  POOP_BAGS_PER_PACK: 5,
  STARTING_BAGS: 3,

  // Eviction housing penalty.
  EVICTED_FATIGUE_FLOOR: 25, // street sleep never fully rests you
};

// Dog-walking gig tuning (drives the LuckEngine availability/booking rolls).
export const DOGWALK_CFG = {
  baseRate: 0.55, // base chance a client exists when you look
  baseFee: 35,
  feeSpread: 45, // fee = base + quality*spread
  durations: [10, 15, 20], // in-game minutes
  dogNames: ['Buddy', 'Bella', 'Max', 'Coco', 'Rex', 'Luna', 'Charlie', 'Daisy'],
};

// --- Player movement (analog, any-direction) --------------------------------
export const PLAYER = {
  SPEED: 70, // pixels/second, walking
  // Fatigue climbs while awake; sleep resets it. 0..100.
  FATIGUE_PER_GAME_HOUR: 5, // ~20 awake hours before maxed
  FATIGUE_HIGH: 70, // above this, penalties kick in
};

// --- Stats ------------------------------------------------------------------
// Five universal stats from the spec. Defaults for a fresh character.
export const DEFAULT_STATS = {
  charisma: 5,
  intelligence: 5,
  strength: 5,
  reputation: 5,
  confidence: 5,
};
export const STAT_KEYS = ['charisma', 'intelligence', 'strength', 'reputation', 'confidence'];
export const STAT_MAX = 100;

// Texture keys (centralized; never hardcode strings elsewhere).
export const TEXTURES = {
  TILES: 'tiles',
  CHAR_BODY: 'char_body', // base body spritesheet (4 dir x 3 frames)
  CHAR_HAIR: 'char_hair', // hair overlay sheet (same layout)
  CHAR_OUTFIT: 'char_outfit', // outfit overlay sheet (same layout)
  NPC_BODY: 'npc_body',
};

// Ground/object tile indices inside the tileset (match the art generator order).
export const TILES = {
  GRASS: 0,
  ROAD: 1, // asphalt
  SIDEWALK: 2,
  WATER: 3,
  TREE: 4,
  PLAZA: 5, // tiled plaza floor
  WALL: 6, // generic building wall
  CROSSWALK: 7,
  PLANTER: 8, // decorative bush (collides)
};
export const TILE_COUNT = 9;

// Object-layer tiles that block movement.
export const COLLIDING_TILES = [TILES.WATER, TILES.TREE, TILES.WALL, TILES.PLANTER];

// Character spritesheet layout: 4 directions x 3 frames (idle, stepA, stepB).
export const CHAR = {
  FRAME_WIDTH: 16,
  FRAME_HEIGHT: 16,
  DIRECTION_OFFSET: { down: 0, left: 3, right: 6, up: 9 },
  FRAMES_PER_DIR: 3,
  TOTAL_FRAMES: 12,
};

// --- Asset source switch ----------------------------------------------------
// v1 generates all art in code (zero downloads). Flip to false and drop real
// spritesheets in /public/assets to use art later; see public/assets/README.md.
export const USE_PLACEHOLDER_ART = true;
export const ASSET_PATHS = {
  TILES: 'assets/tiles.png',
  CHAR_BODY: 'assets/char_body.png',
  CHAR_HAIR: 'assets/char_hair.png',
  CHAR_OUTFIT: 'assets/char_outfit.png',
};

// localStorage key for the local save (one slot in v1).
export const SAVE_KEY = 'biznux.save.v1';

// --- Cohesive, limited color palette ----------------------------------------
export const PALETTE = {
  bg: 0x0a0a12,
  // city ground
  grass: 0x4f8f3f,
  grassDark: 0x3f7a31,
  road: 0x3a3d4a,
  roadLine: 0xd8c64a,
  sidewalk: 0x9aa0ab,
  sidewalkDark: 0x848a95,
  plaza: 0xb9a78c,
  plazaLine: 0xa08e74,
  crosswalk: 0xe6e6e6,
  water: 0x3a72c4,
  waterLight: 0x5a92e4,
  treeLeaf: 0x2f7d32,
  treeLeafDark: 0x256127,
  treeTrunk: 0x6b4423,
  planter: 0x35702f,
  // buildings (used as tints over the WALL tile / labels)
  wall: 0x6b6f80,
  wallDark: 0x565a68,
  // character base
  skin: 0xf0c090,
  skinShadow: 0xd9a878,
  // UI
  panel: 0x141726,
  panelLight: 0x22263c,
  panelBorder: 0xf4f4f4,
  text: 0xffffff,
  textDim: 0x9aa0c0,
  accent: 0xffd24b,
  money: 0x6ee06e,
  danger: 0xe05a5a,
};

// Building accent colors for the city's named lots.
export const BUILDING_COLORS = {
  cafe: 0xb5443a,
  apartment: 0x4a6fa5,
  college: 0x7a5aa0,
  shop: 0xc99a3a,
  cityhall: 0x3a8a6a,
};
