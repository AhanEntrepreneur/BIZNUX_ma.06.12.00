import Phaser from 'phaser';
import { CHAR } from '../config.js';
import { KEYS } from '../data/assetManifest.js';

// The dog: a small animated sprite that follows the player on a leash during a
// walk. It can be commanded to STOP (sniffing / pooping) where it plants itself
// and refuses to move, or PULL toward a point (loss-of-control events). A drawn
// leash line connects it to the player. Has its own drop shadow.
export default class Dog extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, KEYS.DOG, CHAR.DIRECTION_OFFSET.down);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(y);
    this.body.setSize(8, 6);
    this.body.setOffset(4, 9);

    this.facing = 'down';
    this.state_ = 'follow'; // 'follow' | 'planted' | 'pull'
    this.pullTarget = null;

    this.shadow = scene.add.image(x, y + 6, KEYS.SHADOW).setScale(0.8);
    this.shadow.setLighting?.(false);
    this.enableLighting?.();

    this.leash = scene.add.graphics().setDepth(900050);

    Dog.createAnims(scene);
  }

  static createAnims(scene) {
    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach((dir) => {
      const key = 'dog-walk-' + dir;
      if (scene.anims.exists(key)) return;
      const o = CHAR.DIRECTION_OFFSET[dir];
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(KEYS.DOG, { frames: [o + 1, o + 0, o + 2, o + 0] }),
        frameRate: 7,
        repeat: -1,
      });
    });
  }

  plant() { this.state_ = 'follow'; }
  stopWalking() { this.state_ = 'planted'; this.setVelocity(0, 0); }
  pullTo(x, y) { this.state_ = 'pull'; this.pullTarget = { x, y }; }
  resume() { this.state_ = 'follow'; this.pullTarget = null; }

  // Called each frame by DogWalk with the player's position.
  follow(player, dt) {
    const speed = 64;
    if (this.state_ === 'planted') {
      this.setVelocity(0, 0);
      this.anims.stop();
    } else if (this.state_ === 'pull' && this.pullTarget) {
      const a = Phaser.Math.Angle.Between(this.x, this.y, this.pullTarget.x, this.pullTarget.y);
      this.setVelocity(Math.cos(a) * speed * 1.4, Math.sin(a) * speed * 1.4);
      this.faceByVelocity();
    } else {
      // Follow: trail the player, keeping a short leash distance.
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      if (dist > 18) {
        const a = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        this.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
        this.faceByVelocity();
      } else {
        this.setVelocity(0, 0);
        this.anims.stop();
      }
    }
    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y + 6).setDepth(this.y - 1);
    this.drawLeash(player);
    void dt;
  }

  faceByVelocity() {
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    if (Math.abs(vx) > Math.abs(vy)) this.facing = vx < 0 ? 'left' : 'right';
    else this.facing = vy < 0 ? 'up' : 'down';
    this.anims.play('dog-walk-' + this.facing, true);
  }

  drawLeash(player) {
    this.leash.clear();
    // taut red-ish line when pulling/planted, slack grey otherwise
    const taut = this.state_ !== 'follow';
    this.leash.lineStyle(1, taut ? 0xe0a0a0 : 0x9a8c7a, 0.9);
    this.leash.beginPath();
    this.leash.moveTo(player.x, player.y + 2);
    // a slight sag in the middle for slack leashes
    const mx = (player.x + this.x) / 2;
    const my = (player.y + this.y) / 2 + (taut ? 0 : 3);
    this.leash.lineTo(mx, my);
    this.leash.lineTo(this.x, this.y - 2);
    this.leash.strokePath();
  }

  destroy(fromScene) {
    this.shadow?.destroy();
    this.leash?.destroy();
    super.destroy(fromScene);
  }
}
