import Phaser from 'phaser';
import { PALETTE, TIME } from '../config.js';
import { KEYS } from '../data/assetManifest.js';

// Atmosphere - the whole "make it look like 2026, not 1996" graphics layer,
// kept out of WorldScene so the scene stays about gameplay.
//
// It owns: Phaser 4 dynamic lighting (ambient + lamp/window/player lights),
// additive glow sprites (a GPU-independent guarantee of visible light pools),
// a clock-driven day/night ColorMatrix grade, bloom + vignette post-fx, and
// particle weather/ambient (rain, foot dust, dawn fog, park leaves).
//
// WorldScene calls update(dayFraction, weather) every frame.
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

  // --- a soft radial glow texture (additive), built once ---------------------
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
    try {
      this.lights = this.scene.lights;
      this.lights.enable();
      this.lights.setAmbientColor(0xffffff); // day default; ramped in update()
      this.litLayers.forEach((l) => l.setLighting?.(true));
      this.player.enableLighting?.();

      // Lamp + window point lights (mostly visible at night vs dark ambient).
      this.pointLights = [];
      this.lampPositions.forEach((p) => {
        const lt = this.lights.addLight(p.x, p.y, 90, 0xffe7b0, 2.2);
        this.pointLights.push(lt);
      });
      this.windowPositions.forEach((p) => {
        const lt = this.lights.addLight(p.x, p.y, 70, p.color ?? 0xffd98a, 1.6);
        this.pointLights.push(lt);
      });
      // A soft light following the player (their phone/torch at night).
      this.playerLight = this.lights.addLight(this.player.x, this.player.y, 110, 0xbcd2ff, 1.2);
      this.lightingOk = true;
    } catch (e) {
      // Software/old GPU without the lighting pipeline: degrade gracefully to
      // the additive glow sprites + color grade below.
      console.warn('Lighting unavailable, using glow fallback:', e?.message);
      this.lightingOk = false;
    }
  }

  // Additive glow sprites at each lamp/window. These render regardless of the
  // lighting pipeline, so "pools of light" are guaranteed. Alpha ramps at night.
  setupGlows() {
    this.glows = [];
    const add = (x, y, color, scale) => {
      const s = this.scene.add.image(x, y, 'fx_glow');
      s.setBlendMode(Phaser.BlendModes.ADD);
      s.setTint(color);
      s.setScale(scale);
      s.setDepth(900000); // above world, below UI
      s.setAlpha(0);
      this.glows.push(s);
    };
    this.lampPositions.forEach((p) => add(p.x, p.y - 6, 0xffe7b0, 1.6));
    this.windowPositions.forEach((p) => add(p.x, p.y, p.color ?? 0xffd98a, 1.1));
    // player-follow glow
    this.playerGlow = this.scene.add.image(this.player.x, this.player.y, 'fx_glow');
    this.playerGlow.setBlendMode(Phaser.BlendModes.ADD).setTint(0xbcd2ff).setScale(2.2).setDepth(900001).setAlpha(0);
  }

  // --- Post-processing: day/night grade + bloom + vignette ------------------
  // Each filter is added independently and defensively: the v4 API differs from
  // v3 (no addBloom on FilterList; ColorMatrix methods live under .colorMatrix),
  // and software/old GPUs may lack pieces. The color grade (criterion #4) is the
  // priority and is tracked separately from the optional bloom/vignette.
  setupFilters() {
    const cam = this.scene.cameras.main;
    this.filtersOk = false;

    // Day/night color grade (the important one).
    try {
      const ctrl = cam.filters.internal.addColorMatrix();
      // v4: the color ops live on controller.colorMatrix; fall back to ctrl.
      this.grade = ctrl.colorMatrix || ctrl;
      this.filtersOk = typeof this.grade.brightness === 'function';
    } catch (e) {
      console.warn('Color grade unavailable:', e?.message);
    }

    // Bloom: v4 removed FilterList.addBloom; prefer the Action, else skip (the
    // additive glow sprites already provide light-pool glow either way).
    try {
      if (Phaser.Actions?.AddEffectBloom) {
        // Subtle: low strength so it reads as "polished", not Instagram.
        Phaser.Actions.AddEffectBloom([cam], 0xffffff, 0.9, 0.9, 1.05, 0.6);
      }
    } catch (e) {
      console.warn('Bloom unavailable (using glow sprites):', e?.message);
    }

    // Vignette (screen space) to draw the eye inward.
    try {
      cam.filters.external.addVignette(0.5, 0.5, 0.78, 0.45);
    } catch (e) {
      console.warn('Vignette unavailable:', e?.message);
    }
  }

  // --- Particles: rain, foot dust, dawn fog, park leaves --------------------
  setupParticles() {
    const { width, height } = this.scene.scale;
    const cam = this.scene.cameras.main;

    // Rain: a screen-space emitter spanning the camera, toggled by weather.
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
      blendMode: 'NORMAL',
    });
    this.rain.setScrollFactor(0).setDepth(950000);
    this.rain.stop();

    // Foot dust: short puffs that follow the player while walking.
    this.footDust = this.scene.add.particles(0, 0, KEYS.DUST, {
      lifespan: 420,
      speed: { min: 4, max: 14 },
      angle: { min: 200, max: 340 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.5, end: 0 },
      frequency: -1, // emitted manually via puff()
    });
    this.footDust.setDepth(1);

    // Park leaves: a gentle ambient drift over the park area.
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
    void cam;
  }

  // Manual foot-dust burst at a world point (called by WorldScene when walking).
  puffDust(x, y) {
    this.footDust?.emitParticleAt(x, y, 1);
  }

  setWeather(weather) {
    this.weather = weather;
    if (weather === 'rainy') this.rain.start();
    else this.rain.stop();
  }

  // --- Per-frame drive -------------------------------------------------------
  // dayFraction: 0 = midnight, 0.5 = noon, ~0.25 sunrise, ~0.75 sunset.
  update(dayFraction) {
    const t = dayFraction;
    // Sun elevation: 0 at night, 1 at noon.
    const sun = Math.max(0, Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5);
    // nightAmt high near midnight, 0 around noon.
    const nightAmt = 1 - sun;

    // Ambient light color ramps from deep night-blue -> full daylight.
    if (this.lightingOk) {
      const r = Math.round(Phaser.Math.Linear(40, 255, sun));
      const g = Math.round(Phaser.Math.Linear(48, 255, sun));
      const b = Math.round(Phaser.Math.Linear(86, 255, sun));
      this.lights.setAmbientColor((r << 16) | (g << 8) | b);
      if (this.playerLight) {
        this.playerLight.setPosition(this.player.x, this.player.y);
        this.playerLight.intensity = 0.4 + nightAmt * 1.4;
      }
    }

    // Color grade: warm at sunrise/sunset, blue+dark at night, neutral midday.
    if (this.filtersOk && this.grade) {
      const cm = this.grade;
      cm.reset();
      // brightness dips at night
      cm.brightness(Phaser.Math.Linear(0.55, 1.05, sun));
      // saturation a touch lower at night
      cm.saturate(Phaser.Math.Linear(-0.15, 0.05, sun));
      // built-in night tint
      if (nightAmt > 0.02 && cm.night) cm.night(nightAmt * 0.35);
      // golden hour: push warmth near sunrise (~0.25) and sunset (~0.75)
      const golden = Math.max(0, 1 - Math.min(Math.abs(t - 0.25), Math.abs(t - 0.75)) * 8);
      if (golden > 0 && cm.hue) cm.hue(-golden * 10);
      // rain: cooler, darker grade on top
      if (this.weather === 'rainy') {
        cm.saturate(-0.2);
        cm.brightness(0.8);
      }
    }

    // Glow alphas: fade lamp/window pools in at night.
    const glowA = Phaser.Math.Clamp(nightAmt * 1.2 - 0.1, 0, 1);
    for (const s of this.glows) s.setAlpha(glowA);
    if (this.playerGlow) {
      this.playerGlow.setPosition(this.player.x, this.player.y);
      this.playerGlow.setAlpha(glowA * 0.7);
    }
  }
}
