// The colour system. Cinematic anime-cel 2D (bold clean ink outlines, flat cel fills with 1–2
// hard-edged shadow tones + soft gradient light and a coloured rim light) for HIM and his world
// (kitchen, desk, bathroom mirror, hot street, living room, bedroom); glossy translucent MEDICAL
// illustration for every body / organ / cell shot (x-ray glass body on navy, glossy micro).
//
// RESERVED meanings for THIS reel — each colour family means ONE thing only, never mixed up:
//   clear bright aqua-blue (glossy, glowing)  = WATER (drops, molecules, the water inside him)  C.water*
//   white-silver crystal cubes / dots         = SALT (sodium) — makes the blood "saltier"      C.salt*
//   bright red                                = BLOOD (vessels, red cells)                     C.blood*
//   soft coral-peach, lilac nucleus           = his BODY CELLS (plump = hydrated; shrivelled,
//                                               wrinkled, darker = dehydrated)                 C.cell*
//   violet-magenta glowing capsules           = the hormone ADH ("save water" message)         C.adh*
//   electric yellow ring / pulse              = the brain's THIRST ALARM + nerve signals       C.alarm*
//   straw → amber → brown                     = URINE colour (pale = hydrated, dark = not)     C.urine0..4
//   murky olive-green spiky blobs             = TOXINS / waste the kidneys can no longer remove C.toxin*
//   orange-red heat glow / shimmer            = HEAT / overheating                             C.heat*
//   cool pale x-ray blue glass                = the translucent body ("x-ray glass") outline   C.bodyGhost*
//   bright mint-teal                          = RECOVERY / refill / healthy again (S19–S20)    C.treat*
// No gore, no horror. His decline is shown gently (tired, dry, pale, then asleep as the light fades).

export const C = {
  // ---- HIM (ONE consistent design — see docs/BUILD.md "Character lock") ----
  skin: '#e2b48c', // warm tan
  skinShade: '#c28a64',
  skinDeep: '#9c6446',
  skinLight: '#f2cfac',
  skinPale: '#cdb4a0', // ill (path 2): greyer, paler — mix toward this by `health`
  blush: '#d98a76',
  lip: '#b8705e',
  lipPale: '#a8847a',
  hair: '#16161c', // messy black hair
  hairShade: '#0a0a0f',
  hairLight: '#3c4258', // cool blue-grey rim
  brow: '#16161c',
  iris: '#4a3020', // dark brown
  irisLight: '#7a5038',
  pupil: '#0b0a0c',
  sclera: '#f7f4ef',
  eyeShine: '#ffffff',
  underEye: '#8a6a70', // dark circles when tired/ill
  hoodie: '#2b2e38', // charcoal hoodie / zip jacket
  hoodieShade: '#1a1c24',
  hoodieLight: '#4a5064', // cool rim
  tee: '#cbc7be', // light warm-grey t-shirt
  teeShade: '#a29d92',
  teeLight: '#e6e3dc',
  patientTee: '#7f9fcc', // path 2: light blue t-shirt in the hospital bed
  patientTeeShade: '#5f7cab',
  patientTeeLight: '#a8c2e6',
  jeans: '#2e3a52',
  jeansShade: '#1f2738',
  jeansLight: '#4a5a7a',
  backpack: '#1b1c22',
  backpackShade: '#0e0f13',
  backpackLight: '#3a3d4a',
  shoe: '#e8e6e0', // white sneakers
  shoeShade: '#b9b5ac',
  sole: '#f6f5f1',

  // ---- his world ----
  skyTop: '#3f7fd0', // park day sky
  sky: '#7fb8ec',
  skyLow: '#d4ebf8',
  cloud: '#fbfcfe',
  cloudShade: '#c8d6e8',
  sun: '#fff8e6',
  sunGlow: '#ffe6a8',
  leaf: '#6fae4a',
  leafLight: '#a6d46a',
  leafDeep: '#3c7a34',
  leafDark: '#244d26',
  trunk: '#5a4232',
  grass: '#7cb850',
  grassDeep: '#4c8a3a',
  path: '#d8cbb0',
  building: '#8fa6c4', // city glass towers (blue-grey)
  buildingLight: '#c8d8ea',
  buildingShade: '#5f7494',
  window: '#dce9f6',
  // night bedroom (S14)
  roomNight: '#141a2e',
  roomNightLight: '#26304e',
  lamp: '#ffcf7a', // warm desk-lamp light
  lampGlow: '#ffb84d',
  screenGlow: '#9fd0ff', // laptop/phone glow
  desk: '#5a4636',
  deskShade: '#3a2c22',
  // hospital
  wardWall: '#dfe8ec',
  wardWallShade: '#b4c4cc',
  wardFloor: '#c8d2d6',
  wardTeal: '#3fa6a8', // hospital accent (curtains, scrubs)
  wardTealDeep: '#23787c',
  scrubs: '#4fb0b8',
  scrubsShade: '#2e8088',
  coat: '#f4f6f8', // doctor's white coat
  coatShade: '#c8d0d8',
  sheet: '#eef1f4', // bed linen
  sheetShade: '#c2ccd6',
  pillow: '#f7f8fa',
  steel: '#b8c0c8',
  steelDark: '#6f7880',
  machine: '#e9edf0', // CT scanner housing
  machineShade: '#a8b2bc',
  monitor: '#0d1a2a',
  monitorGlow: '#5fd0ff',
  ivFluid: '#cfe8f4',
  cannula: '#e4f4f8', // clear oxygen tube
  // sunset (S25) + evening
  duskTop: '#2e3a78',
  duskMid: '#c86a7a',
  duskLow: '#ffb070',
  duskSun: '#fff0c0',
  cityDusk: '#3a3050',
  cityDuskLight: '#6a5070',

  // ---- reserved science colours ----
  cell: '#f2a69a', // HEALTHY cell (coral-peach)
  cellLight: '#ffd4c8',
  cellDeep: '#c46c66',
  cellNucleus: '#9a7ac4', // calm lilac nucleus
  cellNucleusLight: '#c8b0e8',
  cancer: '#e02e6a', // CANCER cell (hot magenta-crimson)
  cancerLight: '#ff7aa6',
  cancerDeep: '#8e0f42',
  cancerDark: '#5a0a2c',
  cancerNucleus: '#46124e', // big dark violet nucleus
  cancerCore: '#ff3b78', // glowing core inside the nucleus
  immune: '#5a78ff', // T cell (blue-violet)
  immuneLight: '#aabcff',
  immuneDeep: '#2a36a8',
  dna: '#3aa8ff',
  dnaLight: '#aee2ff',
  dnaDeep: '#1656b0',
  dnaRung: '#7fd0ff',
  mutation: '#ff5a1f', // the MUTATION (red-orange glowing break)
  mutationLight: '#ffd2a0',
  mutationDeep: '#b8280a',
  blood: '#d8283c',
  bloodLight: '#ff6a74',
  bloodDeep: '#8e1426',
  bloodPoor: '#7a2f5e', // veins / spent red cells (plum)
  bloodPoorLight: '#a3578a',
  bloodPoorDeep: '#4e1a3c',
  vessel: '#c42a3a', // vessel wall
  vesselLight: '#f07a80',
  vesselDeep: '#7a1020',
  lymph: '#e4e08a',
  lymphLight: '#f8f6c8',
  lymphDeep: '#a8a046',
  o2: '#3fd8ff', // OXYGEN
  o2Light: '#a8f0ff',
  o2Deep: '#1e9ccc',
  nutrient: '#ffbe3a', // NUTRIENTS (glucose)
  nutrientLight: '#ffe4a0',
  nutrientDeep: '#c27c10',
  signal: '#c8f560', // CANCER's chemical signals (acid lime)
  signalLight: '#eaffb0',
  signalDeep: '#7aa818',
  control: '#e6fbff', // BODY's control signals (STOP / self-destruct)
  controlDeep: '#7fc8dc',
  treat: '#3ff0b0', // TREATMENT / healing / remission (mint-teal)
  treatLight: '#b8ffe6',
  treatDeep: '#119a70',
  pain: '#ff6a3d', // PAIN / symptoms
  painLight: '#ffb08a',
  painDeep: '#c2361a',

  // ---- tissue + anatomy (glossy translucent medical illustration) ----
  tissue: '#e8907e', // salmon tissue
  tissueLight: '#ffc0ae',
  tissueDeep: '#b0584c',
  tissueDark: '#6e2c2a',
  fibre: '#f6c8b0', // extracellular fibres
  membrane: '#f8e6c8', // the tissue's border (basement membrane) the tumour breaks through
  fluid: '#f4c8c0',
  bodyGhost: '#7fb8ff', // translucent body silhouette (x-ray blue)
  bodyGhostLight: '#c4e0ff',
  lung: '#f08aa0',
  lungLight: '#ffc2cf',
  lungDeep: '#c2526e',
  airway: '#f6d4dc',
  alveolus: '#f49aae',
  liver: '#b0403a',
  liverLight: '#e07a6a',
  liverDeep: '#6e1e1e',
  heart: '#d6324a',
  heartLight: '#ff7486',
  bone: '#f3ead6',
  boneShade: '#cbbd9c',
  brain: '#f2a6b8',
  brainLight: '#ffd2dc',
  kidney: '#b85046',
  gut: '#e8a088',
  node: '#d8d070', // lymph node (lymph family)
  heartDeep: '#8e1428',
  brainDeep: '#c46a86',
  capillary: '#d8364c',
  muscle: '#d0505e',
  muscleLight: '#f08a92',
  neuronLight: '#e0ccff',
  neuronDeep: '#6a48c0',
  atpLight: '#fff1a8',
  injury: '#ff2e63', // legacy (inherited BodyPlate code) — don't use for new art
  injuryLight: '#ff8aa8',
  medBg: '#0b1530', // dark navy ground for medical shots
  medBgLight: '#16295a',
  medGrid: '#2a4a8a',

  // ---- type, ink, HUD ----
  ink: '#10121a',
  inkSoft: '#2c3040',
  cream: '#f5f1e6',
  paper: '#efe4c8',
  label: '#f5f1e6',
  hud: '#e8f4ff',
  hudDim: '#8fb0d0',
  hudAccent: '#ff7aa6', // cancer-cell counter accent
  hudGood: '#3ff0b0',
  hudWarn: '#ff8a1f',
  hudBad: '#ff3b5c',
  navy: '#141a33',
  navyDeep: '#0c1022',
  titlePink: '#ff4f86', // "CANCER?" in the title (storyboard)
  pathGood: '#2fbf5a', // PATH 1 / remission banner green (storyboard)
  pathBad: '#e02a2a', // PATH 2 / progresses banner red
  // ---- THIS reel: water + dehydration science ----
  water: '#3cc8ff', // WATER — clear bright aqua-blue
  waterLight: '#b4ecff',
  waterDeep: '#1478c8',
  waterDark: '#0a3f7a',
  waterGlow: '#7fe0ff',
  salt: '#eef3f8', // SALT (sodium) — white-silver crystals
  saltShade: '#a9b6c6',
  saltDeep: '#6c7a8e',
  adh: '#c04cf0', // ADH hormone — violet-magenta capsules
  adhLight: '#eab0ff',
  adhDeep: '#7a1ea8',
  alarm: '#ffe23a', // thirst ALARM / nerve signals — electric yellow
  alarmLight: '#fff6b0',
  alarmDeep: '#d89a00',
  urine0: '#f6f2c0', // pale straw (hydrated)
  urine1: '#f2e27a',
  urine2: '#e8c040', // yellow-amber
  urine3: '#c88a1c', // dark amber
  urine4: '#8a5214', // brown (severe)
  toxin: '#8a9a3a', // TOXINS / wastes — murky olive-green
  toxinLight: '#c2cf72',
  toxinDeep: '#4e5a1a',
  heat: '#ff6a2a', // HEAT — orange-red glow
  heatLight: '#ffc07a',
  heatDeep: '#c2300e',
  // dehydrated look (Hero `dry`)
  skinDry: '#c9a48a', // dull, slightly grey-tan, less glow
  lipDry: '#b88f84',
  lipCrack: '#7a4e48',
  eyeSunk: '#6e5560', // sunken eye sockets
  // his apartment + world (this reel)
  kitchenWall: '#f3e6cf', // warm cream morning kitchen
  kitchenWallShade: '#d9c4a2',
  tile: '#e8f0f2', // white-mint backsplash tiles
  tileShade: '#bccdd2',
  counter: '#c8b8a0', // stone counter
  counterShade: '#9a8a74',
  wood: '#a8754a', // cabinets / shelves / desk wood
  woodShade: '#7a5234',
  woodLight: '#d0a070',
  chrome: '#d8e0e8', // tap, sink
  chromeShade: '#8a96a4',
  plant: '#5aa04a',
  plantDeep: '#2f6a32',
  morning: '#fff1cc', // morning window light
  morningGlow: '#ffd98a',
  bathTile: '#d8e8ee', // bathroom (S10)
  bathTileShade: '#a6bec8',
  mirrorGlass: '#bcd4de',
  bathLight: '#f4fbff',
  asphalt: '#5a5660', // hot street (S11)
  asphaltLight: '#8a8590',
  concrete: '#d8cfc0',
  concreteShade: '#b0a492',
  hotSky: '#9fd0f0',
  hotSkyLow: '#f4f0d8',
  hotSun: '#fffbe8',
  awning: '#e0583a',
  sofa: '#5f7a8a', // living room (S12)
  sofaShade: '#3f5664',
  rug: '#c08a5a',
  bedSheet: '#e6e9ee', // bedroom (S16)
  bedSheetShade: '#aab4c4',
  duvet: '#7f97b8',
  duvetShade: '#566c90',
};

export type ColorKey = keyof typeof C;
