import Phaser from 'phaser';

// Global event emitter for cross-scene/system communication. Keeping this here
// (rather than scenes reaching into each other) is what will let us later route
// the same events over the network for multiplayer without rewriting systems.
export const EventBus = new Phaser.Events.EventEmitter();

export const EVENTS = {
  // Dialogue / interaction
  DIALOGUE_START: 'dialogue:start', // { name, lines }
  DIALOGUE_CLOSED: 'dialogue:closed',
  // Time
  TIME_TICK: 'time:tick', // { hour, minute, day, totalMinutes }
  HOUR_PASSED: 'time:hour', // { hour, day }
  DAY_PASSED: 'time:day', // { day }
  // Economy / player
  MONEY_CHANGED: 'money:changed', // { cash, delta, reason }
  STATS_CHANGED: 'stats:changed', // { stats }
  FATIGUE_CHANGED: 'fatigue:changed', // { fatigue }
  // Jobs
  JOB_CHANGED: 'job:changed', // { jobId }
  SHIFT_RESULT: 'job:shiftResult', // { jobId, score, pay }
  // World
  WEATHER_CHANGED: 'weather:changed', // { weather }
  TOAST: 'ui:toast', // { text, color }
  // Minigame (work shift)
  START_SHIFT: 'shift:start', // { jobId }
  END_SHIFT: 'shift:end', // { jobId, score }
};
