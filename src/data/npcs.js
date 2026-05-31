// ---------------------------------------------------------------------------
// NPC / interactable placements (separate from scene logic).
//
// Positions are in TILE coordinates. `dialogue` references a key in
// dialogue.js. `tint` recolors the placeholder character sheet so each NPC
// looks distinct (when you add real per-NPC spritesheets, set `texture` and
// drop the tint). `facing` is the direction they start looking.
//
// `type`:
//   'npc'  -> a character sprite you can talk to
//   'sign' -> a static interactable (still talked to via the same system)
// ---------------------------------------------------------------------------
export const NPCS = [
  {
    id: 'elder',
    type: 'npc',
    tileX: 6,
    tileY: 11, // just below the top-left house door
    tint: 0xffe0a0,
    facing: 'down',
    dialogue: 'elder',
  },
  {
    id: 'farmer',
    type: 'npc',
    tileX: 20,
    tileY: 17, // out by the crossroads / future farm field
    tint: 0xa0e0ff,
    facing: 'left',
    dialogue: 'farmer',
  },
  {
    id: 'sign_pond',
    type: 'sign',
    tileX: 23,
    tileY: 12, // at the foot of the pond
    facing: 'down',
    dialogue: 'sign_pond',
  },
];
