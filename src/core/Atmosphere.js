import Phaser from 'phaser';
import { KEYS } from '../data/assetManifest.js';

// Atmosphere - the whole "make it look like 2026, not 1996" graphics layer,
// kept out of WorldScene so the scene stays about gameplay.
//
// It owns: Phaser 4 dynamic lighting (ambient + lamp/window/player lights),
// additive glow sprites (a GPU-independent guarantee of visible light pools),
// a clock-driven day/night ColorMatrix grade, bloom + vignette post-fx, and
// particle weather/ambient (rain, foot dust, dawn fog, park leaves).
//
// WorldScene calls update(dayFraction) every frame.
export default class Atmosphere {
  constructor(scene, opts) {
    this.scene = scene;
    this.player = opts.player;
    this.lampPositions = opts.lamps || []; // [{x,y}]
    this.windowPositions = opts.windows || []; // [{x,y,color}]
    this.litLayers = opts.litLayers || [];
    this.weather = 'sunny';

    this.makeGlowTexture();
    this.setupLighting();
    this.setupGlows();
    this.setupFilters();
    this.setupParticles();
  }

  // A soft radial glow texture (additive), built once.
  makeGlowTexture() {
    if (this.scene.textures.exists('fx_glow')) return;
    const size = 64;
    const tex = this.scene.textures.createCanvas('fx_glow', size, size);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  // --- Phaser 4 dynamic lighting --------------------------------------------
  setupLighting() {
    this.lightingOk = false;
    try {
      this.lights = this.scene.lights;
      this.lights.enable();
      this.lights.setAmbientColor(0xffffff);
      this.litLayers.forEach((l) => l.setLighting && l.setLighting(true));
      if (this.player.enableLighting) this.player.enableLighting();

      this.pointLights = [];
      this.lampPositions.forEach((p) => {
        this.pointLights.push(this.lights.addLight(p.x, p.y, 90, 0xffe7b0, 2.2));
      });
      this.windowPositions.forEach((p) => {
        this.pointLights.push(this.lights.addLight(p.x, p.y, 70, p.color ?? 0xffd98a, 1.6));
      });
      // A soft light following the player; only meaningful at night.
      this.playerLight = this.lights.addLight(this.player.x, this.player.y, 100, 0xbcd2ff, 0);
      this.lightingOk = true;
    } catch (e) {
      console.warn('Lighting unavailable, using glow fallback:', e && e.message);
    }
  }

  // Additive glow sprites at each lamp/window (render regardless of the lighting
  // pipeline, so "pools of light" are guaranteed). Alpha ramps in at night.
  setupGlows() {
    this.glows = [];
    const add = (x, y, color, scale) => {
      const s = this.scene.add.image(x, y, 'fx_glow');
      s.setBlendMode(Phaser.BlendModes.ADD);
      s.setTint(color);
      s.setScale(scale);
      s.setDepth(900000);
      s.setAlpha(0);
      if (s.setLighting) s.setLighting(false);
      this.glows.push(s);
    };
    this.lampPositions.forEach((p) => add(p.x, p.y - 6, 0xffe7b0, 1.6));
    this.windowPositions.forEach((p) => add(p.x, p.y, p.color ?? 0xffd98a, 1.1));
    this.playerGlow = this.scene.add.image(this.player.x, this.player.y, 'fx_glow');
    this.playerGlow.setBlendMode(Phaser.BlendModes.ADD).setTint(0xbcd2ff).setScale(1.8).setDepth(900001).setAlpha(0);
    if (this.playerGlow.setLighting) this.playerGlow.setLighting(false);
  }

  // --- Post-processing: day/night grade + bloom + vignette ------------------
  // Defensive: the v4 filter API differs from v3 (no FilterList.addBloom;
  // ColorMatrix ops live under .colorMatrix), and software GPUs may lack pieces.
  // The day/night grade is the priority and is tracked via this.filtersOk.
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
    try {
      if (Phaser.Actions && Phaser.Actions.AddEffectBloom) {
        Phaser.Actions.AddEffectBloom([cam], 0xffffff, 0.9, 0.9, 1.05, 0.6);
      }
    } catch (e) {
      console.warn('Bloom unavailable (using glow sprites):', e && e.message);
    }
    try {
      cam.filters.external.addVignette(0.5, 0.5, 0.78, 0.45);
    } catch (e) {
      console.warn('Vignette unavailable:', e && e.message);
    }
  }

  // --- Particles: rain, foot dust, dawn fog, park leaves --------------------
  setupParticles() {
    const { width } = this.scene.scale;

    this.rain = this.scene.add.particles(0, 0, KEYS.RAINDROP, {
      x: { min: 0, max: width + 40 },
      y: -10,
      lifespan: 900,
      speedY: { min: 420, max: 560 },
      speedX: { min: -60, max: -30 },
      scale: { min: 0.6, max: 1.1 },
      alpha: { start: 0.55, end: 0.15 },
      quantity: 6,
      frequency: 24,
    });
    this.rain.setScrollFactor(0).setDepth(950000);
    this.rain.stop();

    this.footDust = this.scene.add.particles(0, 0, KEYS.DUST, {
      lifespan: 420,
      speed: { min: 4, max: 14 },
      angle: { min: 200, max: 340 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.5, end: 0 },
      frequency: -1,
    });
    this.footDust.setDepth(1);

    if (this.scene.parkRect) {
      const r = this.scene.parkRect;
      this.leaves = this.scene.add.particles(0, 0, KEYS.LEAF, {
        x: { min: r.x, max: r.x + r.w },
        y: { min: r.y, max: r.y + r.h },
        lifespan: 4000,
        speedX: { min: -12, max: 12 },
        speedY: { min: 6, max: 18 },
        scale: { min: 0.6, max: 1 },
        alpha: { start: 0.7, end: 0 },
        rotate: { min: 0, max: 360 },
        frequency: 700,
      });
      this.leaves.setDepth(800000);
    }
  }

  puffDust(x, y) {
    if (this.footDust) this.footDust.emitParticleAt(x, y, 1);
  }

  setWeather(weather) {
    this.weather = weather;
    if (weather === 'rainy') this.rain.start();
    else this.rain.stop();
  }

  // --- Per-frame drive ------------------------------------------------------
  // dayFraction: 0 = midnight, 0.5 = noon, ~0.25 sunrise, ~0.75 sunset.
  update(dayFraction) {
    const t = dayFraction;
    const sun = Math.max(0, Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5);
    const nightAmt = 1 - sun;

    // Ambient ramps from deep night-blue to full daylight.
    if (this.lightingOk) {
      const r = Math.round(Phaser.Math.Linear(40, 255, sun));
      const g = Math.round(Phaser.Math.Linear(48, 255, sun));
      const b = Math.round(Phaser.Math.Linear(86, 255, sun));
      this.lights.setAmbientColor((r << 16) | (g << 8) | b);
      if (this.playerLight) {
        this.playerLight.setPosition(this.player.x, this.player.y);
        // Steep curve: the player's torch only matters in DEEP night, so dusk
        // stays golden/clean instead of getting a colored halo around the
        // player. nightAmt^3 is ~0 until it's genuinely dark.
        this.playerLight.intensity = Math.pow(nightAmt, 3) * 1.8;
      }
    }

    // Color grade: warm at golden hour, blue+dark at night, neutral midday.
    if (this.filtersOk && this.grade) {
      const cm = this.grade;
      cm.reset();
      cm.brightness(Phaser.Math.Linear(0.55, 1.05, sun));
      cm.saturate(Phaser.Math.Linear(-0.15, 0.05, sun));
      if (nightAmt > 0.02 && cm.night) cm.night(nightAmt * 0.35);
      const golden = Math.max(0, 1 - Math.min(Math.abs(t - 0.25), Math.abs(t - 0.75)) * 8);
      if (golden > 0 && cm.hue) cm.hue(-golden * 10);
      if (this.weather === 'rainy') {
        cm.saturate(-0.2);
        cm.brightness(0.8);
      }
    }

    // Glow pools fade in at night (and a smaller one follows the player).
    const glowA = Phaser.Math.Clamp(nightAmt * 1.2 - 0.1, 0, 1);
    for (const s of this.glows) s.setAlpha(glowA);
    if (this.playerGlow) {
      this.playerGlow.setPosition(this.player.x, this.player.y);
      // Match the light: only a faint personal glow in deep night.
      this.playerGlow.setAlpha(Math.pow(nightAmt, 3) * 0.5);
    }
  }
}
