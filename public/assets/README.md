# Assets

v1 needs **nothing here** — all art is generated programmatically at runtime
(`src/utils/generateArt.js`), so the game runs with zero downloads.

## Dropping in real art later

The character is drawn as **three layered spritesheets** (body + hair + outfit)
so clothing/hair layer and recolor independently. Each sheet is 4 directions ×
3 frames (16×16), laid left→right in the order `down, left, right, up`, each as
`[idle, stepA, stepB]` — matching `CHAR` in `src/config.js`.

1. Add image files here, e.g. `tiles.png`, `char_body.png`, `char_hair.png`,
   `char_outfit.png`.
   - `tiles.png` — strip of 16×16 tiles in the `TILES` order in `src/config.js`
     (grass, road, sidewalk, water, tree, plaza, wall, crosswalk, planter).
2. In `src/config.js` set `USE_PLACEHOLDER_ART = false` and adjust `ASSET_PATHS`.
3. Update `PreloadScene` to load the real layered sheets under the same keys the
   placeholder generator uses (`char_body_*`, `char_hair_*`, `char_outfit_*`),
   or simplify `CharacterSprite` to your sheet layout.

Good free sources: [Kenney.nl](https://kenney.nl),
[itch.io](https://itch.io/game-assets/free/tag-16x16).
