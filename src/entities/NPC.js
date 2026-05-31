import { TILE_SIZE, FONT_FAMILY, PALETTE } from '../config.js';
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

    this.marker = scene.add
      .text(0, 0, '!', {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: '#' + PALETTE.accent.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
  }

  placeAtTile(tx, ty) {
    this.setPosition(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2);
    this.setDepth(this.y);
    // Shrink the static body and re-sync it to the new position.
    this.body.setSize(12, 10);
    this.body.updateFromGameObject();
    this.syncOverlays();
    return this;
  }

  setMarkerVisible(v) {
    this.marker.setVisible(v);
    if (v) this.marker.setPosition(this.x, this.y - 10).setDepth(this.y + 1000);
  }

  destroy(fromScene) {
    this.marker?.destroy();
    super.destroy(fromScene);
  }
}
