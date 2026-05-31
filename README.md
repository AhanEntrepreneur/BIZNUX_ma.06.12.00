# Dinomonz

A retro, top-down 2D overworld in the spirit of classic GBA-era Pokémon and
early Stardew Valley — pixel art, tile-based, a little character you can walk
around a small world. This is **v1**: a working, explorable world built so that
either a **farming** system or a **battle** system can be added later.

Built with **Phaser 3** + **Vite**, plain JavaScript (ES modules).

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). No assets to
download — all placeholder pixel art is generated in code.

> Requires Node 18+ (developed on Node 22).

## Controls

- **Move:** Arrow keys or WASD
- **Talk / advance dialogue:** Space or Enter
- **Start (title screen):** Enter or Space

Walk up to an NPC or the wooden sign (a `!` appears when you can interact) and
press Space/Enter to talk. Text types out retro-style; press again to advance,
and again to close. Movement is locked while a dialogue box is open.

## What's in v1

- 320×240 internal resolution scaled up with pixel-perfect, nearest-neighbor
  rendering (no blur), 16×16 tiles, a cohesive palette, and a bundled pixel font
  (Press Start 2P).
- A 40×30 tile world: grass, dirt paths, water, trees, two buildings, flowers.
- Collision — you can't walk through water, trees, or buildings.
- A 4-direction player with a simple walk animation and a smooth, map-clamped
  follow camera.
- Two NPCs and a sign you can talk to.
- A retro dialogue box with a typewriter effect.
- A title screen.
- A reserved HUD panel (top-left) for a future energy/time bar or party readout.

## Project layout

```
index.html              # mounts the game, forces crisp pixel scaling
vite.config.js
public/assets/          # (empty in v1) where real spritesheets go later
src/
  main.js               # Phaser game config + boots the scenes
  config.js             # ALL tunables: resolution, tiles, asset switch, palette
  eventbus.js           # tiny cross-scene event emitter
  scenes/
    PreloadScene.js     # generates (or loads) assets, then -> TitleScene
    TitleScene.js       # "Press Enter to Start"
    WorldScene.js       # the overworld: map, player, NPCs, camera, interaction
    UIScene.js          # HUD + dialogue box (runs above the world)
  entities/
    Player.js           # 4-direction movement + walk anims
    NPC.js              # NPCs and static interactables (signs)
  data/
    map.js              # the tile map (ground + object layers), as data
    npcs.js             # NPC/sign placements
    dialogue.js         # dialogue lines, keyed by id
  utils/
    generateArt.js      # programmatic placeholder pixel art
```

### Why it's organized this way

Map layout, NPC placements, and dialogue are **data** (`src/data/`), separate
from scene logic. Assets are referenced by **named keys** and **frame indices**
defined in `src/config.js`. So you can:

- Reshape the world by editing `data/map.js`.
- Add/move NPCs in `data/npcs.js` and write their lines in `data/dialogue.js`.
- Replace the placeholder art with real spritesheets by adding files to
  `public/assets/` and flipping one flag — see `public/assets/README.md`.

## Swapping in real art

All art is procedural for v1. To use real tilesets/character sheets (e.g. free
Kenney.nl or itch.io 16×16 packs), follow `public/assets/README.md`: drop in the
files, set `USE_PLACEHOLDER_ART = false` in `src/config.js`. No gameplay code
changes.

## Phase 2 (not built yet)

The architecture is kept ready for either direction:

- **Pokémon:** tall-grass encounter zones, a turn-based `BattleScene`, a
  creature/party with stats, an inventory.
- **Stardew:** a tillable farm grid, seeds/crops growing over in-game days, a
  day/time + energy system, tool selection, an inventory.

Hooks already in place: a reserved HUD area in `UIScene`, data-driven map/NPC
config, an event bus for new systems, and clearly separated scenes/entities.
