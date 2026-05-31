// ---------------------------------------------------------------------------
// LuckEngine - the reusable luck-and-consequence system (Section 4 of the
// MA.06.12.00 brief). Deliberately standalone and gig-agnostic: every future
// job/gig plugs into these three pure functions. No Phaser, no DOM.
//
// Principle: effort tilts the odds, it never guarantees. Stats + performance
// move the CENTER of the distribution; randomness provides the spread.
// ---------------------------------------------------------------------------

// Small helpers.
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rand = () => Math.random();

// 1) AVAILABILITY ROLL -------------------------------------------------------
// Decide whether work exists right now for a gig, and if so generate a booking.
// ctx: { reputation(0..100), gigRating(0..5), hour, weather }
// cfg: { baseRate, baseFee, feeSpread, durations }
// Returns: { available:false } OR { available:true, fee, durationMin, clientMood, quality }
export function rollAvailability(ctx, cfg) {
  // Base chance, lifted by reputation and the gig's own star rating, nudged by
  // time-of-day demand and weather. Capped well below 1 so "no work" is real.
  let p = cfg.baseRate;
  p += (ctx.reputation / 100) * 0.18; // good citywide rep -> more offers
  p += (ctx.gigRating / 5) * 0.22; // good gig rating -> more offers
  // Demand window: dog-walking peaks mornings/evenings.
  const h = ctx.hour;
  const peak = (h >= 7 && h <= 10) || (h >= 16 && h <= 19);
  p += peak ? 0.12 : -0.05;
  if (h < 6 || h >= 21) p -= 0.25; // few bookings late at night
  // Bad weather suppresses demand.
  if (ctx.weather === 'rainy') p -= 0.12;
  if (ctx.weather === 'cold') p -= 0.06;

  p = clamp01(p);
  if (rand() > p) return { available: false, chance: p };

  // There's work. Quality of the booking also scales with rating/rep.
  const qualityRoll = clamp01(rand() * 0.7 + (ctx.gigRating / 5) * 0.3);
  const fee = Math.round(cfg.baseFee + qualityRoll * cfg.feeSpread);
  const durationMin = cfg.durations[Math.floor(rand() * cfg.durations.length)];
  const moods = ['energetic', 'calm', 'old-and-slow', 'anxious', 'reactive'];
  const clientMood = moods[Math.floor(rand() * moods.length)];

  return { available: true, chance: p, fee, durationMin, clientMood, quality: qualityRoll };
}

// 2) OUTCOME VARIANCE --------------------------------------------------------
// Resolve an activity. performance is the player's in-activity score (0..1).
// statBonus is a 0..1 contribution from relevant stats. Even a perfect run has
// a small chance of mediocrity; even a sloppy run can occasionally be fine.
// Returns: { score(0..1), tier, stars(1..5) }
export function resolveOutcome(performance, statBonus) {
  // Center the distribution on performance+stats, then add symmetric noise.
  const center = clamp01(performance * 0.7 + statBonus * 0.3);
  const noise = (rand() - 0.5) * 0.5; // +/-0.25 spread (the "luck bites")
  let score = clamp01(center + noise);

  // Rare swings both ways so nothing is ever certain.
  if (rand() < 0.06) score = clamp01(score - 0.35); // bad-luck day
  if (rand() < 0.06) score = clamp01(score + 0.3); // lucky break

  const stars = Math.max(1, Math.min(5, Math.round(score * 4) + 1));
  let tier = 'ok';
  if (score >= 0.85) tier = 'great';
  else if (score >= 0.6) tier = 'good';
  else if (score >= 0.35) tier = 'ok';
  else if (score >= 0.15) tier = 'poor';
  else tier = 'disaster';

  return { score, tier, stars };
}

// 3) PERSISTENT RATING -------------------------------------------------------
// Fold a new star result into a running gig rating (a smoothed average that
// reacts faster to bad results than good ones, like real review systems).
export function updateRating(current, stars) {
  const target = stars; // 1..5
  const downward = target < current;
  const alpha = downward ? 0.35 : 0.22; // bad news sticks faster
  const next = current + (target - current) * alpha;
  return Math.max(0, Math.min(5, Math.round(next * 100) / 100));
}

// A short human review line keyed by tier (flavor shown to the player).
export function reviewLine(tier, cleanedUp, lostControl) {
  if (tier === 'disaster') return lostControl ? 'The dog got loose! Never again.' : 'Awful. Would not rebook.';
  if (tier === 'poor') return cleanedUp ? 'Rushed and careless.' : 'Left a mess on the path!';
  if (tier === 'ok') return 'Fine, I guess. Did the job.';
  if (tier === 'good') return 'Happy pup, on time. Thanks!';
  return 'Amazing! Best walker in the city.';
}
