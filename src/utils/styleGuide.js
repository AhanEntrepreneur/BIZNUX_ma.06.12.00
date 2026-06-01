// ---------------------------------------------------------------------------
// STYLE GUIDE (MA.06.12.01.5 Part B.1) - the in-code art standard every
// generator must meet. The benchmark is the v00 character + dog, which read as
// "good": clean dark outline, a 3-step shade ramp (dark/base/light) lit from
// the upper-left, a clear readable silhouette, and a disciplined limited
// palette. Every generator in utils/generateArt.js draws to these rules.
//
// THE RULES
//  1. Outline: a single near-black outline (OUTLINE) around the readable
//     silhouette of an object. No outline between internal shade bands.
//  2. Shading: 3 tones per material - base, plus shade(base) and light(base).
//     Light comes from the UPPER-LEFT, so top/left edges get `light`, bottom/
//     right get `shade`.
//  3. Palette: pull every colour from the ramps below. Don't invent one-off
//     colours; pick the nearest ramp entry so the whole game is cohesive.
//  4. Silhouette first: an icon/sprite must be recognisable in flat black. If
//     it isn't, the shape is wrong - fix the shape before the shading.
//  5. Resolution: characters/props stay on the 16px frame grid (physics +
//     tilemap depend on it); ITEM ICONS and BUILDING/SIGN art may use a higher
//     internal resolution (32px icons, multi-tile facades) since they are
//     plain images, not physics frames.
// ---------------------------------------------------------------------------

export const OUTLINE = 0x1a1420; // near-black, slightly warm

// Shade/lighten helpers (used everywhere for the 3-tone ramp).
export function shade(hex, f = 0.7) {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 255) * f)));
  return (r << 16) | (g << 8) | b;
}
export function light(hex, f = 1.25) {
  return shade(hex, f);
}

// --- Cohesive ramps (base colours; use shade()/light() for the other tones) -
export const RAMPS = {
  // skin tones (face index maps into these in appearance.js too)
  skin: [0xf0c8a0, 0xe0b088, 0xc89870, 0xa87a55, 0x8a5e3c],
  hair: [0x2b1a10, 0x4a2f1a, 0x6b4423, 0x8a6035, 0xb5824a, 0xd8c64a, 0x9a9a9a, 0xb5443a],
  // fabrics for clothing
  fabric: [0x3d7de0, 0x4caf50, 0xb5443a, 0x33363f, 0xe0c84a, 0x7a5aa0, 0xc06a7a, 0x2b3a55],
  // building materials
  brick: 0xb05a44,
  concrete: 0x9aa0ab,
  stucco: 0xd8c8a8,
  woodWall: 0x9a6b3a,
  glass: 0x8fc4d8,
  roofTile: 0x7a4a3a,
  roofMetal: 0x5a6a78,
  // metals / materials for items
  metal: 0xc8ccd4,
  gold: 0xe8c44a,
  silver: 0xd8dce4,
  gem: 0x5ad0c0,
  leather: 0x7a4a2a,
  paper: 0xe8e0c8,
  plastic: 0xb0b6c0,
  // ground / nature
  grass: 0x4f8f3f,
  road: 0x3a3d4a,
  sidewalk: 0x9aa0ab,
  plaza: 0xb9a78c,
  foliage: 0x2f7d32,
  water: 0x3a72c4,
};

// Standard accent for signage text + UI highlights.
export const SIGN_TEXT = 0xfdf4d8;
