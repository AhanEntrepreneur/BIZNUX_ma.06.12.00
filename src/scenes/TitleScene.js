import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, PALETTE } from '../config.js';

// The title screen: shows the game name and waits for Enter to start the world.
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor(PALETTE.bg);

    // Decorative grass strip along the bottom for a hint of the world.
    this.add
      .rectangle(0, GAME_HEIGHT - 40, GAME_WIDTH, 40, PALETTE.grass)
      .setOrigin(0, 0);
    this.add
      .rectangle(0, GAME_HEIGHT - 40, GAME_WIDTH, 3, PALETTE.grassDark)
      .setOrigin(0, 0);

    // Title.
    this.add
      .text(cx, 70, 'DINOMONZ', {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 100, 'a tiny overworld', {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: '#9aa0c0',
      })
      .setOrigin(0.5);

    // Blinking "Press Enter to Start" prompt.
    const prompt = this.add
      .text(cx, 160, 'PRESS ENTER TO START', {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: '#ffe0a0',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: prompt,
      alpha: 0.2,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.add
      .text(cx, GAME_HEIGHT - 14, 'Arrows/WASD move  -  Space/Enter talk', {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: '#1a1c2e',
      })
      .setOrigin(0.5);

    // Start on Enter or Space.
    this.input.keyboard.once('keydown-ENTER', () => this.startGame());
    this.input.keyboard.once('keydown-SPACE', () => this.startGame());
  }

  startGame() {
    // Launch the world and the UI overlay together.
    this.scene.start('WorldScene');
    this.scene.launch('UIScene');
  }
}
