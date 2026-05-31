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

// Starter outfits: each picks an art variant (cut) + a tint (color) + category.
export const OUTFITS = [
  { id: 0, variant: 0, color: 0x3d7de0, label: 'Blue Tee', formal: false },
  { id: 1, variant: 0, color: 0x4caf50, label: 'Green Tee', formal: false },
  { id: 2, variant: 1, color: 0xb5443a, label: 'Red Polo', formal: false },
  { id: 3, variant: 2, color: 0x33363f, label: 'Grey Jacket', formal: false },
];

export const DEFAULT_APPEARANCE = {
  name: 'Newcomer',
  body: 'masc',
  face: 0,
  hair: 0,
  hairColor: 1,
  outfit: 0,
};
