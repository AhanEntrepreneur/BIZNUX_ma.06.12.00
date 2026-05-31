// ---------------------------------------------------------------------------
// Map data (separate from scene logic).
//
// The map is two layers of tile indices (see TILES in config.js):
//   - ground:  walkable base tiles (grass / path / sand / flowers)
//   - objects: things drawn on top; some collide (trees, water, buildings)
//
// It's authored here with small builder helpers so it stays readable and easy
// to edit. WorldScene just consumes the arrays — it never hardcodes layout.
//
// Want a bigger/different world? Edit MAP_WIDTH/HEIGHT and the feature calls in
// buildMap(), or replace buildMap() with arrays exported from Tiled later.
// ---------------------------------------------------------------------------
import { TILES, TILE_SIZE } from '../config.js';

export const MAP_WIDTH = 40; // tiles
export const MAP_HEIGHT = 30; // tiles

// Object-layer tiles that should block the player.
export const COLLIDING_TILES = [
  TILES.WATER,
  TILES.TREE,
  TILES.BUILDING_WALL,
  TILES.BUILDING_ROOF,
  TILES.BUILDING_DOOR,
];

// Create a 2D array filled with `value`.
function makeLayer(value) {
  const rows = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    rows.push(new Array(MAP_WIDTH).fill(value));
  }
  return rows;
}

function inBounds(x, y) {
  return x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT;
}

function setTile(layer, x, y, value) {
  if (inBounds(x, y)) layer[y][x] = value;
}

// Draw a filled rectangle of tiles into a layer.
function fillRect(layer, x0, y0, w, h, value) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setTile(layer, x, y, value);
  }
}

// A simple house: roof on the top row, walls below, a door at the bottom center.
function placeBuilding(objects, x, y, w, h) {
  for (let ry = 0; ry < h; ry++) {
    for (let rx = 0; rx < w; rx++) {
      const tile = ry === 0 ? TILES.BUILDING_ROOF : TILES.BUILDING_WALL;
      setTile(objects, x + rx, y + ry, tile);
    }
  }
  // door at bottom center
  const doorX = x + Math.floor(w / 2);
  setTile(objects, doorX, y + h - 1, TILES.BUILDING_DOOR);
}

function buildMap() {
  const ground = makeLayer(TILES.GRASS);
  const objects = makeLayer(-1); // -1 = empty

  // --- Tree border around the whole map (a natural boundary) ---------------
  for (let x = 0; x < MAP_WIDTH; x++) {
    setTile(objects, x, 0, TILES.TREE);
    setTile(objects, x, MAP_HEIGHT - 1, TILES.TREE);
  }
  for (let y = 0; y < MAP_HEIGHT; y++) {
    setTile(objects, 0, y, TILES.TREE);
    setTile(objects, MAP_WIDTH - 1, y, TILES.TREE);
  }

  // --- Dirt paths ----------------------------------------------------------
  // A main vertical path and a main horizontal path forming a crossroads.
  fillRect(ground, 8, 2, 2, MAP_HEIGHT - 4, TILES.PATH); // vertical
  fillRect(ground, 4, 15, MAP_WIDTH - 8, 2, TILES.PATH); // horizontal

  // --- Pond (top-right) ----------------------------------------------------
  // Sand rim first, then water on top, for a nicer shoreline.
  fillRect(ground, 23, 4, 9, 8, TILES.SAND);
  fillRect(objects, 24, 5, 7, 6, TILES.WATER);

  // --- Buildings -----------------------------------------------------------
  placeBuilding(objects, 4, 5, 4, 4); // house near the top-left
  placeBuilding(objects, 28, 20, 4, 4); // house near the bottom-right
  // Little dirt patches at each doorstep.
  fillRect(ground, 5, 9, 2, 2, TILES.PATH);
  fillRect(ground, 29, 24, 2, 1, TILES.PATH);

  // --- A small grove of trees (collidable cluster) -------------------------
  const grove = [
    [14, 22], [15, 22], [16, 23], [14, 24], [17, 22], [16, 21],
  ];
  grove.forEach(([x, y]) => setTile(objects, x, y, TILES.TREE));

  // --- Scatter some flowers on grass for color (non-colliding) -------------
  const flowers = [
    [12, 6], [13, 7], [20, 10], [21, 18], [11, 19], [33, 12],
    [6, 20], [25, 25], [18, 8], [30, 14], [9, 25], [22, 23],
  ];
  flowers.forEach(([x, y]) => {
    if (ground[y][x] === TILES.GRASS && objects[y][x] === -1) {
      ground[y][x] = TILES.FLOWER;
    }
  });

  return { ground, objects };
}

const { ground, objects } = buildMap();

export const MAP = {
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  tileSize: TILE_SIZE,
  ground,
  objects,
  // Player start position, in tile coordinates (on the crossroads).
  spawn: { tileX: 9, tileY: 16 },
  // Pixel dimensions, handy for camera bounds.
  pixelWidth: MAP_WIDTH * TILE_SIZE,
  pixelHeight: MAP_HEIGHT * TILE_SIZE,
};
