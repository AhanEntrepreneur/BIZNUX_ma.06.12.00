import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, PALETTE, STAT_KEYS } from '../config.js';
import { EventBus, EVENTS } from '../eventbus.js';
import { gameState } from '../core/GameState.js';

// The overlay scene: HUD (money / clock / weather / fatigue), a phone-style
// stats panel (TAB), the retro dialogue box with typewriter, and a keyboard-
// driven menu used for jobs/courses/realtor. Runs ABOVE WorldScene and is the
// single owner of on-screen UI. WorldScene asks isBlocking() to lock movement.
export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.gs = gameState;
    this.mode = 'none'; // 'none' | 'dialogue' | 'menu'
    this.dialogue = null;
    this.menu = null;
    this.phoneOpen = false;

    this.buildHud();
    this.buildPhone();
    this.buildDialogueBox();
    this.buildMenu();
    this.buildToast();

    this.bindEvents();
    this.refreshHud();

    // NOTE: UIScene does NOT read the keyboard itself. WorldScene is the single
    // input owner and calls the methods below (advanceDialogue, moveMenu,
    // selectMenu, togglePhone). This avoids a double-read where both scenes'
    // key objects see the same JustDown in one frame, and it's the seam where a
    // future networked client would inject remote/authoritative input.
  }

  // True while gameplay input/time should be locked.
  isBlocking() {
    return this.mode !== 'none';
  }

  bindEvents() {
    const on = (evt, fn) => {
      EventBus.on(evt, fn, this);
      this.events.once('shutdown', () => EventBus.off(evt, fn, this));
    };
    on(EVENTS.MONEY_CHANGED, () => this.refreshHud());
    on(EVENTS.STATS_CHANGED, () => { this.refreshHud(); this.refreshPhone(); });
    on(EVENTS.FATIGUE_CHANGED, () => this.refreshHud());
    on(EVENTS.TIME_TICK, () => this.refreshHud());
    on(EVENTS.WEATHER_CHANGED, () => this.refreshHud());
    on(EVENTS.JOB_CHANGED, () => this.refreshPhone());
    on(EVENTS.TOAST, (p) => this.showToast(p.text, p.color));
    // DogWalk (and other systems) can request a dialogue via the bus.
    on(EVENTS.DIALOGUE_START, (p) => this.openDialogue(p));
  }

  // --- HUD ------------------------------------------------------------------
  buildHud() {
    // Top bar background.
    this.add.rectangle(0, 0, GAME_WIDTH, 14, PALETTE.panel, 0.92).setOrigin(0).setDepth(10);
    const style = { fontFamily: FONT_FAMILY, fontSize: '7px', color: '#ffffff' };

    this.hudMoney = this.add.text(4, 4, '', { ...style, color: '#6ee06e' }).setDepth(11);
    this.hudClock = this.add.text(GAME_WIDTH / 2, 4, '', style).setOrigin(0.5, 0).setDepth(11);
    this.hudWeather = this.add.text(GAME_WIDTH - 4, 4, '', style).setOrigin(1, 0).setDepth(11);
    this.displayedCash = this.gs.data ? this.gs.data.cash : 0; // for count-up

    // Two stacked gauges bottom-left: FATIGUE and HUNGER.
    this.add.rectangle(4, GAME_HEIGHT - 16, 64, 6, PALETTE.panel, 0.9).setOrigin(0).setDepth(10);
    this.fatigueBar = this.add.rectangle(5, GAME_HEIGHT - 15, 0, 4, PALETTE.danger).setOrigin(0).setDepth(11);
    this.add.text(70, GAME_HEIGHT - 16, 'FATIGUE', { fontFamily: FONT_FAMILY, fontSize: '6px', color: '#9aa0c0' }).setDepth(11);

    this.add.rectangle(4, GAME_HEIGHT - 9, 64, 6, PALETTE.panel, 0.9).setOrigin(0).setDepth(10);
    this.hungerBar = this.add.rectangle(5, GAME_HEIGHT - 8, 0, 4, PALETTE.accent).setOrigin(0).setDepth(11);
    this.add.text(70, GAME_HEIGHT - 9, 'HUNGER', { fontFamily: FONT_FAMILY, fontSize: '6px', color: '#9aa0c0' }).setDepth(11);

    // Hint.
    this.add
      .text(GAME_WIDTH - 4, GAME_HEIGHT - 9, 'TAB phone  Z sleep', {
        fontFamily: FONT_FAMILY, fontSize: '6px', color: '#9aa0c0',
      })
      .setOrigin(1, 0)
      .setDepth(11);

    // Offscreen objective arrow (points toward the current waypoint).
    this.objArrow = this.add.text(0, 0, '>', {
      fontFamily: FONT_FAMILY, fontSize: '10px', color: '#ffd24b',
    }).setOrigin(0.5).setDepth(85).setVisible(false);
  }

  refreshHud() {
    if (!this.gs.data) return;
    // money handled via count-up in update(); set immediately if first time
    const hh = String(this.gs.hour).padStart(2, '0');
    const mm = String(this.gs.minute).padStart(2, '0');
    this.hudClock.setText(`Day ${this.gs.day}  ${hh}:${mm}`);
    this.hudWeather.setText(this.weatherIcon(this.gs.data.weather));
    const f = this.gs.data.fatigue / 100;
    this.fatigueBar.width = 62 * f;
    this.fatigueBar.fillColor = f > 0.7 ? PALETTE.danger : f > 0.4 ? PALETTE.accent : PALETTE.money;
    const hg = this.gs.data.hunger / 100;
    this.hungerBar.width = 62 * hg;
    this.hungerBar.fillColor = hg > 0.7 ? PALETTE.danger : hg > 0.4 ? PALETTE.accent : PALETTE.money;
  }

  // Per-frame: animate money count-up + update the offscreen objective arrow.
  update() {
    if (!this.gs.data) return;
    // Money count-up.
    const target = this.gs.data.cash;
    if (this.displayedCash !== target) {
      const diff = target - this.displayedCash;
      const step = Math.max(1, Math.abs(diff) * 0.18);
      this.displayedCash += Math.sign(diff) * Math.min(step, Math.abs(diff));
      this.displayedCash = Math.round(this.displayedCash);
    }
    this.hudMoney.setText(`$${this.displayedCash}`);

    // Objective arrow: point from screen-center toward an offscreen waypoint.
    const world = this.scene.get('WorldScene');
    const obj = world?.objective;
    if (obj && world.cameras?.main) {
      const cam = world.cameras.main;
      const sx = (obj.x - cam.worldView.x) * cam.zoom;
      const sy = (obj.y - cam.worldView.y) * cam.zoom;
      const onScreen = sx >= 0 && sx <= GAME_WIDTH && sy >= 0 && sy <= GAME_HEIGHT;
      if (onScreen) {
        this.objArrow.setVisible(false);
      } else {
        const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
        const ang = Math.atan2(sy - cy, sx - cx);
        const rx = Math.cos(ang) * (GAME_WIDTH / 2 - 14) + cx;
        const ry = Math.sin(ang) * (GAME_HEIGHT / 2 - 20) + cy;
        this.objArrow.setPosition(rx, ry).setRotation(ang).setVisible(true);
      }
    } else {
      this.objArrow.setVisible(false);
    }
  }

  weatherIcon(w) {
    return { sunny: 'SUNNY', cloudy: 'CLOUDY', rainy: 'RAIN', cold: 'COLD' }[w] || w;
  }

  // --- Phone (stats panel, TAB) --------------------------------------------
  buildPhone() {
    this.phone = this.add.container(0, 0).setDepth(50).setVisible(false);
    const w = 150, h = 120;
    const x = (GAME_WIDTH - w) / 2, y = (GAME_HEIGHT - h) / 2;
    const bg = this.add.rectangle(x, y, w, h, PALETTE.panel, 0.97).setOrigin(0).setStrokeStyle(2, PALETTE.panelBorder);
    this.phoneTitle = this.add.text(x + 8, y + 6, '', { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#ffd24b' });
    this.phoneBody = this.add.text(x + 8, y + 22, '', { fontFamily: FONT_FAMILY, fontSize: '7px', color: '#ffffff', lineSpacing: 5 });
    const hint = this.add.text(x + w / 2, y + h - 10, 'TAB to close', { fontFamily: FONT_FAMILY, fontSize: '6px', color: '#9aa0c0' }).setOrigin(0.5);
    this.phone.add([bg, this.phoneTitle, this.phoneBody, hint]);
  }

  refreshPhone() {
    if (!this.gs.data) return;
    const d = this.gs.data;
    this.phoneTitle.setText(`${d.name}'s Phone`);
    const stats = STAT_KEYS.map((k) => `${k.toUpperCase().slice(0, 3)} ${d.stats[k]}`).join('  ');
    const job = d.job ? d.job.id : 'unemployed';
    const home = d.evicted ? 'EVICTED (street)' : d.ownsHome ? 'Homeowner' : 'Renting $40/day';
    this.phoneBody.setText(
      [
        `Cash: $${d.cash}`,
        `Job:  ${job}`,
        `Home: ${home}`,
        `Loan: $${d.loanBalance}  Credit: ${d.creditScore}`,
        `Dog rating: ${d.dogRating.toFixed(1)}/5  Bags: ${d.poopBags}`,
        '',
        stats,
      ].join('\n')
    );
  }

  togglePhone() {
    // Only toggle when nothing else is blocking (or when phone itself is open).
    if (this.mode === 'dialogue' || this.mode === 'menu') return;
    this.phoneOpen = !this.phoneOpen;
    this.phone.setVisible(this.phoneOpen);
    this.mode = this.phoneOpen ? 'menu' : 'none'; // block movement while phone up
    if (this.phoneOpen) this.refreshPhone();
  }

  // --- Dialogue box ---------------------------------------------------------
  buildDialogueBox() {
    const margin = 6, boxH = 48;
    const x = margin, y = GAME_HEIGHT - boxH - margin, w = GAME_WIDTH - margin * 2;
    this.box = this.add.container(0, 0).setDepth(60).setVisible(false);
    const g = this.add.graphics();
    g.fillStyle(PALETTE.panel, 0.96); g.fillRect(x, y, w, boxH);
    g.lineStyle(2, PALETTE.panelBorder, 1); g.strokeRect(x, y, w, boxH);
    this.dlgName = this.add.text(x + 8, y + 5, '', { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#ffd24b' });
    this.dlgBody = this.add.text(x + 8, y + 18, '', { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#ffffff', lineSpacing: 4, wordWrap: { width: w - 16 } });
    this.dlgArrow = this.add.text(x + w - 12, y + boxH - 11, 'v', { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#ffffff' }).setVisible(false);
    this.tweens.add({ targets: this.dlgArrow, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });
    this.box.add([g, this.dlgName, this.dlgBody, this.dlgArrow]);
  }

  // Open a dialogue; `onClose` (optional) fires after the last page is closed.
  openDialogue({ name, lines }, onClose) {
    this.mode = 'dialogue';
    this.dialogue = { name, lines, page: 0, onClose };
    this.dlgName.setText(name);
    this.box.setVisible(true);
    this.startPage();
  }

  startPage() {
    this.typing = true;
    this.full = this.dialogue.lines[this.dialogue.page];
    this.shown = 0;
    this.dlgBody.setText('');
    this.dlgArrow.setVisible(false);
    if (this.typeEvt) this.typeEvt.remove();
    this.typeEvt = this.time.addEvent({
      delay: 26, loop: true,
      callback: () => {
        this.shown++;
        this.dlgBody.setText(this.full.slice(0, this.shown));
        if (this.shown >= this.full.length) this.finishTyping();
      },
    });
  }

  finishTyping() {
    this.typing = false;
    if (this.typeEvt) { this.typeEvt.remove(); this.typeEvt = null; }
    this.dlgArrow.setVisible(true);
  }

  advanceDialogue() {
    if (this.typing) { this.dlgBody.setText(this.full); this.finishTyping(); return; }
    if (this.dialogue.page < this.dialogue.lines.length - 1) {
      this.dialogue.page++;
      this.startPage();
    } else {
      this.closeDialogue();
    }
  }

  closeDialogue() {
    this.box.setVisible(false);
    const cb = this.dialogue?.onClose;
    this.dialogue = null;
    this.mode = 'none';
    if (this.typeEvt) { this.typeEvt.remove(); this.typeEvt = null; }
    if (cb) cb(); // may immediately openMenu()
  }

  // --- Menu (list of choices) ----------------------------------------------
  buildMenu() {
    this.menuBox = this.add.container(0, 0).setDepth(70).setVisible(false);
  }

  // title: string, info: string[] (description lines), options: [{label,onSelect}]
  openMenu(title, info, options) {
    this.clearMenu();
    this.mode = 'menu';
    this.menu = { options, index: 0 };

    const w = 220;
    const infoH = info.length * 10;
    const h = 24 + infoH + options.length * 14 + 8;
    const x = (GAME_WIDTH - w) / 2, y = (GAME_HEIGHT - h) / 2;

    const bg = this.add.rectangle(x, y, w, h, PALETTE.panel, 0.97).setOrigin(0).setStrokeStyle(2, PALETTE.panelBorder);
    const t = this.add.text(x + 8, y + 6, title, { fontFamily: FONT_FAMILY, fontSize: '8px', color: '#ffd24b' });
    const infoText = this.add.text(x + 8, y + 18, info.join('\n'), { fontFamily: FONT_FAMILY, fontSize: '6px', color: '#9aa0c0', lineSpacing: 3 });
    this.menuBox.add([bg, t, infoText]);

    this.optionTexts = options.map((o, i) => {
      const oy = y + 22 + infoH + i * 14;
      const txt = this.add.text(x + 12, oy, o.label, { fontFamily: FONT_FAMILY, fontSize: '7px', color: '#ffffff' });
      this.menuBox.add(txt);
      return txt;
    });

    this.menuBox.setVisible(true);
    this.highlightMenu();
  }

  highlightMenu() {
    this.optionTexts.forEach((t, i) => {
      const sel = i === this.menu.index;
      t.setColor(sel ? '#ffd24b' : '#ffffff');
      t.setText((sel ? '> ' : '  ') + this.menu.options[i].label);
    });
  }

  moveMenu(d) {
    if (!this.menu) return;
    this.menu.index = (this.menu.index + d + this.menu.options.length) % this.menu.options.length;
    this.highlightMenu();
  }

  selectMenu() {
    if (!this.menu) return;
    const opt = this.menu.options[this.menu.index];
    this.clearMenu();
    this.mode = 'none';
    opt.onSelect(); // may open another menu/dialogue, re-setting mode
  }

  clearMenu() {
    this.menuBox.removeAll(true);
    this.menuBox.setVisible(false);
    this.menu = null;
    this.optionTexts = [];
  }

  // --- Toast ----------------------------------------------------------------
  buildToast() {
    this.toastText = this.add
      .text(GAME_WIDTH / 2, 22, '', {
        fontFamily: FONT_FAMILY, fontSize: '7px', color: '#ffffff',
        backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(80)
      .setAlpha(0);
  }

  showToast(text, color = PALETTE.text) {
    this.toastText.setText(text);
    this.toastText.setColor('#' + color.toString(16).padStart(6, '0'));
    this.toastText.setAlpha(1);
    if (this.toastTween) this.toastTween.remove();
    this.toastTween = this.tweens.add({
      targets: this.toastText, alpha: 0, delay: 1600, duration: 600,
    });
  }

  // Cancel the current menu (called by WorldScene on Esc).
  cancelMenu() {
    if (this.mode === 'menu' && !this.phoneOpen) {
      this.clearMenu();
      this.mode = 'none';
    }
  }
}
