// ---------------------------------------------------------------------------
// City map data - a multi-district metropolis (MA.06.12.01 Part 1).
//
// Three connected districts on one larger map:
//   - DOWNTOWN core   (top): cafe, store, college, flip store, pawn shop
//   - COMMERCIAL strip (mid): realtor, barber, museum, premium store, dealership
//   - RESIDENTIAL area (bottom): the player's apartment, houses, city hall, park
//
// Two tile layers (ground walkable / objects collidable) plus a `buildings`
// list. Each building carries metadata so WorldScene knows whether it is
// FUNCTIONAL (has a working interior function now) or a FACADE (signposted,
// shows a coming-soon state if entered). Layout stays data-only.
// ---------------------------------------------------------------------------
import { TILES, TILE_SIZE } from '../config.js';

export const CITY_WIDTH = 80;
export const CITY_HEIGHT = 60;

function makeLayer(value) {
  const rows = [];
  for (let y = 0; y < CITY_HEIGHT; y++) rows.push(new Array(CITY_WIDTH).fill(value));
  return rows;
}
const inB = (x, y) => x >= 0 && x < CITY_WIDTH && y >= 0 && y < CITY_HEIGHT;
function set(layer, x, y, v) { if (inB(x, y)) layer[y][x] = v; }
function rect(layer, x0, y0, w, h, v) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(layer, x, y, v);
}

// A building lot: WALL block on the objects layer with a 1-tile door gap.
// `functional` => has a working function now; otherwise a signposted facade.
function building(ground, objects, def) {
  const { id, x, y, w, h, color, label, door, kind, functional } = def;
  rect(objects, x, y, w, h, TILES.WALL);
  const dx = x + Math.floor(w / 2);
  const dy = door === 'top' ? y : y + h - 1;
  set(objects, dx, dy, -1);
  set(ground, dx, dy, TILES.SIDEWALK);
  return {
    id, label, color,
    kind: kind || 'shop',
    functional: !!functional,
    rect: { x, y, w, h },
    door: { x: dx, y: door === 'top' ? dy - 1 : dy + 1 },
    center: { x: x + w / 2, y: y + h / 2 },
  };
}

function buildCity() {
  const ground = makeLayer(TILES.GRASS);
  const objects = makeLayer(-1);

  // --- Road grid: 3 horizontal avenues (district dividers) + 4 vertical ----
  const hRoads = [10, 30, 48];
  const vRoads = [14, 34, 52, 70];
  const paintRoads = () => {
    hRoads.forEach((ry) => rect(ground, 0, ry, CITY_WIDTH, 2, TILES.ROAD));
    vRoads.forEach((rx) => rect(ground, rx, 0, 2, CITY_HEIGHT, TILES.ROAD));
  };
  // Sidewalk bands first, then roads on top so intersections stay clean.
  hRoads.forEach((ry) => { rect(ground, 0, ry - 1, CITY_WIDTH, 1, TILES.SIDEWALK); rect(ground, 0, ry + 2, CITY_WIDTH, 1, TILES.SIDEWALK); });
  vRoads.forEach((rx) => { rect(ground, rx - 1, 0, 1, CITY_HEIGHT, TILES.SIDEWALK); rect(ground, rx + 2, 0, 1, CITY_HEIGHT, TILES.SIDEWALK); });
  paintRoads();

  // Crosswalks at a few key intersections.
  [[14, 9], [14, 12], [34, 29], [34, 32], [52, 47], [52, 50]].forEach(([x, y]) => rect(ground, x, y, 2, 1, TILES.CROSSWALK));

  // --- District plazas (paved gathering spots; busking happens here) -------
  rect(ground, 3, 13, 9, 14, TILES.PLAZA); // downtown plaza (top-left)
  rect(ground, 56, 13, 10, 12, TILES.PLAZA); // east plaza

  // --- Park (residential, bottom) with trees + pond ------------------------
  rect(ground, 56, 50, 20, 9, TILES.GRASS);
  const trees = [
    [58, 51], [61, 52], [64, 51], [67, 53], [70, 51], [73, 52], [60, 56], [66, 57], [72, 56], [69, 55],
    [16, 52], [19, 54], [22, 52], [13, 55],
  ];
  trees.forEach(([x, y]) => set(objects, x, y, TILES.TREE));
  rect(objects, 62, 54, 5, 3, TILES.WATER);

  // Decorative planters around plazas.
  [[3, 28], [11, 28], [56, 26], [65, 26]].forEach(([x, y]) => set(objects, x, y, TILES.PLANTER));

  // --- Buildings -----------------------------------------------------------
  // FUNCTIONAL: working interior function now.
  // FACADE: placed + signposted; "coming soon" if entered.
  const defs = [
    // Downtown core (top band)
    { id: 'cafe', label: 'CAFE', kind: 'cafe', color: 0xb5443a, x: 4, y: 3, w: 8, h: 5, door: 'bottom', functional: true },
    { id: 'shop', label: 'GENERAL STORE', kind: 'store', color: 0xc99a3a, x: 18, y: 3, w: 8, h: 5, door: 'bottom', functional: true },
    { id: 'flipstore', label: 'FLIP STORE', kind: 'flip', color: 0x3a8a8a, x: 38, y: 3, w: 8, h: 5, door: 'bottom', functional: true },
    { id: 'pawnshop', label: 'PAWN SHOP', kind: 'pawn', color: 0x8a6a3a, x: 56, y: 3, w: 8, h: 5, door: 'bottom', functional: true },
    { id: 'college', label: 'COMMUNITY COLLEGE', kind: 'college', color: 0x7a5aa0, x: 71, y: 3, w: 8, h: 6, door: 'bottom', functional: true },

    // Commercial strip (middle band)
    { id: 'realtor', label: 'REALTOR', kind: 'office', color: 0x3a8a6a, x: 4, y: 33, w: 7, h: 5, door: 'bottom', functional: true },
    { id: 'barber', label: 'BARBER', kind: 'shop', color: 0x4a6fa5, x: 16, y: 33, w: 6, h: 5, door: 'bottom', functional: false },
    { id: 'museum', label: 'MUSEUM', kind: 'civic', color: 0x9a8c5a, x: 37, y: 32, w: 11, h: 6, door: 'bottom', functional: false },
    { id: 'premium', label: 'PREMIUM ITEMS', kind: 'shop', color: 0xc06aa0, x: 56, y: 33, w: 8, h: 5, door: 'bottom', functional: false },
    { id: 'dealership', label: 'AUTO DEALER', kind: 'civic', color: 0x6a8aa0, x: 71, y: 33, w: 8, h: 5, door: 'bottom', functional: false },

    // Residential (bottom band)
    { id: 'apartment', label: 'YOUR APARTMENT', kind: 'home', color: 0x4a6fa5, x: 4, y: 51, w: 7, h: 6, door: 'top', functional: true },
    { id: 'house1', label: 'HOUSE', kind: 'home', color: 0x6a5a4a, x: 26, y: 51, w: 6, h: 6, door: 'top', functional: false },
    { id: 'house2', label: 'HOUSE', kind: 'home', color: 0x5a6a4a, x: 36, y: 51, w: 6, h: 6, door: 'top', functional: false },
    { id: 'cityhall', label: 'CITY HALL', kind: 'civic', color: 0x3a8a6a, x: 44, y: 50, w: 9, h: 7, door: 'top', functional: false },
  ];
  const buildings = defs.map((d) => building(ground, objects, d));

  return { ground, objects, buildings };
}

const { ground, objects, buildings } = buildCity();

// Search spots for the item economy (Part 3): believable looting locations,
// each with a weight class that biases the availability/quality roll.
export const SEARCH_SPOTS = [
  { id: 'dumpster_dt', label: 'Dumpster', x: 13, y: 7, weight: 'good' },
  { id: 'alley_dt', label: 'Alley', x: 33, y: 7, weight: 'normal' },
  { id: 'bench_plaza', label: 'Bench', x: 7, y: 25, weight: 'poor' },
  { id: 'dumpster_comm', label: 'Dumpster', x: 51, y: 31, weight: 'good' },
  { id: 'lostfound', label: 'Lost & Found', x: 35, y: 31, weight: 'rare' },
  { id: 'bin_east', label: 'Trash Bin', x: 66, y: 26, weight: 'normal' },
  { id: 'park_bush', label: 'Bushes', x: 70, y: 57, weight: 'poor' },
  { id: 'alley_res', label: 'Alley', x: 24, y: 49, weight: 'normal' },
];

export const CITY = {
  width: CITY_WIDTH,
  height: CITY_HEIGHT,
  tileSize: TILE_SIZE,
  ground,
  objects,
  buildings,
  searchSpots: SEARCH_SPOTS,
  // Spawn on the sidewalk just ABOVE the apartment's top door (door tile y=51,
  // standing tile y=50), not inside the wall block.
  spawn: { tileX: 7, tileY: 49 },
  pixelWidth: CITY_WIDTH * TILE_SIZE,
  pixelHeight: CITY_HEIGHT * TILE_SIZE,
};

export const BUILDING_BY_ID = Object.fromEntries(buildings.map((b) => [b.id, b]));
