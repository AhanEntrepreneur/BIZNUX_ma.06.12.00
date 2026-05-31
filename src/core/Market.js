// ---------------------------------------------------------------------------
// Market - item find rolls, fluctuating prices, and buy/sell pricing for the
// flip store and pawn shop (MA.06.12.01 Part 3). Pure logic, routes value
// variance through the same luck philosophy as the rest of the game.
// ---------------------------------------------------------------------------
import { ITEMS_BY_TIER, ITEMS_BY_ID, CONDITIONS } from '../data/items.js';
import { rollAvailability } from './LuckEngine.js';

// Search-spot weight -> tier probabilities + an availability base rate.
const SPOT_WEIGHTS = {
  poor: { base: 0.45, junk: 0.8, ordinary: 0.18, rare: 0.02 },
  normal: { base: 0.5, junk: 0.6, ordinary: 0.33, rare: 0.07 },
  good: { base: 0.55, junk: 0.45, ordinary: 0.42, rare: 0.13 },
  rare: { base: 0.4, junk: 0.25, ordinary: 0.45, rare: 0.30 }, // lost & found
};

function pickTier(weights) {
  const r = Math.random();
  if (r < weights.rare) return 'rare';
  if (r < weights.rare + weights.ordinary) return 'ordinary';
  return 'junk';
}

function pickCondition() {
  // Skew toward worn/used; mint is uncommon.
  const r = Math.random();
  if (r < 0.12) return CONDITIONS[0]; // broken
  if (r < 0.4) return CONDITIONS[1]; // worn
  if (r < 0.72) return CONDITIONS[2]; // used
  if (r < 0.92) return CONDITIONS[3]; // good
  return CONDITIONS[4]; // mint
}

// Search a spot. Routes through the luck engine's availability roll so finding
// is luck-and-effort, not guaranteed. Returns a found item or null.
// ctx: { reputation, luckRating(0..5), hour, weather }
export function searchSpot(spotWeight, ctx) {
  const w = SPOT_WEIGHTS[spotWeight] || SPOT_WEIGHTS.normal;
  const roll = rollAvailability(
    { reputation: ctx.reputation, gigRating: ctx.luckRating ?? 2.5, hour: ctx.hour, weather: ctx.weather },
    { baseRate: w.base, baseFee: 0, feeSpread: 0, durations: [1] }
  );
  if (!roll.available) return null;

  const tier = pickTier(w);
  const pool = ITEMS_BY_TIER[tier];
  const item = pool[Math.floor(Math.random() * pool.length)];
  const cond = pickCondition();
  // Value varies a touch around base*condition.
  const value = Math.max(1, Math.round(item.value * cond.mult * (0.9 + Math.random() * 0.25)));
  return { itemId: item.id, name: item.name, tier, condition: cond.id, conditionLabel: cond.label, value };
}

// --- Fluctuating market price -------------------------------------------------
// A per-item daily multiplier (0.8..1.25) seeded by day so "market knowledge"
// is learnable: prices move over time but are stable within a day.
export function marketMultiplier(itemId, day) {
  // Deterministic pseudo-random from itemId + day.
  let h = 0;
  const s = itemId + ':' + day;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const n = (h % 1000) / 1000; // 0..1
  return 0.8 + n * 0.45;
}

// True (fluctuating) value of an item the player holds, given the current day.
export function trueValue(invItem, day) {
  const base = ITEMS_BY_ID[invItem.itemId]?.value ?? invItem.value;
  const condMult = CONDITIONS.find((c) => c.id === invItem.condition)?.mult ?? 1;
  return Math.round(base * condMult * marketMultiplier(invItem.itemId, day));
}

// Store buys below value (needs margin); pawn pays even less.
export function flipStoreOffer(invItem, day) {
  return Math.max(1, Math.round(trueValue(invItem, day) * 0.7));
}
export function pawnOffer(invItem, day) {
  return Math.max(1, Math.round(trueValue(invItem, day) * 0.5));
}

// Pawn shop is pickier: only buys ordinary+ items.
export function pawnAccepts(invItem) {
  const it = ITEMS_BY_ID[invItem.itemId];
  return it && it.tier !== 'junk';
}

// An NPC buyer who wants a specific item, paying above store (the flip path).
// Returns { wants, baseOffer } - the haggle then pushes from baseOffer.
export function npcBuyerFor(invItem, day, charisma) {
  const tv = trueValue(invItem, day);
  // Buyer starts near 0.85x true value; charisma raises the ceiling later.
  const baseOffer = Math.max(1, Math.round(tv * (0.8 + Math.random() * 0.12)));
  return { baseOffer, trueValue: tv, charisma };
}
