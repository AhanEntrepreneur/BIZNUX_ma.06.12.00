import Phaser from 'phaser';
import { CHAR } from '../config.js';
import { FACE_TINTS, HAIR_COLORS, OUTFITS } from '../data/appearance.js';

// A layered, appearance-driven character.
//
// IMPORTANT: this extends a plain Sprite (the BODY layer) rather than a
// Container, because Phaser's arcade physics doesn't play nicely with Containers
// (static bodies call getTopLeft(), which Containers lack). Hair and outfit are
// separate overlay Sprites that simply MIRROR the body's current frame, position,
// depth and scale every tick - so only the body animates, and the overlays stay
// perfectly in sync without their own animation state.
//
// Subclasses (Player, NPC) attach the physics body to `this` (the body sprite).
export default class CharacterSprite extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, appearance) {
    const bodyKey = 'char_body_' + (appearance.body === 'fem' ? 'fem' : 'masc');
    const startFrame = CHAR.DIRECTION_OFFSET[appearance.facing || 'down'];
    super(scene, x, y, bodyKey, startFrame);
    scene.add.existing(this);

    this.facing = appearance.facing || 'down';
    this.bodyKey = bodyKey;

    const hairKey = 'char_hair_' + (appearance.hair ?? 0);
    const outfit = OUTFITS[appearance.outfit ?? 0] || OUTFITS[0];
    const outfitKey = 'char_outfit_' + outfit.variant;

    // Overlay sprites (no physics, no animation - they mirror the body).
    this.outfit_ = scene.add.sprite(x, y, outfitKey, startFrame);
    this.hair_ = scene.add.sprite(x, y, hairKey, startFrame);

    // Tints: face -> body skin, hairColor -> hair, outfit color -> clothes.
    // (An NPC `tint` overrides body tint for quick visual variety.)
    // Phaser 4: be explicit about tint mode (MULTIPLY) so recoloring of the
    // white overlay sheets stays correct under the new default and composes
    // properly once the lighting system multiplies light over sprites.
    const TM = Phaser.TintMode?.MULTIPLY ?? 0;
    this.setTint(appearance.tint ?? FACE_TINTS[appearance.face ?? 0]);
    this.setTintMode?.(TM);
    this.hair_.setTint(HAIR_COLORS[appearance.hairColor ?? 0]);
    this.hair_.setTintMode?.(TM);
    this.outfit_.setTint(outfit.color);
    this.outfit_.setTintMode?.(TM);

    this.overlays = [this.outfit_, this.hair_];
    CharacterSprite.createAnimations(scene, bodyKey);
    this.syncOverlays();
  }

  // Walk anims are defined on the BODY texture only (overlays mirror frames).
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

  // Mirror body transform + current frame onto the overlays. Called every tick.
  syncOverlays() {
    const frameName = this.frame.name;
    for (const o of this.overlays) {
      o.setPosition(this.x, this.y);
      o.setFrame(frameName);
      o.setDepth(this.depth + 0.01);
      o.setScale(this.scaleX, this.scaleY);
      o.setVisible(this.visible);
    }
    // hair sits above outfit
    this.hair_.setDepth(this.depth + 0.02);
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.syncOverlays();
  }

  destroy(fromScene) {
    this.overlays?.forEach((o) => o.destroy());
    super.destroy(fromScene);
  }
}
