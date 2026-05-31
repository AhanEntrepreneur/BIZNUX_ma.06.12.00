import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, PALETTE } from '../config.js';
import { JOBS } from '../data/jobs.js';
import { gameState } from '../core/GameState.js';

// The work shift mini-game: targets pop up and must be clicked/tapped before
// they expire. Re-skinned per job (coffee cups, packages, music notes...).
// Runs over the paused WorldScene; on finish it resumes the world and reports
// a 0..1 score back via WorldScene.resolveShift.
//
// Fatigue makes it harder (faster target expiry) per the spec.
export default class MiniGameScene extends Phaser.Scene {
  constructor() {
    super('MiniGameScene');
  }

  create({ jobId }) {
    this.jobId = jobId;
    this.job = JOBS[jobId];
    this.hits = 0;
    this.misses = 0;
    this.totalTargets = 12;
    this.spawned = 0;

    // Dim the paused world behind us.
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0);

    this.add
      .text(GAME_WIDTH / 2, 14, this.job.minigame.label, {
        fontFamily: FONT_FAMILY, fontSize: '8px', color: '#ffffff',
      })
      .setOrigin(0.5);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 26, '', { fontFamily: FONT_FAMILY, fontSize: '6px', color: '#ffd24b' })
      .setOrigin(0.5);
    this.updateScore();

    // Fatigue scales the time each target stays clickable.
    const fatigue = gameState.data.fatigue;
    this.lifespan = Phaser.Math.Linear(1100, 650, Math.min(1, fatigue / 100));

    // Spawn targets on a cadence.
    this.spawnTimer = this.time.addEvent({
      delay: 700, loop: true, callback: () => this.spawnTarget(),
    });
    this.spawnTarget();
  }

  spawnTarget() {
    if (this.spawned >= this.totalTargets) {
      this.spawnTimer.remove();
      // give the last target time to be clicked or expire
      this.time.delayedCall(this.lifespan + 100, () => this.finish());
      return;
    }
    this.spawned++;

    const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
    const y = Phaser.Math.Between(42, GAME_HEIGHT - 20);
    const target = this.drawTarget(x, y, this.job.minigame.skin);
    target.setInteractive(new Phaser.Geom.Circle(0, 0, 12), Phaser.Geom.Circle.Contains);

    // pop-in
    target.setScale(0);
    this.tweens.add({ targets: target, scale: 1, duration: 120, ease: 'Back.out' });

    let resolved = false;
    const resolve = (hit) => {
      if (resolved) return;
      resolved = true;
      if (hit) { this.hits++; } else { this.misses++; }
      this.updateScore();
      this.tweens.add({
        targets: target, scale: 0, alpha: 0, duration: 120,
        onComplete: () => target.destroy(),
      });
    };

    target.on('pointerdown', () => resolve(true));
    this.time.delayedCall(this.lifespan, () => resolve(false));
  }

  // Draw a small re-skinned token as a Container of shapes.
  drawTarget(x, y, skin) {
    const c = this.add.container(x, y);
    const colorFor = {
      cup: 0xffffff, box: 0xc99a3a, note: 0x9a6cff, paw: 0xf0a0c0, tag: 0x6ee06e,
    };
    const base = colorFor[skin] || 0xffffff;
    const bg = this.add.circle(0, 0, 11, base);
    const ring = this.add.circle(0, 0, 11).setStrokeStyle(2, 0x000000, 0.6);
    const glyph = this.add
      .text(0, 0, this.glyphFor(skin), { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#1a1a1a' })
      .setOrigin(0.5);
    c.add([bg, ring, glyph]);
    return c;
  }

  glyphFor(skin) {
    return { cup: 'C', box: 'P', note: '#', paw: 'W', tag: '$' }[skin] || '*';
  }

  updateScore() {
    this.scoreText.setText(`Hits ${this.hits} / ${this.totalTargets}   Missed ${this.misses}`);
  }

  finish() {
    const score = this.totalTargets > 0 ? this.hits / this.totalTargets : 0;
    const world = this.scene.get('WorldScene');

    // Show a quick result line before handing back.
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 200, 40, PALETTE.panel)
      .setStrokeStyle(2, PALETTE.panelBorder);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `Shift complete!\n${this.hits}/${this.totalTargets} done`, {
        fontFamily: FONT_FAMILY, fontSize: '7px', color: '#ffffff', align: 'center',
      })
      .setOrigin(0.5);

    this.time.delayedCall(900, () => {
      world.resolveShift(this.jobId, score);
      this.scene.resume('WorldScene');
      this.scene.stop();
    });
  }
}
