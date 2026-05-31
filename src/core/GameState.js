// ---------------------------------------------------------------------------
// GameState - the authoritative player + world data, with NO Phaser imports.
//
// Framework-agnostic plain JS and the single source of truth for the local
// player. In v1 it lives in the browser (saved to localStorage); when we move
// to multiplayer THIS module moves to the authoritative server - scenes already
// read/mutate state only through these methods + the EventBus, so the rendering
// layer won't need rewriting. The shape is intentionally JSON-serializable.
//
// MA.06.12.00 adds the realistic money pressure: rent->eviction, a starter loan
// EMI + credit score, recurring bills, hunger, and per-gig ratings/stats.
// ---------------------------------------------------------------------------
import {
  ECONOMY,
  DEFAULT_STATS,
  STAT_KEYS,
  STAT_MAX,
  TIME,
  PLAYER,
  SAVE_KEY,
} from '../config.js';
import { EventBus, EVENTS } from '../eventbus.js';

function freshCharacter(appearance) {
  return {
    version: 2,
    createdAt: Date.now(),
    name: appearance.name || 'Newcomer',
    appearance: {
      body: appearance.body || 'masc',
      face: appearance.face ?? 0,
      hair: appearance.hair ?? 0,
      hairColor: appearance.hairColor ?? 0,
      outfit: appearance.outfit ?? 0,
      formal: false,
    },
    stats: { ...DEFAULT_STATS },
    cash: ECONOMY.STARTING_CASH,
    fatigue: 0,
    hunger: 0,

    // Employment (formal jobs).
    job: null, // { id, employerRep, shiftsWorked, hiredDay, missedShifts, warned }

    // Gig economy: per-gig persistent rating + stats (precarity loop).
    dogRating: 3.0, // 0..5 stars, starts middling
    gigStats: {}, // { dogwalk: { done, good, bad } }
    poopBags: ECONOMY.STARTING_BAGS,

    // Housing.
    ownsHome: false,
    evicted: false,
    rentMissed: 0,

    // Debt + credit.
    loanBalance: ECONOMY.LOAN_PRINCIPAL,
    emiMissed: 0,
    creditScore: ECONOMY.CREDIT_START,

    // World clock (absolute in-game minutes since creation; starts at START_HOUR).
    clockMinutes: TIME.START_HOUR * 60,
    lastSettledDay: 1,
    nextEmiDay: ECONOMY.EMI_INTERVAL_DAYS + 1,
    nextBillDay: ECONOMY.BILL_INTERVAL_DAYS + 1,

    weather: 'sunny',
    wanted: 0,
  };
}

export class GameState {
  constructor() {
    this.data = null;
  }

  // --- Lifecycle ------------------------------------------------------------
  createCharacter(appearance) {
    this.data = freshCharacter(appearance);
    this.save();
    return this.data;
  }

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      // Forward-migrate older saves so new fields exist with sane defaults.
      this.data = { ...freshCharacter(parsed.appearance || {}), ...parsed };
      this.data.stats = { ...DEFAULT_STATS, ...(parsed.stats || {}) };
      return true;
    } catch { return false; }
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    this.data = null;
  }

  // --- Derived time ---------------------------------------------------------
  get day() { return Math.floor(this.data.clockMinutes / (TIME.HOURS_PER_DAY * 60)) + 1; }
  get hour() { return Math.floor(this.data.clockMinutes / 60) % TIME.HOURS_PER_DAY; }
  get minute() { return this.data.clockMinutes % 60; }

  advanceMinutes(mins) {
    if (!this.data) return;
    const prevHour = Math.floor(this.data.clockMinutes / 60);
    const prevDay = this.day;

    this.data.clockMinutes += mins;

    const hoursElapsed = mins / 60;
    this.changeFatigue(hoursElapsed * PLAYER.FATIGUE_PER_GAME_HOUR);
    this.changeHunger(hoursElapsed * ECONOMY.HUNGER_PER_GAME_HOUR);

    const newHour = Math.floor(this.data.clockMinutes / 60);
    if (newHour !== prevHour) EventBus.emit(EVENTS.HOUR_PASSED, { hour: this.hour, day: this.day });

    const newDay = this.day;
    if (newDay !== prevDay) {
      for (let d = prevDay; d < newDay; d++) this.settleDay(d + 1);
      EventBus.emit(EVENTS.DAY_PASSED, { day: newDay });
    }

    EventBus.emit(EVENTS.TIME_TICK, {
      hour: this.hour, minute: this.minute, day: this.day, totalMinutes: this.data.clockMinutes,
    });
  }

  // Midnight settlement: wages, rent->eviction, EMI->credit, bills.
  settleDay(day) {
    if (this.data.lastSettledDay >= day) return;
    this.data.lastSettledDay = day;

    // Daily wage for a held formal job.
    if (this.data.job) {
      const wage = this.dailyWageFor(this.data.job.id);
      if (wage > 0) this.changeCash(wage, 'wages');
    }

    // Rent (only if renting). Missing it warns, then evicts.
    if (!this.data.ownsHome && !this.data.evicted) {
      if (this.data.cash >= ECONOMY.DAILY_RENT) {
        this.changeCash(-ECONOMY.DAILY_RENT, 'rent');
        if (this.data.rentMissed > 0) this.data.rentMissed = 0;
      } else {
        this.data.rentMissed++;
        this.adjustCredit(-15);
        if (this.data.rentMissed >= ECONOMY.RENT_MISS_LIMIT) {
          this.evict();
        } else {
          this.notify('rent_warning', `Rent unpaid! Warning ${this.data.rentMissed}/${ECONOMY.RENT_MISS_LIMIT}.`);
        }
      }
    }

    // EMI on its schedule.
    if (day >= this.data.nextEmiDay && this.data.loanBalance > 0) {
      this.data.nextEmiDay += ECONOMY.EMI_INTERVAL_DAYS;
      if (this.data.cash >= ECONOMY.EMI_AMOUNT) {
        this.changeCash(-ECONOMY.EMI_AMOUNT, 'emi');
        this.data.loanBalance = Math.max(0, this.data.loanBalance - ECONOMY.EMI_AMOUNT);
        this.adjustCredit(+8);
        this.data.emiMissed = 0;
      } else {
        this.data.emiMissed++;
        this.adjustCredit(-30);
        this.notify('emi_missed', `Loan EMI missed! (${this.data.emiMissed}/${ECONOMY.EMI_MISS_LIMIT})`);
      }
    }

    // Recurring bills on their schedule.
    if (day >= this.data.nextBillDay) {
      this.data.nextBillDay += ECONOMY.BILL_INTERVAL_DAYS;
      const bill = ECONOMY.PHONE_BILL + ECONOMY.UTILITIES_BILL;
      if (this.data.cash >= bill) {
        this.changeCash(-bill, 'bills');
      } else {
        this.adjustCredit(-10);
        this.notify('bill_missed', 'Bills unpaid - services strained.');
      }
    }
  }

  dailyWageFor(jobId) {
    const jobs = GameState._jobsTable;
    const job = jobs && jobs[jobId];
    return job ? job.dailyWage : 0;
  }

  // --- Mutators (emit events so UI stays in sync) ---------------------------
  changeCash(delta, reason = '') {
    this.data.cash = Math.max(0, Math.round(this.data.cash + delta));
    EventBus.emit(EVENTS.MONEY_CHANGED, { cash: this.data.cash, delta, reason });
    this.save();
  }

  changeStat(key, delta) {
    if (!STAT_KEYS.includes(key)) return;
    this.data.stats[key] = Math.max(0, Math.min(STAT_MAX, this.data.stats[key] + delta));
    EventBus.emit(EVENTS.STATS_CHANGED, { stats: { ...this.data.stats } });
    this.save();
  }

  changeFatigue(delta) {
    this.data.fatigue = Math.max(0, Math.min(100, this.data.fatigue + delta));
    EventBus.emit(EVENTS.FATIGUE_CHANGED, { fatigue: this.data.fatigue });
  }

  changeHunger(delta) {
    this.data.hunger = Math.max(0, Math.min(100, this.data.hunger + delta));
  }

  eat() {
    if (this.data.cash < ECONOMY.MEAL_COST) return false;
    this.changeCash(-ECONOMY.MEAL_COST, 'food');
    this.data.hunger = 0;
    this.save();
    return true;
  }

  sleep() {
    // Eviction means worse sleep: fatigue never clears fully on the street.
    this.data.fatigue = this.data.evicted ? ECONOMY.EVICTED_FATIGUE_FLOOR : 0;
    EventBus.emit(EVENTS.FATIGUE_CHANGED, { fatigue: this.data.fatigue });
    this.save();
  }

  setJob(jobId) {
    this.data.job = jobId
      ? { id: jobId, employerRep: 50, shiftsWorked: 0, hiredDay: this.day, missedShifts: 0, warned: false }
      : null;
    EventBus.emit(EVENTS.JOB_CHANGED, { jobId });
    this.save();
  }

  // Boss pressure: record a missed/poor shift; warn then fire.
  recordJobProblem() {
    if (!this.data.job) return;
    this.data.job.missedShifts = (this.data.job.missedShifts || 0) + 1;
    this.changeStat('reputation', -1);
    if (this.data.job.missedShifts >= 3) {
      const fired = this.data.job.id;
      this.data.job = null;
      this.notify('fired', 'You were FIRED for poor performance.');
      EventBus.emit(EVENTS.JOB_CHANGED, { jobId: null, fired });
    } else if (!this.data.job.warned && this.data.job.missedShifts >= 2) {
      this.data.job.warned = true;
      this.notify('job_warning', 'Your boss issued a warning.');
    }
    this.save();
  }

  setWeather(weather) {
    this.data.weather = weather;
    EventBus.emit(EVENTS.WEATHER_CHANGED, { weather });
  }

  buyHome(price) {
    if (this.data.cash < price) return false;
    this.changeCash(-price, 'home');
    this.data.ownsHome = true;
    this.data.evicted = false;
    this.data.rentMissed = 0;
    this.changeStat('reputation', 5);
    this.changeStat('confidence', 5);
    this.save();
    return true;
  }

  evict() {
    this.data.evicted = true;
    this.data.rentMissed = 0;
    this.changeStat('reputation', -8);
    this.changeStat('confidence', -5);
    this.adjustCredit(-40);
    this.notify('evicted', 'EVICTED! You are on the street.');
    this.save();
  }

  adjustCredit(delta) {
    this.data.creditScore = Math.max(ECONOMY.CREDIT_MIN, Math.min(ECONOMY.CREDIT_MAX, this.data.creditScore + delta));
  }

  // --- Gig economy ----------------------------------------------------------
  setDogRating(r) {
    this.data.dogRating = Math.max(0, Math.min(5, r));
    this.save();
  }

  recordGig(gigId, good) {
    const g = this.data.gigStats[gigId] || { done: 0, good: 0, bad: 0 };
    g.done++;
    if (good) g.good++; else g.bad++;
    this.data.gigStats[gigId] = g;
    this.save();
  }

  useBag() {
    if (this.data.poopBags > 0) { this.data.poopBags--; this.save(); return true; }
    return false;
  }

  buyBags() {
    if (this.data.cash < ECONOMY.POOP_BAG_COST) return false;
    this.changeCash(-ECONOMY.POOP_BAG_COST, 'bags');
    this.data.poopBags += ECONOMY.POOP_BAGS_PER_PACK;
    this.save();
    return true;
  }

  // A toast + structured notification (UI listens for the toast; the key lets
  // future systems react, e.g. a screen shake on 'evicted'/'fired').
  notify(key, text) {
    EventBus.emit(EVENTS.TOAST, { text, color: 0xe05a5a, key });
  }
}

GameState._jobsTable = null;

export const gameState = new GameState();
