// ---------------------------------------------------------------------------
// Dialogue data (separate from scene logic).
//
// Keyed by an id that NPCs / interactables reference (see npcs.js). Each entry
// has a display `name` and an array of `lines` — each line is one "page" in the
// dialogue box, advanced with Space/Enter.
//
// Add branching, conditions, or events later without touching the UI: this is
// just data the DialogueBox renders.
// ---------------------------------------------------------------------------
export const DIALOGUE = {
  elder: {
    name: 'Elder Bromm',
    lines: [
      'Welcome to the valley, traveler!',
      'Long ago, Dinomonz roamed these hills...',
      'Some say they still slumber in the tall grass.',
      'Explore. The world is yours to discover.',
    ],
  },
  farmer: {
    name: 'Farmer Pell',
    lines: [
      'Mornin! Fine day for a stroll, eh?',
      'One day this field will be full of crops.',
      "...but that's a tale for another update.",
    ],
  },
  sign_pond: {
    name: 'Wooden Sign',
    lines: [
      'POND - Watch your step!',
      'The water is deeper than it looks.',
    ],
  },
};
