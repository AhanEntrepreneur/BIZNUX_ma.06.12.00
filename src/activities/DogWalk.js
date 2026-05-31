import Phaser from 'phaser';
import { TILE_SIZE, PALETTE, FONT_FAMILY } from '../config.js';
import { KEYS } from '../data/assetManifest.js';
import { EventBus, EVENTS } from '../eventbus.js';
import Dog from '../entities/Dog.js';
import { resolveOutcome, updateRating, reviewLine } from '../core/LuckEngine.js';

// DogWalk - the full PROCEDURAL dog-walking activity (Section 3). This is the
// template every future job will copy. It is NOT a click meter: the player
// physically walks a leashed dog for the booked duration while events demand
// real responses (wait while it sniffs, clean up after it poops, regain control
// when it pulls), then returns it for a fee + tip + star rating resolved through
// the LuckEngine.
//
// WorldScene owns the booking/travel; DogWalk owns everything from pickup to
// payment. While `active`, WorldScene routes Space to DogWalk.onConfirm().
export default class DogWalk {
  constructor(scene) {
    this.scene = scene;
    this.gs = scene.gs;
    this.active = false;
    this.dog = null;
  }

  // --- Begin (called when the player interacts at the client's door) --------
  begin(booking) {
    this.active = true;
    this.booking = booking;
    this.phase = 'walking'; // 'walking' | 'returning' | 'done'
    this.elapsed = 0; // in-game minutes walked
    this.duration = booking.durationMin;
    this.hasBags = this.gs.data.poopBags > 0;

    // Performance trackers feed the outcome.
    this.score = { onTime: 0, cleaned: 0, missedCleanups: 0, lostControl: 0, sniffsHandled: 0 };
    this.pendingPoop = null; // {sprite, x, y, timer}
    this.pulling = false;

    // Spawn the dog beside the player.
    const p = this.scene.player;
    this.dog = new Dog(this.scene, p.x + 10, p.y + 6);

    // Owner hint based on the client's mood.
    const hint = {
      energetic: 'Buddy is full of energy today!',
      calm: 'Bella is calm and easy.',
      'old-and-slow': 'Old Max walks slowly, be patient.',
      anxious: "Coco is anxious - don't rush her.",
      reactive: "Rex doesn't like other dogs. Keep control!",
    }[booking.clientMood] || 'Take good care of them!';

    EventBus.emit(EVENTS.DIALOGUE_START, {
      name: booking.dogName + "'s Owner",
      lines: [hint, `Walk for ${this.duration} minutes, then bring them back.`],
    });

    // The walk progresses with in-game time: subscribe to minute ticks.
    this._onTick = () => this.onMinute();
    EventBus.on(EVENTS.TIME_TICK, this._onTick, this);

    // Schedule the first random event a few seconds in.
    this.scheduleNextEvent();

    this.toast('Walk started. Keep the dog moving!', PALETTE.accent);
    if (!this.hasBags) this.toast('You have no poop bags! Buy some next time.', PALETTE.danger);
  }

  scheduleNextEvent() {
    if (!this.active || this.phase !== 'walking') return;
    const delay = Phaser.Math.Between(3500, 7000);
    this._evtTimer = this.scene.time.delayedCall(delay, () => this.fireRandomEvent());
  }

  // --- Events ---------------------------------------------------------------
  fireRandomEvent() {
    if (!this.active || this.phase !== 'walking') return;
    // Mood weights which events are likely.
    const mood = this.booking.clientMood;
    const r = Math.random();
    if (mood === 'reactive' && r < 0.45) this.eventPull();
    else if (mood === 'old-and-slow' && r < 0.55) this.eventSniff();
    else if (r < 0.4) this.eventSniff();
    else if (r < 0.7) this.eventPoop();
    else this.eventPull();
    this.scheduleNextEvent();
  }

  // Dog stops to sniff: it plants, the player must WAIT (can't drag it without
  // a stress risk). Resolves after a few seconds.
  eventSniff() {
    if (!this.dog) return;
    this.dog.stopWalking();
    this.bubble('* sniff sniff *');
    this.sniffing = true;
    const waitMs = Phaser.Math.Between(2500, 4500);
    this._sniffTimer = this.scene.time.delayedCall(waitMs, () => {
      this.sniffing = false;
      this.dog.resume();
      this.score.sniffsHandled++;
      this.bubble('');
    });
  }

  // Dog poops: a prompt appears; the player must come clean it up (Space near
  // it) with a bag, or suffer a complaint + rating hit.
  eventPoop() {
    if (!this.dog || this.pendingPoop) return;
    this.dog.stopWalking();
    const x = this.dog.x;
    const y = this.dog.y + 4;
    const sprite = this.scene.add.image(x, y, KEYS.POOP).setDepth(y);
    this.bubble('* does its business *');
    this.scene.time.delayedCall(900, () => { this.dog?.resume(); this.bubble(''); });
    // Player has a window to clean up before a passerby notices.
    const noticeMs = 9000;
    const timer = this.scene.time.delayedCall(noticeMs, () => this.poopNoticed());
    this.pendingPoop = { sprite, x, y, timer };
    this.toast('Clean up after the dog! (walk over + Space)', PALETTE.accent);
  }

  poopNoticed() {
    if (!this.pendingPoop) return;
    this.score.missedCleanups++;
    this.toast('A passerby complained about the mess!', PALETTE.danger);
    // leave the poop on the ground as a visible consequence
    this.pendingPoop.sprite.setTint(0x886644);
    this.pendingPoop = null;
  }

  // Dog pulls toward something: a quick mash/confirm to regain control.
  eventPull() {
    if (!this.dog) return;
    const dir = Phaser.Math.Between(0, 3);
    const off = [[40, 0], [-40, 0], [0, 40], [0, -40]][dir];
    this.dog.pullTo(this.dog.x + off[0], this.dog.y + off[1]);
    this.pulling = true;
    this.pullPresses = 0;
    this.pullNeeded = this.gs.data.stats.strength >= 12 ? 2 : 3; // strength helps
    this.bubble('!! PULLS !!');
    this.toast('The dog pulls! Mash Space to hold the leash!', PALETTE.danger);
    this._pullTimer = this.scene.time.delayedCall(2600, () => this.resolvePull(false));
  }

  resolvePull(success) {
    if (!this.pulling) return;
    this.pulling = false;
    if (this._pullTimer) this._pullTimer.remove();
    this.dog?.resume();
    this.bubble('');
    if (success) {
      this.toast('You held on. Good control!', PALETTE.money);
    } else {
      this.score.lostControl++;
      this.toast('The dog broke loose for a moment!', PALETTE.danger);
      // small chance a bad pull ends the walk early
      if (Math.random() < 0.15) this.endWalkEarly();
    }
  }

  // --- Confirm routing (Space while walking) --------------------------------
  // WorldScene calls this when the player presses Space during the walk.
  onConfirm() {
    // Mashing to win a pull event takes priority.
    if (this.pulling) {
      this.pullPresses++;
      if (this.pullPresses >= this.pullNeeded) this.resolvePull(true);
      return true;
    }
    // Clean up poop if standing near it.
    if (this.pendingPoop) {
      const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, this.pendingPoop.x, this.pendingPoop.y);
      if (d < TILE_SIZE * 1.2) {
        if (this.hasBags) {
          this.gs.useBag();
          this.hasBags = this.gs.data.poopBags > 0;
          this.score.cleaned++;
          this.pendingPoop.timer.remove();
          this.pendingPoop.sprite.destroy();
          this.pendingPoop = null;
          this.toast('Cleaned up. Responsible!', PALETTE.money);
        } else {
          this.toast("No bags - you can't clean up!", PALETTE.danger);
        }
        return true;
      }
    }
    // When returning, confirm at the owner's door ends the job.
    if (this.phase === 'returning' && this.atOwnerDoor()) {
      this.finish();
      return true;
    }
    return false;
  }

  // --- Time / progress ------------------------------------------------------
  onMinute() {
    if (!this.active || this.phase !== 'walking') return;
    this.elapsed++;
    // Dragging a planted (sniffing) dog by walking away risks stress.
    if (this.sniffing) {
      const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, this.dog.x, this.dog.y);
      if (d > TILE_SIZE * 2.5 && Math.random() < 0.5) {
        this.toast('You yanked the leash - the dog is stressed!', PALETTE.danger);
        this.score.lostControl++;
      }
    }
    EventBus.emit(EVENTS.WALK_PROGRESS, { elapsed: this.elapsed, duration: this.duration });
    if (this.elapsed >= this.duration) this.beginReturn();
  }

  beginReturn() {
    this.phase = 'returning';
    this.score.onTime = 1;
    this.toast('Walk complete! Return the dog to the owner.', PALETTE.accent);
    // mark the owner's door again
    this.scene.setObjective(this.booking.doorX, this.booking.doorY, 'Return dog');
  }

  endWalkEarly() {
    this.phase = 'returning';
    this.score.onTime = 0;
    this.toast('The walk was cut short.', PALETTE.danger);
    this.scene.setObjective(this.booking.doorX, this.booking.doorY, 'Return dog');
  }

  atOwnerDoor() {
    const px = Math.floor(this.scene.player.x / TILE_SIZE);
    const py = Math.floor(this.scene.player.y / TILE_SIZE);
    return Math.abs(px - this.booking.doorX) <= 1 && Math.abs(py - this.booking.doorY) <= 1;
  }

  // --- Per-frame ------------------------------------------------------------
  update(dt) {
    if (!this.active || !this.dog) return;
    this.dog.follow(this.scene.player, dt);
    if (this._bubble && this._bubble.visible) this._bubble.setPosition(this.dog.x, this.dog.y - 8);
  }

  // --- Resolution -----------------------------------------------------------
  finish() {
    // Performance score 0..1 from how the walk went.
    let perf = 0.5;
    perf += this.score.onTime ? 0.2 : -0.15;
    perf += this.score.cleaned * 0.08;
    perf -= this.score.missedCleanups * 0.2;
    perf -= this.score.lostControl * 0.12;
    perf += Math.min(this.score.sniffsHandled, 3) * 0.03;
    perf = Math.max(0, Math.min(1, perf));

    // Stats tilt the result: CHA (tips/tone) + STR (control).
    const s = this.gs.data.stats;
    const statBonus = Math.min(1, (s.charisma + s.strength) / 60);

    const outcome = resolveOutcome(perf, statBonus);

    // Fee, with weather + tip. Rain skews pay down (Step 4 weather rule).
    let fee = this.booking.fee;
    if (this.gs.data.weather === 'rainy') fee = Math.round(fee * 0.8);
    // Tip scales with outcome + charisma; bad outcomes => no tip.
    let tip = 0;
    if (outcome.score >= 0.5) {
      tip = Math.round(fee * (outcome.score - 0.4) * (0.5 + s.charisma / 40));
    }
    const total = Math.max(0, fee + tip);

    // Persist rating + pay out.
    const oldRating = this.gs.data.dogRating;
    const newRating = updateRating(oldRating, outcome.stars);
    this.gs.setDogRating(newRating);
    this.gs.recordGig('dogwalk', outcome.tier !== 'disaster');
    this.gs.changeCash(total, 'dogwalk');

    const review = reviewLine(outcome.tier, this.score.cleaned > 0, this.score.lostControl > 0);

    // Clean up the activity, then show the result card via UIScene.
    this.teardown();
    this.scene.showWalkResult({
      stars: outcome.stars,
      tier: outcome.tier,
      fee, tip, total,
      oldRating, newRating,
      review,
      dogName: this.booking.dogName,
    });
  }

  teardown() {
    this.active = false;
    this.phase = 'done';
    if (this._onTick) EventBus.off(EVENTS.TIME_TICK, this._onTick, this);
    if (this._evtTimer) this._evtTimer.remove();
    if (this._sniffTimer) this._sniffTimer.remove();
    if (this._pullTimer) this._pullTimer.remove();
    if (this.pendingPoop) { this.pendingPoop.timer.remove(); this.pendingPoop.sprite.destroy(); this.pendingPoop = null; }
    if (this.dog) { this.dog.destroy(); this.dog = null; }
    this.scene.clearObjective();
  }

  // --- Small helpers --------------------------------------------------------
  bubble(text) {
    if (!this.dog) return;
    if (!this._bubble) {
      this._bubble = this.scene.add.text(0, 0, '', {
        fontFamily: FONT_FAMILY, fontSize: '6px', color: '#ffffff',
        backgroundColor: '#000000aa', padding: { x: 2, y: 1 },
      }).setOrigin(0.5, 1).setDepth(950001);
    }
    this._bubble.setText(text);
    this._bubble.setVisible(!!text);
    if (text) this._bubble.setPosition(this.dog.x, this.dog.y - 8);
  }

  toast(text, color = PALETTE.text) {
    EventBus.emit(EVENTS.TOAST, { text, color });
  }
}
