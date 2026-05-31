import Phaser from 'phaser';
import { TEXTURES, CHAR, PLAYER, TILE_SIZE } from '../config.js';

// The player character: an arcade-physics sprite that walks in 4 directions,
// plays a simple walk animation, and remembers which way it's facing (so the
// interaction system knows what tile is "in front" of it).
export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, TEXTURES.PLAYER, CHAR.DIRECTION_OFFSET.down);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.facing = 'down';

    // A slightly smaller body centered on the feet feels better than a full
    // 16x16 box bumping into things by the head.
    this.body.setSize(10, 10);
    this.body.setOffset(3, 5);
    this.setCollideWorldBounds(true);

    Player.createAnimations(scene);
  }

  // Define walk animations once, shared across any Player instance.
  static createAnimations(scene) {
    if (scene.anims.exists('walk-down')) return;
    const make = (key, dir) => {
      const o = CHAR.DIRECTION_OFFSET[dir];
      scene.anims.create({
        key,
        // [stepA, idle, stepB, idle] -> a gentle two-step walk cycle
        frames: scene.anims.generateFrameNumbers(TEXTURES.PLAYER, {
          frames: [o + 1, o + 0, o + 2, o + 0],
        }),
        frameRate: 8,
        repeat: -1,
      });
    };
    make('walk-down', 'down');
    make('walk-left', 'left');
    make('walk-right', 'right');
    make('walk-up', 'up');
  }

  // Drive movement from the current input state. Called every frame by the
  // scene unless input is locked (e.g. during dialogue), in which case the
  // scene calls stop() instead.
  update(input) {
    const { left, right, up, down } = input;
    const speed = PLAYER.SPEED;
    let vx = 0;
    let vy = 0;

    // 4-directional: horizontal input wins so we never move diagonally.
    if (left) {
      vx = -speed;
      this.facing = 'left';
    } else if (right) {
      vx = speed;
      this.facing = 'right';
    } else if (up) {
      vy = -speed;
      this.facing = 'up';
    } else if (down) {
      vy = speed;
      this.facing = 'down';
    }

    this.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      this.anims.play('walk-' + this.facing, true);
    } else {
      // Idle: stop on the facing's idle frame.
      this.anims.stop();
      this.setFrame(CHAR.DIRECTION_OFFSET[this.facing]);
    }
  }

  // Freeze the player in place (used while dialogue is open).
  freeze() {
    this.setVelocity(0, 0);
    this.anims.stop();
    this.setFrame(CHAR.DIRECTION_OFFSET[this.facing]);
  }

  // The world point one tile ahead of the player, used to find what we're
  // trying to interact with.
  getFrontPoint() {
    const d = TILE_SIZE;
    const dirs = {
      down: [0, d],
      up: [0, -d],
      left: [-d, 0],
      right: [d, 0],
    };
    const [dx, dy] = dirs[this.facing];
    return { x: this.x + dx, y: this.y + dy };
  }
}
