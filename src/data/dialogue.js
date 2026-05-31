// ---------------------------------------------------------------------------
// Dialogue lines (data), keyed by id and referenced from npcs.js. Each entry is
// a name + an array of "pages" the dialogue box types out one at a time.
//
// These are the *intro* lines. Role-specific NPCs (job, college, realtor) hand
// off to interactive menus after their intro - that wiring lives in WorldScene,
// not here, so this stays pure data.
// ---------------------------------------------------------------------------
export const DIALOGUE = {
  barista: {
    name: 'Mara the Barista',
    lines: [
      'New in town? You look like you could use a paycheck.',
      "We're hiring at the cafe. Nine to five, daily pay.",
    ],
  },
  dispatcher: {
    name: 'Gig Dispatcher',
    lines: [
      'Need quick cash? No contract, just gigs.',
      'Delivery, dog-walking, busking - take your pick.',
    ],
  },
  dean: {
    name: 'Dean Okafor',
    lines: [
      'Welcome to the Community College.',
      'A short course can sharpen your mind - for a fee.',
    ],
  },
  realtor: {
    name: 'Rhea the Realtor',
    lines: [
      'Renting forever? That money could be building equity.',
      'I can sell you a starter home - no more nightly rent.',
    ],
  },
  mayor: {
    name: 'Mayor Vell',
    lines: [
      'This city runs on ambition, friend.',
      'Work hard, buy property, and who knows...',
      'Maybe one day YOU run for this office.',
    ],
  },
};
