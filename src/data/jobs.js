// ---------------------------------------------------------------------------
// Job definitions (data, not logic).
//
// v1 ships the five entry-tier jobs from the pitch. Each job knows where it's
// worked (a building id on the map), its shift window, daily wage, the stat it
// trains, whether it's outdoors (weather-affected), and a "skin" for the work
// mini-game (what the clickable targets look like). Higher tiers / illegal jobs
// slot into this same table later with extra gate fields.
// ---------------------------------------------------------------------------
export const JOBS = {
  cafe: {
    id: 'cafe',
    title: 'Cafe Worker',
    building: 'cafe',
    shift: { start: 9, end: 17 }, // 9-to-5 window you must clock in within
    dailyWage: 90,
    trains: 'charisma',
    outdoor: false,
    minStats: {},
    minigame: { skin: 'cup', label: 'Serve the coffees!' },
    blurb: 'Pull shots, serve customers. Trains Charisma.',
  },
  retail: {
    id: 'retail',
    title: 'Retail Clerk',
    building: 'shop',
    shift: { start: 10, end: 18 },
    dailyWage: 85,
    trains: 'charisma',
    outdoor: false,
    minStats: {},
    minigame: { skin: 'tag', label: 'Scan the items!' },
    blurb: 'Stock shelves and ring up sales. Trains Charisma.',
  },
  delivery: {
    id: 'delivery',
    title: 'Delivery Rider',
    building: 'plaza', // dispatched from the central plaza
    shift: { start: 8, end: 16 },
    dailyWage: 100,
    trains: 'strength',
    outdoor: true, // rain cuts payout
    minStats: {},
    minigame: { skin: 'box', label: 'Drop the packages!' },
    blurb: 'Race parcels across town. Trains Strength. Hates rain.',
  },
  dogwalk: {
    id: 'dogwalk',
    title: 'Dog Walker',
    building: 'plaza',
    shift: { start: 7, end: 15 },
    dailyWage: 70,
    trains: 'strength',
    outdoor: true,
    minStats: {},
    minigame: { skin: 'paw', label: 'Keep the pups happy!' },
    blurb: 'Walk the neighborhood dogs. Trains Strength.',
  },
  busker: {
    id: 'busker',
    title: 'Busker',
    building: 'plaza',
    shift: { start: 12, end: 20 },
    dailyWage: 60,
    trains: 'charisma',
    outdoor: true,
    minStats: {},
    minigame: { skin: 'note', label: 'Hit the notes!' },
    blurb: 'Play for tips in the plaza. Trains Charisma.',
  },
};

export const JOB_LIST = Object.values(JOBS);
