// ---------------------------------------------------------------------------
// Findable items (MA.06.12.01 Part 3). 56 distinct items across value tiers.
//
// Each item has: id, name, tier (junk/ordinary/rare), base value, and icon
// params (shape, material, palette) the procedural icon generator reads. No
// external art: every icon is authored in code from these params.
//
// Tiers bias how often an item appears and its value band:
//   junk     - common, low value (frequent finds)
//   ordinary - moderate value
//   rare     - high value, seldom found
// ---------------------------------------------------------------------------

// Icon shapes the generator knows how to draw.
export const ICON_SHAPES = [
  'box', 'bottle', 'phone', 'ring', 'watch', 'disc', 'book', 'can',
  'cup', 'tool', 'shoe', 'ball', 'gem', 'card', 'key', 'bulb',
  'headphones', 'glasses', 'lamp', 'bag', 'pan', 'speaker', 'camera', 'board',
];

// Material affects the icon's base color ramp + sheen.
export const ICON_MATERIALS = {
  plastic: 0xb0b6c0, metal: 0xc8ccd4, gold: 0xe8c44a, silver: 0xd8dce4,
  glass: 0x9ad0e0, wood: 0x9a6b3a, fabric: 0xc06a7a, paper: 0xe8e0c8,
  gem: 0x6ad0c0, leather: 0x7a4a2a,
};

// The item table. Kept compact via a builder.
function it(id, name, tier, value, shape, material) {
  return { id, name, tier, value, shape, material };
}

export const ITEMS = [
  // --- JUNK (common, low value) -------------------------------------------
  it('soda_can', 'Crushed Soda Can', 'junk', 2, 'can', 'metal'),
  it('plastic_bottle', 'Plastic Bottle', 'junk', 1, 'bottle', 'plastic'),
  it('old_newspaper', 'Old Newspaper', 'junk', 1, 'book', 'paper'),
  it('broken_umbrella', 'Broken Umbrella', 'junk', 3, 'tool', 'metal'),
  it('single_glove', 'Single Glove', 'junk', 1, 'fabric', 'fabric'),
  it('cracked_mug', 'Cracked Mug', 'junk', 2, 'cup', 'plastic'),
  it('bent_fork', 'Bent Fork', 'junk', 2, 'tool', 'metal'),
  it('scuffed_ball', 'Scuffed Tennis Ball', 'junk', 2, 'ball', 'fabric'),
  it('used_battery', 'Used Battery', 'junk', 3, 'box', 'metal'),
  it('takeout_box', 'Takeout Box', 'junk', 1, 'box', 'paper'),
  it('chipped_plate', 'Chipped Plate', 'junk', 2, 'disc', 'plastic'),
  it('frayed_cable', 'Frayed Cable', 'junk', 3, 'tool', 'plastic'),
  it('worn_sock', 'Worn Sock', 'junk', 1, 'fabric', 'fabric'),
  it('empty_lighter', 'Empty Lighter', 'junk', 2, 'box', 'plastic'),
  it('rusty_nail', 'Rusty Nail', 'junk', 1, 'tool', 'metal'),
  it('broken_pen', 'Broken Pen', 'junk', 2, 'tool', 'plastic'),

  // --- ORDINARY (moderate value) ------------------------------------------
  it('paperback', 'Paperback Novel', 'ordinary', 8, 'book', 'paper'),
  it('coffee_mug', 'Ceramic Mug', 'ordinary', 9, 'cup', 'plastic'),
  it('umbrella', 'Working Umbrella', 'ordinary', 14, 'tool', 'fabric'),
  it('sneakers', 'Used Sneakers', 'ordinary', 22, 'shoe', 'fabric'),
  it('headphones', 'Headphones', 'ordinary', 28, 'headphones', 'plastic'),
  it('wristwatch', 'Quartz Watch', 'ordinary', 35, 'watch', 'metal'),
  it('phone_charger', 'Phone Charger', 'ordinary', 12, 'tool', 'plastic'),
  it('hardcover', 'Hardcover Book', 'ordinary', 18, 'book', 'paper'),
  it('thermos', 'Steel Thermos', 'ordinary', 20, 'bottle', 'metal'),
  it('skateboard', 'Skateboard', 'ordinary', 40, 'board', 'wood'),
  it('desk_lamp', 'Desk Lamp', 'ordinary', 24, 'lamp', 'metal'),
  it('backpack_old', 'Old Backpack', 'ordinary', 26, 'bag', 'fabric'),
  it('wallet', 'Leather Wallet', 'ordinary', 30, 'box', 'leather'),
  it('sunglasses', 'Sunglasses', 'ordinary', 32, 'glasses', 'plastic'),
  it('toolbox', 'Small Toolbox', 'ordinary', 38, 'box', 'metal'),
  it('frying_pan', 'Frying Pan', 'ordinary', 16, 'pan', 'metal'),
  it('board_game', 'Board Game', 'ordinary', 21, 'box', 'paper'),
  it('bluetooth_spkr', 'Bluetooth Speaker', 'ordinary', 33, 'speaker', 'plastic'),
  it('camera_compact', 'Compact Camera', 'ordinary', 45, 'camera', 'metal'),
  it('belt', 'Leather Belt', 'ordinary', 15, 'fabric', 'leather'),

  // --- RARE (high value, seldom) ------------------------------------------
  it('smartphone', 'Smartphone', 'rare', 120, 'phone', 'glass'),
  it('gold_ring', 'Gold Ring', 'rare', 160, 'ring', 'gold'),
  it('silver_chain', 'Silver Chain', 'rare', 95, 'ring', 'silver'),
  it('luxury_watch', 'Luxury Watch', 'rare', 240, 'watch', 'gold'),
  it('diamond_stud', 'Diamond Stud', 'rare', 200, 'gem', 'gem'),
  it('vintage_camera', 'Vintage Camera', 'rare', 150, 'camera', 'leather'),
  it('rare_vinyl', 'Rare Vinyl Record', 'rare', 85, 'disc', 'plastic'),
  it('graphics_card', 'Graphics Card', 'rare', 180, 'card', 'metal'),
  it('antique_coin', 'Antique Coin', 'rare', 110, 'disc', 'gold'),
  it('pearl_necklace', 'Pearl Necklace', 'rare', 175, 'ring', 'silver'),
  it('signed_book', 'Signed First Edition', 'rare', 130, 'book', 'leather'),
  it('emerald_gem', 'Loose Emerald', 'rare', 220, 'gem', 'gem'),
  it('drone', 'Camera Drone', 'rare', 165, 'speaker', 'plastic'),
  it('gold_watch', 'Pocket Watch', 'rare', 140, 'watch', 'gold'),
  it('tablet', 'Tablet', 'rare', 100, 'phone', 'glass'),
  it('designer_bag', 'Designer Handbag', 'rare', 190, 'bag', 'leather'),
  it('antique_key', 'Antique Key', 'rare', 75, 'key', 'gold'),
  it('art_print', 'Signed Art Print', 'rare', 90, 'book', 'paper'),
  it('gemstone_ring', 'Gemstone Ring', 'rare', 210, 'ring', 'gem'),
  it('collector_card', 'Holo Trading Card', 'rare', 115, 'card', 'paper'),
];

export const ITEMS_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// Condition multipliers (applied to base value on find).
export const CONDITIONS = [
  { id: 'broken', label: 'Broken', mult: 0.3 },
  { id: 'worn', label: 'Worn', mult: 0.6 },
  { id: 'used', label: 'Used', mult: 0.85 },
  { id: 'good', label: 'Good', mult: 1.0 },
  { id: 'mint', label: 'Mint', mult: 1.4 },
];

// Pools by tier for weighted finds.
export const ITEMS_BY_TIER = {
  junk: ITEMS.filter((i) => i.tier === 'junk'),
  ordinary: ITEMS.filter((i) => i.tier === 'ordinary'),
  rare: ITEMS.filter((i) => i.tier === 'rare'),
};
