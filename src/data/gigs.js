// ---------------------------------------------------------------------------
// Minor gigs (MA.06.12.01 Part 4). Lighter than the deep jobs: a quick
// availability roll + outcome variance through the luck engine. 10 gigs.
//
// Each: id, title, pay (base), stat trained, time cost, fatigue, outdoor flag,
// and a base availability rate. Deliberately low-pay so they fill gaps between
// real jobs without trivializing them.
// ---------------------------------------------------------------------------
export const GIGS = [
  { id: 'leaflets', title: 'Hand out leaflets', pay: 18, stat: 'charisma', minutes: 25, fatigue: 4, outdoor: true, baseRate: 0.7 },
  { id: 'carwash', title: 'Wash a car', pay: 22, stat: 'strength', minutes: 25, fatigue: 5, outdoor: true, baseRate: 0.55 },
  { id: 'plants', title: 'Water plants', pay: 12, stat: 'intelligence', minutes: 15, fatigue: 2, outdoor: false, baseRate: 0.75 },
  { id: 'queue', title: 'Stand in a queue', pay: 14, stat: 'confidence', minutes: 30, fatigue: 3, outdoor: true, baseRate: 0.6 },
  { id: 'lostpet', title: 'Find a lost pet', pay: 28, stat: 'charisma', minutes: 30, fatigue: 5, outdoor: true, baseRate: 0.4 },
  { id: 'yard', title: 'Clean a yard', pay: 24, stat: 'strength', minutes: 30, fatigue: 6, outdoor: true, baseRate: 0.5 },
  { id: 'shovel', title: 'Shovel a path', pay: 26, stat: 'strength', minutes: 25, fatigue: 7, outdoor: true, baseRate: 0.45 },
  { id: 'tutor', title: 'Tutor a student', pay: 30, stat: 'intelligence', minutes: 35, fatigue: 3, outdoor: false, baseRate: 0.4 },
  { id: 'groceries', title: 'Carry groceries', pay: 16, stat: 'strength', minutes: 20, fatigue: 4, outdoor: true, baseRate: 0.6 },
  { id: 'survey', title: 'Do a street survey', pay: 15, stat: 'charisma', minutes: 20, fatigue: 3, outdoor: true, baseRate: 0.65 },
];
