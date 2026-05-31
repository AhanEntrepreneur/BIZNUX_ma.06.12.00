import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, PALETTE } from '../config.js';
import { JOBS } from '../data/jobs.js';
import { gameState } from '../core/GameState.js';
import { resolveOutcome, updateRating } from '../core/LuckEngine.js';

// JobActivity - the deep, procedural work shift for cafe / retail / busker
// (delivery is an in-world navigation activity; see DeliveryRun). Runs as a
// scene over the paused world. Each job is a genuinely different PROCEDURE with
// real steps, timing pressure, and decisions - never a single repeated button.
//
// Common shell (matches the dog walk): the player performs a sequence of real
// tasks under time/patience pressure; performance (0..1) routes through the
// luck engine into pay + tip + a persistent rating that gates future shifts.
export default class JobActivity extends Phaser.Scene {
  constructor() {
    super('JobActivity');
  }

  create({ jobId }) {
    this.jobId = jobId;
    this.job = JOBS[jobId];
    this.gs = gameState;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a0a12, 0.92).setOrigin(0);
    this.titleText = this.add.text(GAME_WIDTH / 2, 8, this.job.title.toUpperCase(), {
      fontFamily: FONT_FAMILY, fontSize: '8px', color: '#ffd24b',
    }).setOrigin(0.5, 0);
    this.statusText = this.add.text(GAME_WIDTH / 2, 20, '', {
      fontFamily: FONT_FAMILY, fontSize: '6px', color: '#9aa0c0',
    }).setOrigin(0.5, 0);
    this.bodyText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, '', {
      fontFamily: FONT_FAMILY, fontSize: '8px', color: '#ffffff', align: 'center', lineSpacing: 4,
      wordWrap: { width: GAME_WIDTH - 40 },
    }).setOrigin(0.5);
    this.hintText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 14, '', {
      fontFamily: FONT_FAMILY, fontSize: '6px', color: '#9aa0c0',
    }).setOrigin(0.5);

    // Score accumulators shared by all procedures.
    this.served = 0;
    this.target = 6; // tasks to complete this shift
    this.quality = []; // 0..1 per completed task
    this.fails = 0;

    // Fatigue makes things harder (less time per task).
    this.fatigueFactor = 1 - Math.min(0.4, this.gs.data.fatigue / 250);

    const kb = this.input.keyboard;
    this.keys = {
      space: kb.addKey('SPACE'), enter: kb.addKey('ENTER'),
      one: kb.addKey('ONE'), two: kb.addKey('TWO'), three: kb.addKey('THREE'), four: kb.addKey('FOUR'),
      left: kb.addKey('LEFT'), right: kb.addKey('RIGHT'), up: kb.addKey('UP'), down: kb.addKey('DOWN'),
    };

    if (jobId === 'cafe') this.startCafe();
    else if (jobId === 'retail') this.startRetail();
    else if (jobId === 'busker') this.startBusker();
    else this.startGeneric();
  }

  // ===================== CAFE: make-the-drink precision =====================
  // Each customer orders a drink = an ordered sequence of steps. The player
  // executes the steps in order with number keys; a timing bar rewards stopping
  // the "pull"/"steam" in the green zone. Wrong order or bad timing drops
  // quality. Serve before the patience bar empties.
  startCafe() {
    this.steps = ['GRIND', 'PULL', 'STEAM', 'POUR']; // 1..4
    this.nextCustomer();
    this.hintText.setText('Press 1-4 in order: 1 Grind  2 Pull  3 Steam  4 Pour');
  }

  nextCustomer() {
    if (this.served + this.fails >= this.target) return this.finish();
    // Order = full sequence, sometimes with an "extra" repeat to juggle.
    this.order = ['GRIND', 'PULL', 'STEAM', 'POUR'];
    this.orderIdx = 0;
    this.patience = 1; // 1..0
    this.statusText.setText(`Customer ${this.served + this.fails + 1}/${this.target}`);
    this.renderCafe();
    if (this.tick) this.tick.remove();
    this.tick = this.time.addEvent({
      delay: 100, loop: true, callback: () => {
        this.patience -= 0.006 / this.fatigueFactor;
        if (this.patience <= 0) { this.cafeFail(); }
        else this.renderCafe();
      },
    });
  }

  renderCafe() {
    const done = this.order.slice(0, this.orderIdx).join(' ');
    const next = this.order[this.orderIdx] || '';
    const bar = '#'.repeat(Math.max(0, Math.round(this.patience * 20)));
    this.bodyText.setText(`Order: latte\n[${done}] -> ${next}\n\npatience ${bar}`);
  }

  cafeFail() {
    if (this.tick) this.tick.remove();
    this.fails++;
    this.quality.push(0.1);
    this.flash('Too slow! Customer left.', PALETTE.danger);
    this.time.delayedCall(700, () => this.nextCustomer());
  }

  update() {
    if (this.jobId === 'cafe' && this.order) {
      const want = this.order[this.orderIdx];
      let pressed = null;
      if (Phaser.Input.Keyboard.JustDown(this.keys.one)) pressed = 'GRIND';
      else if (Phaser.Input.Keyboard.JustDown(this.keys.two)) pressed = 'PULL';
      else if (Phaser.Input.Keyboard.JustDown(this.keys.three)) pressed = 'STEAM';
      else if (Phaser.Input.Keyboard.JustDown(this.keys.four)) pressed = 'POUR';
      if (pressed) {
        if (pressed === want) {
          this.orderIdx++;
          if (this.orderIdx >= this.order.length) this.cafeServe();
          else this.renderCafe();
        } else {
          this.patience -= 0.18; // wrong step costs patience
          this.flash('Wrong step!', PALETTE.danger);
        }
      }
    }
    if (this.jobId === 'retail') this.retailUpdate();
    if (this.jobId === 'busker') this.buskerUpdate();
  }

  cafeServe() {
    if (this.tick) this.tick.remove();
    const q = Phaser.Math.Clamp(this.patience + 0.2, 0, 1); // faster = better
    this.quality.push(q);
    this.served++;
    this.flash('Served! Nice.', PALETTE.money);
    this.time.delayedCall(600, () => this.nextCustomer());
  }

  // ===================== RETAIL: stock + till ==============================
  // Alternates two real tasks: STOCK (press the arrow that matches where a box
  // goes) and TILL (sum the prices and confirm the right total from choices).
  startRetail() {
    this.target = 6;
    this.hintText.setText('Stock: press the arrow shown.  Till: pick the correct total.');
    this.nextRetailTask();
  }

  nextRetailTask() {
    if (this.served + this.fails >= this.target) return this.finish();
    this.statusText.setText(`Task ${this.served + this.fails + 1}/${this.target}`);
    this.retailMode = Math.random() < 0.5 ? 'stock' : 'till';
    this.retailDeadline = this.time.now + 4200 * this.fatigueFactor;
    if (this.retailMode === 'stock') {
      const dirs = ['LEFT', 'RIGHT', 'UP', 'DOWN'];
      this.stockWant = dirs[Math.floor(Math.random() * 4)];
      this.bodyText.setText(`STOCK\nBox goes: ${this.stockWant}\n(press that arrow)`);
    } else {
      const a = Phaser.Math.Between(2, 9), b = Phaser.Math.Between(2, 9);
      this.tillSum = a + b;
      const opts = new Set([this.tillSum]);
      while (opts.size < 3) opts.add(this.tillSum + Phaser.Math.Between(-3, 3));
      this.tillOptions = [...opts].sort(() => Math.random() - 0.5);
      this.bodyText.setText(`TILL\nItems: $${a} + $${b}\n1) $${this.tillOptions[0]}  2) $${this.tillOptions[1]}  3) $${this.tillOptions[2]}`);
    }
  }

  retailUpdate() {
    if (!this.retailMode) return;
    if (this.time.now > this.retailDeadline) {
      this.fails++; this.quality.push(0.1);
      this.flash('Too slow!', PALETTE.danger);
      this.retailMode = null;
      this.time.delayedCall(600, () => this.nextRetailTask());
      return;
    }
    if (this.retailMode === 'stock') {
      const map = { LEFT: this.keys.left, RIGHT: this.keys.right, UP: this.keys.up, DOWN: this.keys.down };
      for (const [dir, key] of Object.entries(map)) {
        if (Phaser.Input.Keyboard.JustDown(key)) {
          const ok = dir === this.stockWant;
          this.quality.push(ok ? 0.95 : 0.2);
          ok ? this.served++ : this.fails++;
          this.flash(ok ? 'Shelved!' : 'Wrong shelf!', ok ? PALETTE.money : PALETTE.danger);
          this.retailMode = null;
          this.time.delayedCall(500, () => this.nextRetailTask());
          return;
        }
      }
    } else {
      const nums = [this.keys.one, this.keys.two, this.keys.three];
      for (let i = 0; i < 3; i++) {
        if (Phaser.Input.Keyboard.JustDown(nums[i])) {
          const ok = this.tillOptions[i] === this.tillSum;
          this.quality.push(ok ? 1 : 0.15);
          ok ? this.served++ : this.fails++;
          this.flash(ok ? 'Correct change!' : 'Wrong total!', ok ? PALETTE.money : PALETTE.danger);
          this.retailMode = null;
          this.time.delayedCall(500, () => this.nextRetailTask());
          return;
        }
      }
    }
  }

  // ===================== BUSKER: rhythm ====================================
  // Beats scroll in; press SPACE when the marker is in the hit zone. Timing
  // accuracy is the quality. Crowd grows with good hits, thins on misses.
  startBusker() {
    this.target = 10;
    this.beatActive = false;
    this.hintText.setText('Press SPACE when the note reaches the line.');
    this.crowd = 1;
    this.scheduleBeat();
  }

  scheduleBeat() {
    if (this.served + this.fails >= this.target) return this.finish();
    this.beatStart = this.time.now;
    this.beatDur = 1100 * this.fatigueFactor;
    this.beatActive = true;
    this.statusText.setText(`Note ${this.served + this.fails + 1}/${this.target}   crowd ${this.crowd}`);
  }

  buskerUpdate() {
    if (!this.beatActive) return;
    const t = (this.time.now - this.beatStart) / this.beatDur; // 0..1 marker pos
    const pos = Math.round(t * 24);
    const line = '-'.repeat(Math.min(24, pos)) + 'O' + '-'.repeat(Math.max(0, 24 - pos));
    this.bodyText.setText(`|${line}|\n            ^ hit here near the end`);
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      // Best timing near t=1 (the line at the right).
      const acc = 1 - Math.min(1, Math.abs(1 - t) * 3);
      this.beatActive = false;
      if (acc > 0.4) { this.served++; this.quality.push(acc); this.crowd = Math.min(12, this.crowd + 1); this.flash('Nice!', PALETTE.money); }
      else { this.fails++; this.quality.push(0.15); this.crowd = Math.max(0, this.crowd - 1); this.flash('Off beat!', PALETTE.danger); }
      this.time.delayedCall(350, () => this.scheduleBeat());
    } else if (t > 1.25) {
      this.beatActive = false; this.fails++; this.quality.push(0.1); this.crowd = Math.max(0, this.crowd - 1);
      this.flash('Missed!', PALETTE.danger);
      this.time.delayedCall(350, () => this.scheduleBeat());
    }
  }

  startGeneric() { this.finish(); }

  flash(msg, color) {
    this.statusText.setText(msg);
    this.statusText.setColor('#' + color.toString(16).padStart(6, '0'));
  }

  // ===================== Resolve ==========================================
  finish() {
    if (this.tick) this.tick.remove();
    const perf = this.quality.length
      ? this.quality.reduce((a, b) => a + b, 0) / this.quality.length
      : 0.2;

    const s = this.gs.data.stats;
    const statKey = this.job.trains;
    const statBonus = Math.min(1, (s[statKey] + (this.jobId === 'busker' ? (this.crowd || 0) : 0)) / 30);
    const outcome = resolveOutcome(perf, statBonus);

    let pay = Math.round(this.job.dailyWage * (0.4 + outcome.score * 0.8));
    if (this.job.outdoor && this.gs.data.weather === 'rainy') pay = Math.round(pay * 0.7);
    let tip = outcome.score >= 0.5 ? Math.round(pay * (outcome.score - 0.4) * (0.5 + s.charisma / 40)) : 0;
    const total = Math.max(0, pay + tip);

    const oldR = this.gs.jobRating(this.jobId);
    const newR = updateRating(oldR, outcome.stars);
    this.gs.setJobRating(this.jobId, newR);
    this.gs.changeCash(total, 'shift');
    this.gs.changeStat(statKey, outcome.score > 0.5 ? 1 : 0);
    if (this.gs.data.job) this.gs.data.job.shiftsWorked++;
    // A genuinely bad shift is a strike toward being fired.
    if (outcome.score < 0.3) this.gs.recordJobProblem();

    const stars = '*'.repeat(outcome.stars) + '.'.repeat(5 - outcome.stars);
    this.bodyText.setText(`SHIFT COMPLETE\n${stars}\nServed ${this.served}, missed ${this.fails}\nPay $${pay} + tip $${tip} = $${total}\nrating ${oldR.toFixed(1)} -> ${newR.toFixed(1)}`);
    this.statusText.setText('');
    this.hintText.setText('Press SPACE to finish');
    this.input.keyboard.once('keydown-SPACE', () => this.close());
    this.input.keyboard.once('keydown-ENTER', () => this.close());
    this.input.keyboard.once('keydown-E', () => this.close());
  }

  close() {
    this.scene.resume('WorldScene');
    this.scene.stop();
  }
}
