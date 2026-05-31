// ---------------------------------------------------------------------------
// NPC placements (data). Positions in TILE coords. `role` lets WorldScene wire
// the right interaction (a job board, a course desk, the realtor) while still
// using the shared dialogue/interaction system. `tint` recolors the placeholder
// character sheet so NPCs look distinct until real art is added.
// ---------------------------------------------------------------------------
export const NPCS = [
  {
    id: 'barista',
    name: 'Mara the Barista',
    tileX: 18, tileY: 8, // outside the cafe
    tint: 0xffd2a0,
    facing: 'down',
    role: 'job', // opens the job-offer flow for the cafe
    jobId: 'cafe',
    dialogue: 'barista',
  },
  {
    id: 'dispatcher',
    name: 'Gig Dispatcher',
    tileX: 6, tileY: 17, // on the plaza - hub for outdoor gigs
    tint: 0xa0e0ff,
    facing: 'down',
    role: 'jobboard', // offers delivery / dogwalk / busker
    dialogue: 'dispatcher',
  },
  {
    id: 'dean',
    name: 'Dean Okafor',
    tileX: 41, tileY: 8, // outside the college
    tint: 0xc0a0ff,
    facing: 'down',
    role: 'college', // sells a stat course
    dialogue: 'dean',
  },
  {
    id: 'realtor',
    name: 'Rhea the Realtor',
    tileX: 7, tileY: 35, // outside the realtor
    tint: 0xa0ffc0,
    facing: 'up',
    role: 'realtor', // sells your first home
    dialogue: 'realtor',
  },
  {
    id: 'mayor',
    name: 'Mayor Vell',
    tileX: 19, tileY: 36, // outside city hall
    tint: 0xffe0a0,
    facing: 'up',
    role: 'flavor', // governance is a later milestone; flavor for now
    dialogue: 'mayor',
  },
];
