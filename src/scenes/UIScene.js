import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, PALETTE } from '../config.js';
import { EventBus, EVENTS } from '../eventbus.js';

// The overlay scene: a reserved HUD area and the retro dialogue box (with a
// typewriter effect). It runs ABOVE WorldScene and owns all on-screen UI.
//
// It listens for 'dialogue:start' from the world and exposes a small API the
// world uses to drive it (isOpen, advanceDialogue) so movement can be locked.
export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.isOpen = false;
    this.lines = [];
    this.pageIndex = 0;
    this.typing = false;
    this.fullText = '';
    this.shownChars = 0;
    this.typeEvent = null;

    this.buildHud();
    this.buildDialogueBox();

    // World -> UI: open a conversation.
    EventBus.on(EVENTS.DIALOGUE_START, this.openDialogue, this);
    this.events.once('shutdown', () => {
      EventBus.off(EVENTS.DIALOGUE_START, this.openDialogue, this);
    });
  }

  // --- Reserved HUD ---------------------------------------------------------
  // A clean, intentionally-empty panel in the top-left. Phase 2 drops the
  // energy/time bar (Stardew) or the party readout (Pokemon) in here without
  // disturbing anything else.
  buildHud() {
    const w = 96;
    const h = 26;
    const g = this.add.graphics();
    g.fillStyle(PALETTE.panel, 0.85);
    g.fillRect(4, 4, w, h);
    g.lineStyle(1, PALETTE.panelBorder, 0.6);
    g.strokeRect(4, 4, w, h);

    this.add.text(10, 9, 'DINOMONZ', {
      fontFamily: FONT_FAMILY,
      fontSize: '8px',
      color: '#ffe0a0',
    });
    this.add.text(10, 19, 'HUD - reserved', {
      fontFamily: FONT_FAMILY,
      fontSize: '6px',
      color: '#9aa0c0',
    });
  }

  // --- Dialogue box ---------------------------------------------------------
  buildDialogueBox() {
    const margin = 6;
    const boxH = 58;
    const x = margin;
    const y = GAME_HEIGHT - boxH - margin;
    const w = GAME_WIDTH - margin * 2;

    this.box = this.add.container(0, 0).setVisible(false);

    const g = this.add.graphics();
    g.fillStyle(PALETTE.panel, 0.95);
    g.fillRect(x, y, w, boxH);
    g.lineStyle(2, PALETTE.panelBorder, 1);
    g.strokeRect(x, y, w, boxH);

    this.nameText = this.add.text(x + 8, y + 6, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '8px',
      color: '#ffe0a0',
    });

    this.bodyText = this.add.text(x + 8, y + 20, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '8px',
      color: '#ffffff',
      lineSpacing: 6,
      wordWrap: { width: w - 16 },
    });

    // Blinking "next" arrow shown when a page has finished typing.
    this.nextArrow = this.add
      .text(x + w - 12, y + boxH - 12, '▼', {
        fontFamily: FONT_FAMILY,
        fontSize: '8px',
        color: '#ffffff',
      })
      .setVisible(false);
    this.arrowTween = this.tweens.add({
      targets: this.nextArrow,
      alpha: 0.2,
      duration: 450,
      yoyo: true,
      repeat: -1,
      paused: true,
    });

    this.box.add([g, this.nameText, this.bodyText, this.nextArrow]);
  }

  // --- Public-ish API used by WorldScene ------------------------------------

  openDialogue({ name, lines }) {
    this.isOpen = true;
    this.lines = lines;
    this.pageIndex = 0;
    this.nameText.setText(name);
    this.box.setVisible(true);
    this.startPage();
  }

  // Drive the box forward: finish typing instantly, go to next page, or close.
  advanceDialogue() {
    if (this.typing) {
      this.revealAll();
      return;
    }
    if (this.pageIndex < this.lines.length - 1) {
      this.pageIndex++;
      this.startPage();
    } else {
      this.closeDialogue();
    }
  }

  closeDialogue() {
    this.isOpen = false;
    this.box.setVisible(false);
    this.stopTyping();
  }

  // --- Typewriter internals -------------------------------------------------

  startPage() {
    this.stopTyping();
    this.fullText = this.lines[this.pageIndex];
    this.shownChars = 0;
    this.bodyText.setText('');
    this.typing = true;
    this.nextArrow.setVisible(false);
    this.arrowTween.pause();

    // Reveal one character roughly every other frame.
    this.typeEvent = this.time.addEvent({
      delay: 28,
      loop: true,
      callback: () => {
        this.shownChars++;
        this.bodyText.setText(this.fullText.slice(0, this.shownChars));
        if (this.shownChars >= this.fullText.length) this.finishTyping();
      },
    });
  }

  revealAll() {
    this.bodyText.setText(this.fullText);
    this.finishTyping();
  }

  finishTyping() {
    this.typing = false;
    this.stopTyping();
    this.nextArrow.setVisible(true);
    this.arrowTween.restart();
  }

  stopTyping() {
    if (this.typeEvent) {
      this.typeEvent.remove(false);
      this.typeEvent = null;
    }
  }
}
