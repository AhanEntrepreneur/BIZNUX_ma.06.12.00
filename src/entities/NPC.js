import { TILE_SIZE } from '../config.js';
import { KEYS } from '../data/assetManifest.js';
import CharacterSprite from './CharacterSprite.js';

// An NPC: a layered character with a STATIC physics body (immovable obstacle)
// and an interaction marker. Carries the data WorldScene needs to dispatch its
// role-based interaction (job offer, gig board, course, realtor, flavor).
export default class NPC extends CharacterSprite {
  constructor(scene, data) {
    super(scene, 0, 0, {
      body: data.body || 'masc',
      face: data.face ?? 0,
      hair: data.hair ?? 0,
      hairColor: data.hairColor ?? 1,
      outfit: data.outfit ?? 0,
      facing: data.facing || 'down',
      tint: data.tint,
    });

    scene.physics.add.existing(this, true); // static body

    this.npcId = data.id;
    this.npcName = data.name;
    this.role = data.role;
    this.jobId = data.jobId;
    this.dialogueKey = data.dialogue;
    this.setFacing(this.facing, false);

    // Polished interaction prompt (Bug 2 fix): the "E" key-bubble sprite from
    // the asset pipeline, gently bobbing, instead of a stray "!" glyph. Hidden
    // until the player is in range.
    this.marker = scene.add
      .image(0, 0, KEYS.PROMPT)
      .setOrigin(0.5, 1)
      .setDepth(950000)
      .setVisible(false);
    this.markerBob = scene.tweens.add({
      targets: this.marker, y: '-=2', duration: 520, yoyo: true, repeat: -1,
      ease: 'Sine.inOut', paused: true,
    });
  }

  placeAtTile(tx, ty) {
    this.setPosition(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2);
    this.setDepth(this.y);
    // Shrink the static body and re-sync it to the new position.
    this.body.setSize(12, 10);
    this.body.updateFromGameObject();
    this.positionShadow();
    return this;
  }

  setMarkerVisible(v) {
    if (v === this.marker.visible) {
      if (v) this.marker.setPosition(this.x, this.y - 12).setDepth(this.y + 1000);
      return;
    }
    this.marker.setVisible(v);
    if (v) {
      this.marker.setPosition(this.x, this.y - 12).setDepth(this.y + 1000);
      this.markerBob.restart();
    } else {
      this.markerBob.pause();
    }
  }

  destroy(fromScene) {
    this.markerBob?.remove();
    this.marker?.destroy();
    super.destroy(fromScene);
  }
}
