// ---------------------------------------------------------------------------
// City map data (the launch metropolis), authored with builder helpers.
//
// Two tile layers: `ground` (walkable base - grass/road/sidewalk/plaza) and
// `objects` (drawn on top; some collide - trees, water, building walls). On top
// of the tiles sits a list of named `buildings`: rectangular lots with a door
// tile and an accent color, which jobs/NPCs/interactions reference by id.
//
// WorldScene only consumes these arrays + the buildings list; layout is never
// hardcoded in scene logic. Swap this file (or export from Tiled later) to
// reshape the city without touching gameplay.
// ---------------------------------------------------------------------------
import { TILES, TILE_SIZE } from '../config.js';

export const CITY_WIDTH = 50; // tiles
export const CITY_HEIGHT = 38;

function makeLayer(value) {
  const rows = [];
  for (let y = 0; y < CITY_HEIGHT; y++) rows.push(new Array(CITY_WIDTH).fill(value));
  return rows;
}
const inB = (x, y) => x >= 0 && x < CITY_WIDTH && y >= 0 && y < CITY_HEIGHT;
function set(layer, x, y, v) {
  if (inB(x, y)) layer[y][x] = v;
}
function rect(layer, x0, y0, w, h, v) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(layer, x, y, v);
}

// A building: fill the lot with WALL on objects, lay PLAZA-ish floor under it,
// and punch a door (walkable) at the given side-center. Returns a descriptor.
function building(ground, objects, def) {
  const { id, x, y, w, h, color, label, door } = def;
  rect(objects, x, y, w, h, TILES.WALL);
  // Door: a 1-tile gap in the wall on the chosen edge, with sidewalk beneath.
  let dx = x + Math.floor(w / 2);
  let dy = y + h - 1; // default: bottom edge
  if (door === 'top') dy = y;
  set(objects, dx, dy, -1); // clear wall at door
  set(ground, dx, dy, TILES.SIDEWALK);
  return {
    id,
    label,
    color,
    rect: { x, y, w, h },
    // The tile a player stands on to interact (just outside the door).
    door: { x: dx, y: door === 'top' ? dy - 1 : dy + 1 },
    // Center of the lot, for placing labels.
    center: { x: x + w / 2, y: y + h / 2 },
  };
}

function buildCity() {
  const ground = makeLayer(TILES.GRASS);
  const objects = makeLayer(-1);

  // --- Road grid: two horizontal + two vertical avenues -------------------
  const hRoads = [8, 26];
  const vRoads = [12, 34];
  hRoads.forEach((ry) => rect(ground, 0, ry, CITY_WIDTH, 2, TILES.ROAD));
  vRoads.forEach((rx) => rect(ground, rx, 0, 2, CITY_HEIGHT, TILES.ROAD));

  // Sidewalks lining every road (drawn first as a band, roads repainted over).
  const sidewalkBand = (x0, y0, w, h) => rect(ground, x0, y0, w, h, TILES.SIDEWALK);
  hRoads.forEach((ry) => {
    sidewalkBand(0, ry - 1, CITY_WIDTH, 1);
    sidewalkBand(0, ry + 2, CITY_WIDTH, 1);
  });
  vRoads.forEach((rx) => {
    sidewalkBand(rx - 1, 0, 1, CITY_HEIGHT);
    sidewalkBand(rx + 2, 0, 1, CITY_HEIGHT);
  });
  // Repaint roads on top so intersections stay clean asphalt.
  hRoads.forEach((ry) => rect(ground, 0, ry, CITY_WIDTH, 2, TILES.ROAD));
  vRoads.forEach((rx) => rect(ground, rx, 0, 2, CITY_HEIGHT, TILES.ROAD));

  // Crosswalks at the central intersection.
  rect(ground, 12, 7, 2, 1, TILES.CROSSWALK);
  rect(ground, 12, 10, 2, 1, TILES.CROSSWALK);

  // --- Central plaza (top-left quadrant) ----------------------------------
  rect(ground, 3, 11, 7, 12, TILES.PLAZA);

  // --- Park with trees + pond (bottom-right quadrant) ---------------------
  rect(ground, 37, 28, 11, 8, TILES.GRASS);
  const trees = [
    [38, 29], [40, 28], [43, 30], [46, 29], [39, 33], [45, 34], [41, 32], [47, 31],
  ];
  trees.forEach(([x, y]) => set(objects, x, y, TILES.TREE));
  rect(objects, 42, 33, 4, 3, TILES.WATER); // small pond

  // A couple of decorative planters by the plaza (collide).
  [[3, 24], [9, 24]].forEach(([x, y]) => set(objects, x, y, TILES.PLANTER));

  // --- Buildings (named lots) ---------------------------------------------
  const buildings = [
    building(ground, objects, {
      id: 'apartment', label: "YOUR APARTMENT", color: 0x4a6fa5,
      x: 3, y: 2, w: 6, h: 5, door: 'bottom',
    }),
    building(ground, objects, {
      id: 'cafe', label: 'CAFE', color: 0xb5443a,
      x: 15, y: 2, w: 7, h: 5, door: 'bottom',
    }),
    building(ground, objects, {
      id: 'shop', label: 'GENERAL STORE', color: 0xc99a3a,
      x: 24, y: 2, w: 7, h: 5, door: 'bottom',
    }),
    building(ground, objects, {
      id: 'college', label: 'COMMUNITY COLLEGE', color: 0x7a5aa0,
      x: 37, y: 2, w: 9, h: 5, door: 'bottom',
    }),
    building(ground, objects, {
      id: 'cityhall', label: 'CITY HALL', color: 0x3a8a6a,
      x: 15, y: 29, w: 9, h: 6, door: 'top',
    }),
    building(ground, objects, {
      id: 'realtor', label: 'REALTOR', color: 0x3a8a8a,
      x: 4, y: 29, w: 6, h: 5, door: 'top',
    }),
  ];

  return { ground, objects, buildings };
}

const { ground, objects, buildings } = buildCity();

export const CITY = {
  width: CITY_WIDTH,
  height: CITY_HEIGHT,
  tileSize: TILE_SIZE,
  ground,
  objects,
  buildings,
  // Spawn on the plaza near the apartment.
  spawn: { tileX: 6, tileY: 12 },
  pixelWidth: CITY_WIDTH * TILE_SIZE,
  pixelHeight: CITY_HEIGHT * TILE_SIZE,
};

// Quick lookup: building id -> descriptor.
export const BUILDING_BY_ID = Object.fromEntries(buildings.map((b) => [b.id, b]));
