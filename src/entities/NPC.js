import Phaser from 'phaser';
import { TEXTURES, CHAR, FONT_FAMILY, PALETTE } from '../config.js';

// A non-player character or static interactable.
//
// Both share the same interaction flow (face it, press Space/Enter), so they're
// one class. `type: 'sign'` uses the sign prop texture; everything else uses the
// character spritesheet (tinted per-NPC for variety until real art is added).
export default class NPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, data) {
    const isSign = data.type === 'sign';
    const texture = isSign ? TEXTURES.SIGN : TEXTURES.NPC;
    const frame = isSign ? 0 : CHAR.DIRECTION_OFFSET[data.facing || 'down'];

    super(scene, 0, 0, texture, frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.npcId = data.id;
    this.dialogueKey = data.dialogue;
    this.facing = data.facing || 'down';

    // NPCs/signs are immovable obstacles the player collides with.
    this.body.setImmovable(true);
    this.body.setSize(12, 12);
    this.body.setOffset(2, 4);

    if (data.tint) this.setTint(data.tint);

    // A small floating "!" so the player can tell these are interactable.
    this.marker = scene.add
      .text(0, 0, '!', {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: '#' + PALETTE.flower.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
  }

  // Keep the interaction marker hovering above the sprite.
  setMarkerVisible(visible) {
    this.marker.setVisible(visible);
    if (visible) this.marker.setPosition(this.x, this.y - 10);
  }

  destroy(fromScene) {
    this.marker?.destroy();
    super.destroy(fromScene);
  }
}
