import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, PALETTE } from '../config.js';
import {
  BODY_TYPES,
  FACE_TINTS,
  HAIR_STYLES,
  HAIR_COLORS,
  OUTFITS,
  DEFAULT_APPEARANCE,
} from '../data/appearance.js';
import { gameState } from '../core/GameState.js';
import CharacterSprite from '../entities/CharacterSprite.js';

// Character creation: cycle body / face / hair / hair color / outfit and see a
// live layered preview, then confirm to create the character and enter the
// city. Keyboard-driven (Up/Down pick row, Left/Right change value, Enter
// confirms) so it works without mouse on any device.
export default class CharacterScene extends Phaser.Scene {
  constructor() {
    super('CharacterScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.appearance = { ...DEFAULT_APPEARANCE };

    this.add
      .text(GAME_WIDTH / 2, 12, 'CREATE YOUR CHARACTER', {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Option rows: each has a label, a getter for the current display value,
    // and a setter that cycles by +/-1.
    this.rows = [
      this.optRow('Body', () => BODY_TYPES.find((b) => b.id === this.appearance.body).label,
        (d) => { const i = BODY_TYPES.findIndex((b) => b.id === this.appearance.body); this.appearance.body = BODY_TYPES[wrap(i + d, BODY_TYPES.length)].id; }),
      this.optRow('Face', () => `#${this.appearance.face + 1}`,
        (d) => { this.appearance.face = wrap(this.appearance.face + d, FACE_TINTS.length); }),
      this.optRow('Hair', () => `Style ${this.appearance.hair + 1}`,
        (d) => { this.appearance.hair = wrap(this.appearance.hair + d, HAIR_STYLES.length); }),
      this.optRow('Hair Color', () => `#${this.appearance.hairColor + 1}`,
        (d) => { this.appearance.hairColor = wrap(this.appearance.hairColor + d, HAIR_COLORS.length); }),
      this.optRow('Outfit', () => OUTFITS[this.appearance.outfit].label,
        (d) => { this.appearance.outfit = wrap(this.appearance.outfit + d, OUTFITS.length); }),
    ];

    this.selected = 0;
    this.rowTexts = this.rows.map((r, i) => {
      const y = 38 + i * 18;
      const textObj = this.add.text(28, y, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: '#ffffff',
      });
      return { name: r.label, get: r.get, set: r.set, textObj, y };
    });

    // Live preview on the right.
    this.previewX = GAME_WIDTH - 70;
    this.previewY = 80;
    this.rebuildPreview();

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 22, 'Up/Down pick  -  Left/Right change', {
        fontFamily: FONT_FAMILY, fontSize: '6px',
        color: '#' + PALETTE.textDim.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 12, 'ENTER to begin your life', {
        fontFamily: FONT_FAMILY, fontSize: '8px',
        color: '#' + PALETTE.accent.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5);

    this.refreshRows();

    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.move(-1));
    kb.on('keydown-DOWN', () => this.move(1));
    kb.on('keydown-W', () => this.move(-1));
    kb.on('keydown-S', () => this.move(1));
    kb.on('keydown-LEFT', () => this.change(-1));
    kb.on('keydown-RIGHT', () => this.change(1));
    kb.on('keydown-A', () => this.change(-1));
    kb.on('keydown-D', () => this.change(1));
    kb.on('keydown-ENTER', () => this.confirm());
    kb.on('keydown-SPACE', () => this.confirm());
  }

  optRow(label, get, set) {
    return { label, get, set };
  }

  move(d) {
    this.selected = wrap(this.selected + d, this.rows.length);
    this.refreshRows();
  }

  change(d) {
    this.rowTexts[this.selected].set(d);
    this.refreshRows();
    this.rebuildPreview();
  }

  refreshRows() {
    this.rowTexts.forEach((r, i) => {
      const marker = i === this.selected ? '> ' : '  ';
      r.textObj.setText(`${marker}${r.name} : ${r.get()}`);
      r.textObj.setColor(i === this.selected ? '#ffd24b' : '#ffffff');
    });
  }

  rebuildPreview() {
    if (this.preview) this.preview.destroy();
    this.preview = new CharacterSprite(this, this.previewX, this.previewY, {
      ...this.appearance,
      facing: 'down',
    });
    this.preview.setScale(5);
    // gentle idle turn so all sides are visible
    if (this.turnEvent) this.turnEvent.remove();
    const dirs = ['down', 'left', 'up', 'right'];
    let di = 0;
    this.turnEvent = this.time.addEvent({
      delay: 700, loop: true,
      callback: () => { di = (di + 1) % 4; this.preview.setFacing(dirs[di], true); },
    });
  }

  confirm() {
    gameState.createCharacter(this.appearance);
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
  }
}

function wrap(i, n) {
  return ((i % n) + n) % n;
}
