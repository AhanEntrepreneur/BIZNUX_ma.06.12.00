import Phaser from 'phaser';
import { KEYS } from '../data/assetManifest.js';
import { EventBus, EVENTS } from '../eventbus.js';

// Atmosphere - day/night, weather, and ambient particles.
//
// P.2/P.3 ROOT-CAUSE FIX: the previous version used Phaser's GPU Light2D
// pipeline with point-lights stuck on every door/window. On a real GPU those
// lights stacked on daytime ambient and clipped doors to white blobs, and the
// same pipeline crushed nights to black (it renders differently than the
// software renderer used headless). We REMOVE the GPU lighting pipeline
// entirely. Day/night is now driven ONLY by the camera ColorMatrix grade -
// which is deterministic on every GPU - with a hard "never black" floor, plus
// cheap ADDITIVE glow sprites for warm light pools and a player-following glow
// that guarantees the area around the player is always visible at night. Doors
// have no special light, so in daytime they're lit exactly like the wall.
//
// P.4 ROOT-CAUSE FIX: weather is event-driven. Atmosphere subscribes to the one
// authoritative WEATHER_CHANGED event, so HUD, particles, grade tint, and the
// gameplay modifier all read the same value and change on the same tick.
export default class Atmosphere {
  constructor(scene, opts) {
    this.scene = scene;
    this.player = opts.player;
    this.lampPositions = opts.lamps || [];
    this.windowPositions = opts.windows || [];
    this.weather = scene.gs?.data?.weather || 'sunny';

    this.makeGlowTexture();
    this.setupGlows();
    this.setupFilters();
    this.setupParticles();

    // Single source of truth for weather (P.4): react to the same event the
    // HUD listens to, so visuals can never disagree with the readout.
    this._onWeather = (p) => this.applyWeather(p.weather);
    EventBus.on(EVENTS.WEATHER_CHANGED, this._onWeather, this);
    scene.events.once('shutdown', () => EventBus.off(EVENTS.WEATHER_CHANGED, this._onWeather, this));
    this.applyWeather(this.weather);
  }

  makeGlowTexture() {
    if (this.scene.textures.exists('fx_glow')) return;
    const size = 64;
    const tex = this.scene.textures.createCanvas('fx_glow', size, size);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  // Additive glow sprites for warm light pools (lamps/windows) + a player glow.
  // These are plain sprites - GPU-independent - so they look the same for Ahan
  // as they do headless.
  setupGlows() {
    this.glows = [];
    const add = (x, y, color, scale) => {
      const s = this.scene.add.image(x, y, 'fx_glow');
      s.setBlendMode(Phaser.BlendModes.ADD).setTint(color).setScale(scale).setDepth(900000).setAlpha(0);
      this.glows.push(s);
    };
    this.lampPositions.forEach((p) => add(p.x, p.y - 6, 0xffe2a8, 1.3));
    this.windowPositions.forEach((p) => add(p.x, p.y, 0xffd98a, 0.9));
    this.playerGlow = this.scene.add.image(this.player.x, this.player.y, 'fx_glow');
    this.playerGlow.setBlendMode(Phaser.BlendModes.ADD).setTint(0xbfd2ee).setScale(2.0).setDepth(900001).setAlpha(0);
  }

  setupFilters() {
    const cam = this.scene.cameras.main;
    this.filtersOk = false;
    try {
      const ctrl = cam.filters.internal.addColorMatrix();
      this.grade = ctrl.colorMatrix || ctrl;
      this.filtersOk = typeof this.grade.brightness === 'function';
    } catch (e) {
      console.warn('Color grade unavailable:', e && e.message);
    }
    // NO camera Bloom: the full-screen bloom filter crushed all mid-tones to
    // black on the renderer (only bright pixels survived), which was the real
    // cause of the "everything dark" screens. Warm light pools come from the
    // additive glow sprites instead, which are deterministic on every GPU.
    try {
      cam.filters.external.addVignette(0.5, 0.5, 1.15, 0.08);
    } catch (e) {
      console.warn('Vignette unavailable:', e && e.message);
    }
  }

  setupParticles() {
    const { width } = this.scene.scale;
    this.rain = this.scene.add.particles(0, 0, KEYS.RAINDROP, {
      x: { min: 0, max: width + 40 }, y: -10, lifespan: 900,
      speedY: { min: 420, max: 560 }, speedX: { min: -60, max: -30 },
      scale: { min: 0.6, max: 1.1 }, alpha: { start: 0.55, end: 0.15 },
      quantity: 6, frequency: 24,
    });
    this.rain.setScrollFactor(0).setDepth(950000);
    this.rain.stop();

    this.footDust = this.scene.add.particles(0, 0, KEYS.DUST, {
      lifespan: 420, speed: { min: 4, max: 14 }, angle: { min: 200, max: 340 },
      scale: { start: 1, end: 0 }, alpha: { start: 0.5, end: 0 }, frequency: -1,
    });
    this.footDust.setDepth(1);

    if (this.scene.parkRect) {
      const r = this.scene.parkRect;
      this.leaves = this.scene.add.particles(0, 0, KEYS.LEAF, {
        x: { min: r.x, max: r.x + r.w }, y: { min: r.y, max: r.y + r.h },
        lifespan: 4000, speedX: { min: -12, max: 12 }, speedY: { min: 6, max: 18 },
        scale: { min: 0.6, max: 1 }, alpha: { start: 0.7, end: 0 },
        rotate: { min: 0, max: 360 }, frequency: 700,
      });
      this.leaves.setDepth(800000);
    }
  }

  puffDust(x, y) {
    if (this.footDust) this.footDust.emitParticleAt(x, y, 1);
  }

  // Apply a weather value to ALL visual channels at once (P.4). Called from the
  // WEATHER_CHANGED handler and once at construction.
  applyWeather(weather) {
    this.weather = weather;
    if (!this.rain) return;
    if (weather === 'rainy') this.rain.start();
    else this.rain.stop();
  }

  // Back-compat shim: WorldScene used to call atmo.setWeather directly. Now the
  // event drives it, but keep this so any caller still works (it just routes
  // through the same single path).
  setWeather(weather) { this.applyWeather(weather); }

  // --- Per-frame drive: deterministic grade + glow alphas -------------------
  // dayFraction: 0 = midnight, 0.5 = noon, ~0.25 sunrise, ~0.75 sunset.
  update(dayFraction) {
    const t = dayFraction;
    const sun = Math.max(0, Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5);
    const nightAmt = 1 - sun;

    if (this.filtersOk && this.grade) {
      const cm = this.grade;
      cm.reset();
      // brightness floor 0.6 at deepest night -> 1.0 midday. 0.6 reads as
      // "evening you can clearly see in", never black; 1.0 is bright, not
      // clipped. This grade is the ONLY thing darkening the scene now, so it
      // alone guarantees navigability on every GPU.
      // NOTE: deliberately NOT using cm.night() - it multiplies channels down
      // hard and was the real cause of "pitch black" nights. We darken ONLY via
      // a generous brightness floor so the world is always readable, and get the
      // blue evening mood from a mild cool saturate/hue instead.
      cm.brightness(Phaser.Math.Linear(0.82, 1.0, sun));
      cm.saturate(Phaser.Math.Linear(-0.08, 0.02, sun));
      // Warm golden hour around sunrise/sunset.
      const golden = Math.max(0, 1 - Math.min(Math.abs(t - 0.25), Math.abs(t - 0.75)) * 8);
      if (golden > 0 && cm.hue) cm.hue(-golden * 8);
      // Rain: cooler + a touch darker, applied with the SAME weather value the
      // HUD shows (P.4 - never out of sync).
      if (this.weather === 'rainy') { cm.saturate(-0.12); cm.brightness(0.92); }
      else if (this.weather === 'cold') { cm.saturate(-0.06); }
    }

    // Warm light pools fade in at night (restrained - inviting, not headlights).
    const poolA = Phaser.Math.Clamp(nightAmt * 0.6 - 0.05, 0, 0.5);
    for (const s of this.glows) s.setAlpha(poolA);
    // Player glow: always lights the immediate area at night (P.3). Present
    // across the whole night so the player is never standing in the dark.
    if (this.playerGlow) {
      this.playerGlow.setPosition(this.player.x, this.player.y);
      this.playerGlow.setAlpha(Phaser.Math.Clamp(nightAmt * 0.5 - 0.04, 0, 0.4));
    }
  }
}
