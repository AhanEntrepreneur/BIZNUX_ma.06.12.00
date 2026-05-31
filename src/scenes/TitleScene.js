import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, PALETTE } from '../config.js';
import { gameState } from '../core/GameState.js';

// Title screen. New players -> character creation. Returning players (with a
// save) -> straight into the city, with an option to start over.
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(data) {
    const cx = GAME_WIDTH / 2;
    this.hasSave = data?.hasSave;
    this.cameras.main.setBackgroundColor(PALETTE.bg);

    // skyline strip for flavor
    this.add.rectangle(0, GAME_HEIGHT - 36, GAME_WIDTH, 36, PALETTE.panelLight).setOrigin(0, 0);
    for (let i = 0; i < 14; i++) {
      const h = 8 + ((i * 37) % 26);
      this.add
        .rectangle(8 + i * 22, GAME_HEIGHT - 36, 14, -h, PALETTE.panel)
        .setOrigin(0, 0);
    }

    this.add
      .text(cx, 40, 'BIZNUX', { fontFamily: FONT_FAMILY, fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5);
    this.add
      .text(cx, 66, 'build a life. run the city.', {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: '#' + PALETTE.textDim.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5);

    const promptText = this.hasSave ? 'PRESS ENTER TO CONTINUE' : 'PRESS ENTER TO START';
    const prompt = this.add
      .text(cx, 104, promptText, {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: '#' + PALETTE.accent.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    if (this.hasSave) {
      this.add
        .text(cx, 124, 'press N for a new life (erases save)', {
          fontFamily: FONT_FAMILY,
          fontSize: '6px',
          color: '#' + PALETTE.textDim.toString(16).padStart(6, '0'),
        })
        .setOrigin(0.5);
    }

    this.input.keyboard.once('keydown-ENTER', () => this.go());
    this.input.keyboard.once('keydown-SPACE', () => this.go());
    if (this.hasSave) {
      this.input.keyboard.on('keydown-N', () => {
        gameState.clear();
        this.scene.start('CharacterScene');
      });
    }
  }

  go() {
    if (this.hasSave && gameState.data) {
      this.scene.start('WorldScene');
      this.scene.launch('UIScene');
    } else {
      this.scene.start('CharacterScene');
    }
  }
}
