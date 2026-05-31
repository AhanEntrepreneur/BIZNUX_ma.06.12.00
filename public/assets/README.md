# Assets

v1 needs **nothing in this folder** — all art is generated programmatically at
runtime (see `src/utils/generateArt.js`). The game runs with zero downloads.

## Dropping in real art later

1. Add your image files here, e.g.:
   - `tiles.png` — a horizontal strip (or grid) of 16×16 tiles, in the order
     defined by `TILES` in `src/config.js`
     (grass, path, water, tree, flower, wall, roof, door, sand).
   - `player.png` — a 16×16 spritesheet, 4 directions × 3 frames laid left→right
     in the order `down, left, right, up` (each: idle, stepA, stepB), matching
     `CHAR` in `src/config.js`.
2. In `src/config.js`, set `USE_PLACEHOLDER_ART = false` (and adjust
   `ASSET_PATHS` if you used different filenames).
3. Run the game. No scene or gameplay code needs to change.

Good free sources: [Kenney.nl](https://kenney.nl) and
[itch.io](https://itch.io/game-assets/free/tag-16x16).
