// ---------------------------------------------------------------------------
// NPC placements (data). Positions in TILE coords, set just outside each
// building's door (see city.js building `door` tiles). `role` tells WorldScene
// which interaction to wire; `tint` recolors the generated character.
// ---------------------------------------------------------------------------
export const NPCS = [
  // Downtown core
  { id: 'barista', name: 'Mara the Barista', tileX: 8, tileY: 9, tint: 0xffd2a0, facing: 'down', role: 'job', jobId: 'cafe', dialogue: 'barista' },
  { id: 'clerk', name: 'Sam the Clerk', tileX: 22, tileY: 9, tint: 0xc9b08a, facing: 'down', role: 'job', jobId: 'retail', dialogue: 'clerk' },
  { id: 'flipper', name: 'Vic (Flip Store)', tileX: 42, tileY: 9, tint: 0x8af0e0, facing: 'down', role: 'flipstore', dialogue: 'flipper' },
  { id: 'pawnbroker', name: 'Iggy (Pawn Shop)', tileX: 60, tileY: 9, tint: 0xd0a060, facing: 'down', role: 'pawnshop', dialogue: 'pawnbroker' },
  { id: 'dean', name: 'Dean Okafor', tileX: 75, tileY: 10, tint: 0xc0a0ff, facing: 'down', role: 'college', dialogue: 'dean' },

  // The gig dispatcher lives on the downtown plaza - hub for delivery/dogwalk/
  // busker and the minor gigs board.
  { id: 'dispatcher', name: 'Gig Dispatcher', tileX: 7, tileY: 20, tint: 0xa0e0ff, facing: 'down', role: 'jobboard', dialogue: 'dispatcher' },

  // Commercial strip
  { id: 'realtor', name: 'Rhea the Realtor', tileX: 7, tileY: 39, tint: 0xa0ffc0, facing: 'down', role: 'realtor', dialogue: 'realtor' },

  // Residential
  { id: 'mayor', name: 'Mayor Vell', tileX: 48, tileY: 49, tint: 0xffe0a0, facing: 'up', role: 'flavor', dialogue: 'mayor' },
];
