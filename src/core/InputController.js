import Phaser from 'phaser';

// Centralizes input so movement is analog and any-direction, and so the
// "interact" / "confirm" key is read consistently everywhere. Arrow keys + WASD
// drive an axis vector in [-1,1]; multiple keys combine into diagonals.
export default class InputController {
  constructor(scene) {
    const kb = scene.input.keyboard;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    // Interact/confirm: E is the primary key (matches the on-screen "E"
    // prompt); Space/Enter are alternates.
    this.confirmKeys = [
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    ];
    this.cancelKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.phoneKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    this.sleepKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
  }

  // Analog movement axis. Returns { x, y } each in [-1, 1].
  axis() {
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) x -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) x += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) y -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) y += 1;
    return { x, y };
  }

  confirmJustPressed() {
    return this.confirmKeys.some((k) => Phaser.Input.Keyboard.JustDown(k));
  }

  // Menu vertical navigation: -1 (up), +1 (down), or 0.
  navJustPressed() {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.up)) return -1;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.down)) return 1;
    return 0;
  }

  cancelJustPressed() {
    return Phaser.Input.Keyboard.JustDown(this.cancelKey);
  }

  phoneJustPressed() {
    return Phaser.Input.Keyboard.JustDown(this.phoneKey);
  }

  sleepJustPressed() {
    return Phaser.Input.Keyboard.JustDown(this.sleepKey);
  }
}
