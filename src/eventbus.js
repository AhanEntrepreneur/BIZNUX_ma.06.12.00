import Phaser from 'phaser';

// A tiny global event emitter used for cross-scene communication, mainly between
// WorldScene (gameplay) and UIScene (dialogue/HUD). Keeping this separate avoids
// scenes reaching into each other's internals.
//
// Events used in v1:
//   'dialogue:start'  (payload: { name, lines })  -> ask UIScene to open a box
//   'dialogue:opened'                              -> UIScene -> lock player
//   'dialogue:closed'                              -> UIScene -> unlock player
export const EventBus = new Phaser.Events.EventEmitter();

export const EVENTS = {
  DIALOGUE_START: 'dialogue:start',
  DIALOGUE_OPENED: 'dialogue:opened',
  DIALOGUE_CLOSED: 'dialogue:closed',
};
