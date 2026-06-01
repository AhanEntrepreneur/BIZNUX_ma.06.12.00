// ---------------------------------------------------------------------------
// Character-creation option tables (data).
//
// v1 keeps these compact but shaped for the full spec (2 bodies, 15 faces,
// 6-8 hairstyles, tattoos later). Faces are represented as skin-tint choices
// for the placeholder art; with real art they'd map to face spritesheet rows.
// Hair/outfit colors are applied as tints over the white overlay sheets.
// ---------------------------------------------------------------------------

export const BODY_TYPES = [
  { id: 'masc', label: 'Masculine' },
  { id: 'fem', label: 'Feminine' },
];

// 15 preset "faces" -> skin tones for the placeholder body. (Index 0..14.)
export const FACE_TINTS = [
  0xffe0bd, 0xf5cfa0, 0xeac086, 0xd9a066, 0xc68642,
  0xa86b35, 0x8d5524, 0xf0c8a0, 0xe6b890, 0xdca878,
  0xffd9b3, 0xf2c79a, 0xe5b585, 0xcf9a63, 0xb07b40,
];

// 8 hairstyles (silhouette index used by the art generator) + their swatch.
export const HAIR_STYLES = [0, 1, 2, 3, 4, 5, 6, 7];
export const HAIR_COLORS = [
  0x2b1a10, 0x4a2f1a, 0x6b4423, 0x8a6035, 0xb5824a,
  0xd8c64a, 0x9a9a9a, 0xb5443a,
];

// Starter outfits. Each outfit is now a full top + bottoms combo (paper-doll):
//   top/topColor    -> the shirt/jacket layer (cut variant + tint)
//   bottoms/botColor -> the TROUSERS layer (cut variant + tint)  [Bug 1 fix]
// `formal` will matter for interviews/meetings in a later version.
export const OUTFITS = [
  { id: 0, label: 'Blue Tee',    top: 0, topColor: 0x3d7de0, bottoms: 1, botColor: 0x2b3a55, formal: false },
  { id: 1, label: 'Green Tee',   top: 0, topColor: 0x4caf50, bottoms: 1, botColor: 0x3a3f2b, formal: false },
  { id: 2, label: 'Red Polo',    top: 1, topColor: 0xb5443a, bottoms: 2, botColor: 0x4a4f5a, formal: false },
  { id: 3, label: 'Grey Jacket', top: 2, topColor: 0x33363f, bottoms: 2, botColor: 0x222530, formal: true },
  { id: 4, label: 'Summer',      top: 3, topColor: 0xe0c84a, bottoms: 0, botColor: 0x6b5a8a, formal: false },
];

export const DEFAULT_APPEARANCE = {
  name: 'Newcomer',
  body: 'masc',
  face: 0,
  hair: 0,
  hairColor: 1,
  outfit: 0,
};

// Resolve an appearance object into the concrete color set the composite
// character generator needs, plus a STABLE texture key (so identical
// appearances reuse one baked sheet and never regenerate). An optional `tint`
// (NPCs) overrides the skin color for quick visual variety.
export function resolveCharacter(appearance) {
  const a = appearance || {};
  const outfit = OUTFITS[a.outfit ?? 0] || OUTFITS[0];
  const skin = a.tint != null ? a.tint : FACE_TINTS[a.face ?? 0];
  const bodyType = a.body === 'fem' ? 'fem' : 'masc';
  const hairColor = HAIR_COLORS[a.hairColor ?? 0];
  const hairStyle = a.hair ?? 0;
  const colors = {
    skin,
    bodyType,
    bottoms: { color: outfit.botColor, variant: outfit.bottoms },
    top: { color: outfit.topColor, variant: outfit.top },
    hair: { color: hairColor, style: hairStyle },
  };
  // Key encodes every visual input so distinct looks get distinct baked sheets.
  const key = `char_${bodyType}_${skin.toString(16)}_${outfit.id}_${hairStyle}_${hairColor.toString(16)}`;
  return { key, colors };
}
