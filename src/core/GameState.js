// ---------------------------------------------------------------------------
// GameState - the authoritative player + world data, with NO Phaser imports.
//
// This is deliberately framework-agnostic plain JS. In v1 it lives in the
// browser and is the single source of truth for one local player. When we move
// to multiplayer, THIS module (or a close cousin) moves to the authoritative
// server: scenes already read/mutate state only through these methods and the
// EventBus, so the rendering layer won't need rewriting.
//
// Persistence in v1 is localStorage (see save/load). On the server it becomes a
// database row. The shape is intentionally JSON-serializable.
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

// A fresh character record. `appearance` is chosen at character creation.
function freshCharacter(appearance) {
  return {
    version: 1,
    createdAt: Date.now(),
    name: appearance.name || 'Newcomer',
    appearance: {
      body: appearance.body || 'masc', // 'masc' | 'fem'
      face: appearance.face ?? 0, // 0..14
      hair: appearance.hair ?? 0, // 0..7  (hairstyle index)
      hairColor: appearance.hairColor ?? 0, // palette index
      outfit: appearance.outfit ?? 0, // starter outfit index
      formal: false, // is the current outfit formal?
    },
    stats: { ...DEFAULT_STATS },
    cash: ECONOMY.STARTING_CASH,
    fatigue: 0,
    // Job: a contract reference + employer reputation. null = unemployed.
    job: null, // { id, employerRep, shiftsWorked, hiredDay }
    ownsHome: false, // v1: buying a home flips this (kills rent)
    // World clock, in absolute in-game minutes since the character was created.
    // Starts at START_HOUR on day 1.
    clockMinutes: TIME.START_HOUR * 60,
    // Last day we charged rent / paid wages, so offline catch-up is idempotent.
    lastSettledDay: 1,
    weather: 'sunny',
    // crime/wanted reserved for later milestones
    wanted: 0,
  };
}

export class GameState {
  constructor() {
    this.data = null; // the character record (null until created/loaded)
  }

  // --- Lifecycle ------------------------------------------------------------

  createCharacter(appearance) {
    this.data = freshCharacter(appearance);
    this.save();
    return this.data;
  }

  hasSave() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      this.data = JSON.parse(raw);
      return true;
    } catch {
      return false;
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage may be unavailable; v1 tolerates this */
    }
  }

  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    this.data = null;
  }

  // --- Derived time helpers -------------------------------------------------

  get day() {
    return Math.floor(this.data.clockMinutes / (TIME.HOURS_PER_DAY * 60)) + 1;
  }

  get hour() {
    return Math.floor(this.data.clockMinutes / 60) % TIME.HOURS_PER_DAY;
  }

  get minute() {
    return this.data.clockMinutes % 60;
  }

  // Advance the world clock by N in-game minutes; fires tick/hour/day events
  // and runs daily settlement (rent + wages) when a day boundary is crossed.
  advanceMinutes(mins) {
    if (!this.data) return;
    const prevHour = Math.floor(this.data.clockMinutes / 60);
    const prevDay = this.day;

    this.data.clockMinutes += mins;

    // Fatigue accrues with awake time.
    const hoursElapsed = mins / 60;
    this.changeFatigue(hoursElapsed * PLAYER.FATIGUE_PER_GAME_HOUR);

    const newHour = Math.floor(this.data.clockMinutes / 60);
    if (newHour !== prevHour) {
      EventBus.emit(EVENTS.HOUR_PASSED, { hour: this.hour, day: this.day });
    }

    const newDay = this.day;
    if (newDay !== prevDay) {
      // Settle every day boundary we crossed (covers offline catch-up).
      for (let d = prevDay; d < newDay; d++) this.settleDay(d + 1);
      EventBus.emit(EVENTS.DAY_PASSED, { day: newDay });
    }

    EventBus.emit(EVENTS.TIME_TICK, {
      hour: this.hour,
      minute: this.minute,
      day: this.day,
      totalMinutes: this.data.clockMinutes,
    });
  }

  // Midnight settlement: pay daily wage (if employed) then charge rent.
  settleDay(day) {
    if (this.data.lastSettledDay >= day) return; // idempotent
    this.data.lastSettledDay = day;

    if (this.data.job) {
      const wage = this.dailyWageFor(this.data.job.id);
      if (wage > 0) this.changeCash(wage, 'wages');
    }

    if (!this.data.ownsHome) {
      this.changeCash(-ECONOMY.DAILY_RENT, 'rent');
    }
  }

  // Wage is defined by job data; imported lazily to avoid a config cycle.
  dailyWageFor(jobId) {
    // Required here to keep GameState free of a static import cycle.
    // (jobs.js imports nothing heavy.)
    // eslint-disable-next-line no-undef
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

  sleep() {
    this.data.fatigue = 0;
    EventBus.emit(EVENTS.FATIGUE_CHANGED, { fatigue: 0 });
    this.save();
  }

  setJob(jobId) {
    this.data.job = jobId
      ? { id: jobId, employerRep: 50, shiftsWorked: 0, hiredDay: this.day }
      : null;
    EventBus.emit(EVENTS.JOB_CHANGED, { jobId });
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
    this.changeStat('reputation', 5);
    this.changeStat('confidence', 5);
    this.save();
    return true;
  }
}

// Jobs table is injected once at boot (see main.js) to avoid an import cycle
// between GameState and data/jobs while keeping wage logic in one place.
GameState._jobsTable = null;

// A single shared instance for v1's local player.
export const gameState = new GameState();
