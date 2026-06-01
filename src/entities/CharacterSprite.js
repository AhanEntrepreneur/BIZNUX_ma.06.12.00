import Phaser from 'phaser';
import { CHAR } from '../config.js';
import { KEYS } from '../data/assetManifest.js';
import { resolveCharacter } from '../data/appearance.js';
import { generateCharacterComposite } from '../utils/generateArt.js';

// A character is now ONE sprite drawn from a single COMPOSITED spritesheet
// (body+bottoms+top+hair baked together per appearance). This is the P.1
// root-cause fix: the old design used separate overlay sprites repositioned in
// preUpdate (which runs before the physics step), so overlays rendered at the
// body's previous position and visibly detached on a real GPU. With one sprite
// there are no layers to desync - separation is structurally impossible.
//
// Only the soft drop-shadow remains a separate object; it's a static ellipse at
// the feet where a sub-pixel lag is invisible, and it is repositioned each tick.
export default class CharacterSprite extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, appearance) {
    const { key, colors } = resolveCharacter(appearance);
    // Bake (or reuse) the composited sheet for this exact appearance.
    generateCharacterComposite(scene, key, colors);

    const startFrame = CHAR.DIRECTION_OFFSET[appearance.facing || 'down'];
    super(scene, x, y, key, startFrame);
    scene.add.existing(this);

    this.facing = appearance.facing || 'down';
    this.sheetKey = key;

    this.shadow = scene.add.image(x, y, KEYS.SHADOW).setOrigin(0.5, 0.5);

    CharacterSprite.createAnimations(scene, key);
    this.positionShadow();
  }

  // Walk animation defined on this appearance's sheet (idempotent per key).
  static createAnimations(scene, key) {
    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach((dir) => {
      const ak = key + '-walk-' + dir;
      if (scene.anims.exists(ak)) return;
      const o = CHAR.DIRECTION_OFFSET[dir];
      scene.anims.create({
        key: ak,
        frames: scene.anims.generateFrameNumbers(key, { frames: [o + 1, o + 0, o + 2, o + 0] }),
        frameRate: 8,
        repeat: -1,
      });
    });
  }

  setFacing(dir, moving) {
    this.facing = dir;
    if (moving) {
      this.play(this.sheetKey + '-walk-' + dir, true);
    } else {
      this.anims.stop();
      this.setFrame(CHAR.DIRECTION_OFFSET[dir]);
    }
  }

  // Swap the character's whole look at runtime (wardrobe). Re-bakes/reuses the
  // composite sheet for the new appearance and re-points this single sprite.
  setAppearance(appearance) {
    const { key, colors } = resolveCharacter(appearance);
    generateCharacterComposite(this.scene, key, colors);
    this.sheetKey = key;
    CharacterSprite.createAnimations(this.scene, key);
    this.setTexture(key, CHAR.DIRECTION_OFFSET[this.facing]);
    this.setFacing(this.facing, false);
  }

  positionShadow() {
    if (!this.shadow) return;
    this.shadow.setPosition(this.x, this.y + 7 * Math.abs(this.scaleY));
    this.shadow.setScale(this.scaleX, this.scaleY);
    this.shadow.setDepth(this.depth - 1);
    this.shadow.setVisible(this.visible);
  }

  // Kept for API compatibility (Atmosphere may call it); the single sprite and
  // its shadow opt into lighting if the pipeline is active.
  enableLighting() {
    this.setLighting?.(true);
    return this;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.positionShadow();
  }

  destroy(fromScene) {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
