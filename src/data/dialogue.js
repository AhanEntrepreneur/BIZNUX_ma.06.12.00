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
      "We're hiring at the cafe. Make the drinks, mind the rush.",
    ],
  },
  clerk: {
    name: 'Sam the Clerk',
    lines: [
      'Store could use another pair of hands.',
      'Stock the shelves, run the till. Honest work.',
    ],
  },
  flipper: {
    name: 'Vic',
    lines: [
      'Welcome to the Flip Store. Buy low, sell high.',
      "I'll buy your finds - below value, mind you. A guy's gotta eat.",
    ],
  },
  pawnbroker: {
    name: 'Iggy',
    lines: [
      'Pawn shop. Quick cash, no questions.',
      "I pay less than the flip store, but you walk out with money TODAY.",
    ],
  },
  dispatcher: {
    name: 'Gig Dispatcher',
    lines: [
      'Need quick cash? No contract, just gigs.',
      'Dog-walking, delivery, busking, odd jobs - take your pick.',
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
