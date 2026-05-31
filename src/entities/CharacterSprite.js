import Phaser from 'phaser';
import { CHAR } from '../config.js';
import { KEYS } from '../data/assetManifest.js';
import { FACE_TINTS, HAIR_COLORS, OUTFITS } from '../data/appearance.js';

// A layered, appearance-driven character - a 4-piece PAPER DOLL.
//
// Extends a plain Sprite (the BODY layer, which carries the physics body in
// subclasses), because Phaser arcade physics doesn't work on Containers.
// Bottoms / top / hair are overlay Sprites that MIRROR the body's frame,
// position, depth and scale every tick, so only the body animates and the
// overlays stay in sync. A soft drop-shadow sprite sits beneath the feet.
//
// Layer draw order (bottom -> top): shadow, body, bottoms, top, hair.
export default class CharacterSprite extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, appearance) {
    const bodyKey = appearance.body === 'fem' ? KEYS.BODY_FEM : KEYS.BODY_MASC;
    const startFrame = CHAR.DIRECTION_OFFSET[appearance.facing || 'down'];
    super(scene, x, y, bodyKey, startFrame);
    scene.add.existing(this);

    this.facing = appearance.facing || 'down';
    this.bodyKey = bodyKey;

    const outfit = OUTFITS[appearance.outfit ?? 0] || OUTFITS[0];
    const bottomsKey = KEYS.BOTTOMS + outfit.bottoms;
    const topKey = KEYS.TOP + outfit.top;
    const hairKey = KEYS.HAIR + (appearance.hair ?? 0);

    // Drop shadow (on the ground; does not bob with the sprite).
    this.shadow = scene.add.image(x, y, KEYS.SHADOW);
    this.shadow.setOrigin(0.5, 0.5);

    // Overlay layers (no physics, no animation; mirror the body each tick).
    this.bottoms_ = scene.add.sprite(x, y, bottomsKey, startFrame);
    this.top_ = scene.add.sprite(x, y, topKey, startFrame);
    this.hair_ = scene.add.sprite(x, y, hairKey, startFrame);

    // Tints (MULTIPLY in v4): face->skin, outfit->clothes, hairColor->hair.
    const TM = Phaser.TintMode?.MULTIPLY ?? 0;
    const apply = (spr, color) => { spr.setTint(color); spr.setTintMode?.(TM); };
    apply(this, appearance.tint ?? FACE_TINTS[appearance.face ?? 0]);
    apply(this.bottoms_, outfit.botColor);
    apply(this.top_, outfit.topColor);
    apply(this.hair_, HAIR_COLORS[appearance.hairColor ?? 0]);

    // Order matters: bottoms, then top, then hair on top of the body.
    this.overlays = [this.bottoms_, this.top_, this.hair_];

    CharacterSprite.createAnimations(scene, bodyKey);
    this.syncOverlays();
  }

  static createAnimations(scene, bodyKey) {
    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach((dir) => {
      const key = bodyKey + '-walk-' + dir;
      if (scene.anims.exists(key)) return;
      const o = CHAR.DIRECTION_OFFSET[dir];
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(bodyKey, { frames: [o + 1, o + 0, o + 2, o + 0] }),
        frameRate: 8,
        repeat: -1,
      });
    });
  }

  setFacing(dir, moving) {
    this.facing = dir;
    if (moving) {
      this.play(this.bodyKey + '-walk-' + dir, true);
    } else {
      this.anims.stop();
      this.setFrame(CHAR.DIRECTION_OFFSET[dir]);
    }
  }

  // Mirror the body's transform + frame onto every overlay, and keep the
  // shadow planted at the feet. Called every tick via preUpdate.
  syncOverlays() {
    const frameName = this.frame.name;
    const sx = this.scaleX;
    const sy = this.scaleY;
    for (let i = 0; i < this.overlays.length; i++) {
      const o = this.overlays[i];
      o.setPosition(this.x, this.y);
      o.setFrame(frameName);
      o.setScale(sx, sy);
      o.setVisible(this.visible);
      // bottoms just above body, top above bottoms, hair above top
      o.setDepth(this.depth + 0.01 * (i + 1));
    }
    // Shadow sits slightly below the feet, under everything.
    this.shadow.setPosition(this.x, this.y + 7 * Math.abs(sy));
    this.shadow.setScale(sx, sy);
    this.shadow.setDepth(this.depth - 1);
    this.shadow.setVisible(this.visible);
  }

  // Opt this character (all layers) into the lighting system.
  enableLighting() {
    this.setLighting?.(true);
    this.overlays.forEach((o) => o.setLighting?.(true));
    return this;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.syncOverlays();
  }

  destroy(fromScene) {
    this.shadow?.destroy();
    this.overlays?.forEach((o) => o.destroy());
    super.destroy(fromScene);
  }
}
