import { PLAYER, TILE_SIZE } from '../config.js';
import CharacterSprite from './CharacterSprite.js';

// The player: a layered CharacterSprite (the body sprite carries the physics
// body). Movement is SMOOTH ANALOG in any direction (per spec) - velocity is a
// normalized vector so diagonals work - while the sprite shows the nearest of
// the four cardinal facings.
export default class Player extends CharacterSprite {
  constructor(scene, x, y, appearance) {
    super(scene, x, y, appearance);
    scene.physics.add.existing(this);

    // A smaller body on the feet so the character tucks close to walls.
    this.body.setSize(10, 8);
    this.body.setOffset(3, 8); // sprite is 16x16, origin centered by default
    this.setOrigin(0.5, 0.5);
    this.setDepth(y);
    this.frozen = false;
  }

  update(input) {
    if (this.frozen) {
      this.setVelocity(0, 0);
      return;
    }
    let { x: ax, y: ay } = input;
    const moving = ax !== 0 || ay !== 0;

    if (moving) {
      const len = Math.hypot(ax, ay) || 1;
      ax /= len;
      ay /= len;
      this.setVelocity(ax * PLAYER.SPEED, ay * PLAYER.SPEED);
      if (Math.abs(ax) > Math.abs(ay)) this.facing = ax < 0 ? 'left' : 'right';
      else this.facing = ay < 0 ? 'up' : 'down';
      this.setFacing(this.facing, true);
    } else {
      this.setVelocity(0, 0);
      this.setFacing(this.facing, false);
    }
    this.setDepth(this.y);
  }

  freeze() {
    this.frozen = true;
    this.setVelocity(0, 0);
    this.setFacing(this.facing, false);
  }

  unfreeze() {
    this.frozen = false;
  }

  getFrontPoint() {
    const d = TILE_SIZE;
    const map = { down: [0, d], up: [0, -d], left: [-d, 0], right: [d, 0] };
    const [dx, dy] = map[this.facing];
    return { x: this.x + dx, y: this.y + dy };
  }
}
