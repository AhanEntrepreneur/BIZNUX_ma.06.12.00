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

      // Lamp/window lights are warm and gentle (Part 0.D), not blinding.
      this.pointLights = [];
      this.lampPositions.forEach((p) => {
        this.pointLights.push(this.lights.addLight(p.x, p.y, 80, 0xffe7b0, 1.1));
      });
      this.windowPositions.forEach((p) => {
        this.pointLights.push(this.lights.addLight(p.x, p.y, 60, p.color ?? 0xffd98a, 0.8));
      });
      // A soft cool light following the player so their surroundings are always
      // visible at night (Part 0.E). Intensity is driven in update().
      this.playerLight = this.lights.addLight(this.player.x, this.player.y, 110, 0xcfe0ff, 0);
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
        // Tasteful bloom (Part 0.D): high threshold so only genuinely bright
        // pixels bloom, low strength so doors glow warmly instead of blinding.
        // args: (objs, color, offsetX, offsetY, blurStrength, bloomStrength, steps, threshold?)
        Phaser.Actions.AddEffectBloom([cam], 0xffffff, 0.8, 0.8, 0.5, 0.18);
      }
    } catch (e) {
      console.warn('Bloom unavailable (using glow sprites):', e && e.message);
    }
    try {
      // Soft vignette: large radius, low strength, so it frames without
      // crushing the periphery into darkness (compounds with night ambient).
      cam.filters.external.addVignette(0.5, 0.5, 0.95, 0.22);
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

    // Ambient ramps from a NAVIGABLE night-blue (never near-black) to full
    // daylight (Part 0.E). The floor is high enough to read the world at night.
    if (this.lightingOk) {
      // Night floor ~ (180,188,205): a clearly-readable blue dusk, not a cave.
      const r = Math.round(Phaser.Math.Linear(180, 255, sun));
      const g = Math.round(Phaser.Math.Linear(188, 255, sun));
      const b = Math.round(Phaser.Math.Linear(205, 255, sun));
      this.lights.setAmbientColor((r << 16) | (g << 8) | b);
      if (this.playerLight) {
        this.playerLight.setPosition(this.player.x, this.player.y);
        // Present across the whole night (squared, not cubed) so the player's
        // immediate surroundings stay lit after dusk - gentle, not a spotlight.
        this.playerLight.intensity = nightAmt * nightAmt * 0.9;
      }
    }

    // Color grade with a COMPRESSED amplitude (Part 0.E): day is bright but not
    // clipped to white; night is a dim navigable blue dusk, never true black.
    if (this.filtersOk && this.grade) {
      const cm = this.grade;
      cm.reset();
      // brightness: 0.85 (night) -> 1.0 (midday). The grade ALWAYS runs (even
      // where the GPU lighting pipeline is unavailable), so this floor alone
      // must keep night navigable - never crushed to black, never blown white.
      cm.brightness(Phaser.Math.Linear(0.85, 1.0, sun));
      cm.saturate(Phaser.Math.Linear(-0.1, 0.03, sun));
      // A gentle night tint for mood, capped low so the world stays readable.
      if (nightAmt > 0.02 && cm.night) cm.night(nightAmt * 0.12);
      const golden = Math.max(0, 1 - Math.min(Math.abs(t - 0.25), Math.abs(t - 0.75)) * 8);
      if (golden > 0 && cm.hue) cm.hue(-golden * 8);
      if (this.weather === 'rainy') {
        cm.saturate(-0.15);
        cm.brightness(0.88);
      }
    }

    // Lamp/window glow pools fade in at night but stay restrained (Part 0.D:
    // warm glow, not headlights). Player-following glow keeps the immediate
    // surroundings visible at night (Part 0.E).
    const glowA = Phaser.Math.Clamp(nightAmt * 0.7 - 0.05, 0, 0.6);
    for (const s of this.glows) s.setAlpha(glowA);
    if (this.playerGlow) {
      this.playerGlow.setPosition(this.player.x, this.player.y);
      this.playerGlow.setAlpha(Phaser.Math.Clamp(nightAmt * 0.55 - 0.05, 0, 0.45));
    }
  }
}
