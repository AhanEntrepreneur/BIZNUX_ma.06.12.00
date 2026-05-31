# Biznux 2D

A top-down, retro pixel-art **life-and-business simulator**. The full vision is a
persistent, multiplayer, multi-city world where you build a life, run businesses,
and survive an economy where every other person is a real player who's allowed to
want what you have — *"Stardew Valley's pace with Grand Theft Auto's morality."*

**This repo is v1: a single-player vertical slice** that proves the core feel and
is deliberately architected so multiplayer, more cities, property/business depth,
crime, governance, and romance can be layered on without rewrites.

Built with **Phaser 3** + **Vite**, plain JavaScript (ES modules).

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). No assets to download —
all placeholder pixel art is generated in code. Requires Node 18+ (built on 22).

## Controls

- **Move:** Arrow keys / WASD — *smooth analog movement in any direction*
- **Interact / confirm:** Space or Enter (walk up to an NPC; a `!` appears)
- **Menus:** Up/Down to choose, Space/Enter to select, Esc to cancel
- **Phone (your stats):** TAB
- **Sleep:** Z (stand near your apartment door)

## What's in v1 (the shared RPG + economy core)

- **Character creation:** body type, face, hairstyle, hair color, starter outfit,
  with a live **layered** preview (body / hair / outfit are separate, recolorable
  sprite layers — the foundation for the spec's deep clothing system).
- **A generic metropolis:** roads, sidewalks, crosswalks, a central plaza, a park
  with trees and a pond, and named buildings (apartment, cafe, store, college,
  realtor, city hall) with collision.
- **Smooth follow camera** clamped to the city bounds.
- **A living clock:** 1 real second = 1 in-game minute (a full day in 24 real
  minutes), with day/hour events and **daily midnight settlement** — wages paid,
  rent charged — that also catches up time you were away.
- **Five universal stats** (Charisma, Intelligence, Strength, Reputation,
  Confidence) and a **fatigue** system that makes work harder when you're tired.
- **Weather** that's mechanical: rain docks outdoor-job payouts.
- **Five entry-tier jobs** (cafe, retail, delivery, dog walker, busker) with a
  **clock-in work mini-game** — click the targets before they expire, re-skinned
  per job (cups, packages, notes…). Better performance → bigger payout + stat XP.
- **Community college** courses that cost money and raise a stat.
- **Buy your first home** from the realtor to kill rent and gain rep/confidence.
- **A HUD + phone** showing money, day/time, weather, fatigue, and full stats.
- **Local save** (localStorage) — your character persists across reloads.

## Project layout

```
src/
  main.js                 # Phaser config + scene registry; injects jobs table
  config.js               # ALL tunables: resolution, time, economy, palette, art switch
  eventbus.js             # cross-scene/system events (the seam for networking later)
  core/
    GameState.js          # authoritative player+world data, NO Phaser — server-ready
    InputController.js     # analog movement + confirm/cancel/phone/sleep keys
  scenes/
    PreloadScene.js       # generate/load assets
    TitleScene.js         # new game vs. continue
    CharacterScene.js     # character creation w/ live layered preview
    WorldScene.js         # the city: map, clock, NPCs, camera, interaction dispatch
    MiniGameScene.js      # the work-shift click mini-game (re-skinned per job)
    UIScene.js            # HUD, phone, dialogue box, menus, toasts
  entities/
    CharacterSprite.js    # layered body+hair+outfit sprite (player & NPCs)
    Player.js             # analog movement + physics body
    NPC.js                # interactable NPC w/ role + marker
  data/
    city.js               # the city map (ground + objects + named buildings)
    npcs.js               # NPC placements + roles
    dialogue.js           # dialogue lines
    jobs.js               # job definitions (wage, shift, mini-game skin, stat)
    appearance.js         # character-creation option tables
public/assets/            # (empty in v1) where real spritesheets go later
```

### Why it's built this way (the road to multiplayer)

- **`core/GameState.js` has no Phaser imports** and is pure, JSON-serializable
  data + mutators. In v1 it's the local player's source of truth saved to
  localStorage. To go multiplayer, this module (or a sibling) moves to an
  authoritative server, persistence becomes a database, and scenes — which
  already read/mutate state *only* through its methods and the **EventBus** —
  keep working as the render layer.
- **Map, NPCs, jobs, dialogue, and appearance options are data files**, not code,
  so cities/jobs/NPCs scale by editing data.
- **Art is referenced by keys + frame indices** and generated behind one config
  flag, so real spritesheets drop in without touching gameplay.

## Roadmap (not built yet — architecture is ready)

Layered on top of this slice, in rough order: more jobs/tiers + illegal jobs and
a wanted level → property & business ownership (mortgages, pricing, staff) →
**multiplayer** (authoritative server, shared world, see other players) → PvP
crime (pickpocket/burglary/sabotage) + police → marketplace/auction/trades →
mayoral elections & city budgets → NPC romance/marriage → the three additional
cities + travel → random economic events & leaderboards.

There is no win condition. You climb, you fall, or you find a middle and live there.
