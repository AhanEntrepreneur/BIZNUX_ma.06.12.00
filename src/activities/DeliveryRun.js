import Phaser from 'phaser';
import { TILE_SIZE, PALETTE, FONT_FAMILY } from '../config.js';
import { EventBus, EVENTS } from '../eventbus.js';
import { resolveOutcome, updateRating } from '../core/LuckEngine.js';

// DeliveryRun - the Delivery Rider as REAL in-world navigation (Part 2.2).
// Not a click-meter: the player physically finds and reaches a destination
// across the bigger city within a time window. A scooter sprite (a simple
// speed boost) is granted for the run. Getting lost or dawdling eats the
// window. On-time hand-off pays + tips + raises the delivery rating.
//
// Mirrors DogWalk's shell (WorldScene routes movement + Space here while
// active) so the two feel like the same kind of activity.
export default class DeliveryRun {
  constructor(scene) {
    this.scene = scene;
    this.gs = scene.gs;
    this.active = false;
  }

  begin(booking) {
    this.active = true;
    this.booking = booking; // { fee, pickup, dropoff, secondsAllowed }
    this.phase = 'topickup'; // 'topickup' | 'todropoff'
    this.remaining = booking.secondsAllowed;
    this.player = this.scene.player;

    // Scooter speed boost for the run.
    this._oldSpeed = this.player.speedScale ?? 1;
    this.player.speedScale = 1.7;

    this.scene.setObjective(booking.pickup.x, booking.pickup.y, 'Pick up parcel');
    this.toast(`Parcel job! Reach the pickup, then deliver. ${booking.secondsAllowed}s.`, PALETTE.accent);

    // Countdown timer (real seconds).
    this._timer = this.scene.time.addEvent({
      delay: 1000, loop: true, callback: () => {
        this.remaining--;
        EventBus.emit(EVENTS.WALK_PROGRESS, { elapsed: booking.secondsAllowed - this.remaining, duration: booking.secondsAllowed });
        if (this.remaining <= 0) this.finish(false);
      },
    });
  }

  // Called by WorldScene each frame while active.
  update() {
    if (!this.active) return;
    const goal = this.phase === 'topickup' ? this.booking.pickup : this.booking.dropoff;
    const ptx = this.player.x / TILE_SIZE;
    const pty = this.player.y / TILE_SIZE;
    const d = Math.hypot(ptx - (goal.x + 0.5), pty - (goal.y + 0.5));
    if (d < 1.4) {
      if (this.phase === 'topickup') {
        this.phase = 'todropoff';
        this.scene.setObjective(this.booking.dropoff.x, this.booking.dropoff.y, 'Deliver here');
        this.toast('Got the parcel! Now deliver it.', PALETTE.money);
      } else {
        this.finish(true);
      }
    }
  }

  // Space does nothing special mid-run; hand-off is automatic on arrival. Kept
  // for parity with the activity routing contract.
  onConfirm() { return false; }

  finish(delivered) {
    if (!this.active) return;
    this.active = false;
    if (this._timer) this._timer.remove();
    if (this.player) this.player.speedScale = this._oldSpeed ?? 1;
    this.scene.clearObjective();

    // Performance: how much time was left (on-time = good). Not delivered = bad.
    const frac = Math.max(0, this.remaining) / this.booking.secondsAllowed;
    const perf = delivered ? Phaser.Math.Clamp(0.4 + frac, 0, 1) : 0.05;
    const s = this.gs.data.stats;
    const statBonus = Math.min(1, s.strength / 25);
    const outcome = resolveOutcome(perf, statBonus);

    let fee = this.booking.fee;
    if (this.gs.data.weather === 'rainy') fee = Math.round(fee * 0.8);
    let tip = delivered && outcome.score >= 0.5 ? Math.round(fee * (outcome.score - 0.4)) : 0;
    const total = delivered ? Math.max(0, fee + tip) : 0;

    const oldR = this.gs.jobRating('delivery');
    const newR = updateRating(oldR, delivered ? outcome.stars : 1);
    this.gs.setJobRating('delivery', newR);
    if (total > 0) this.gs.changeCash(total, 'delivery');
    if (delivered && outcome.score > 0.5) this.gs.changeStat('strength', 1);

    if (delivered) this.toast(`Delivered! ${outcome.tier}. +$${total} (rating ${newR.toFixed(1)})`, PALETTE.money);
    else this.toast('Too late - delivery failed. Rating dropped.', PALETTE.danger);
  }

  toast(text, color = PALETTE.text) { EventBus.emit(EVENTS.TOAST, { text, color }); }
}
