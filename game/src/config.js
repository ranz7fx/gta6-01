// config.js — every tuned number and the dealt palette for Solmar Heat.
// Palette: golden-hour amber + teal sea + coral. Warm, sun-soaked, never violet.
export const PALETTE = {
  skyDay: 0x8ecfe0, skyDusk: 0xffb347, skyNight: 0x141c2e, skySunset: 0xff9e57,
  sea: 0x0f8b8d, seaDeep: 0x0a5e63, sand: 0xe8c98f, sandWet: 0xd9b47c,
  asphalt: 0x453d33, asphaltLine: 0xf5d76e, sidewalk: 0xa89a80, curb: 0x6e6455,
  building: [0xf2e3c6, 0xf2b28c, 0xa8d5ba, 0xf5d76e, 0xe87a5d, 0xc96f4a, 0x7fb8a4, 0xefc9a0, 0xd98c5f, 0xfff3d6],
  neon: [0xff6b35, 0xffc53d, 0x2ec4b6, 0xff5d8f],
  carPaint: [0xff6b35, 0xf5d76e, 0x2ec4b6, 0xe8e3d8, 0x37474f, 0xc0392b, 0x7fb8a4, 0xff8fa3, 0x4a6fa5, 0xf2b28c],
  palmTrunk: 0x8a6b48, palmLeaf: 0x3f9d4e, palmLeaf2: 0x57b368,
  policeWhite: 0xf2f0ea, policeBlack: 0x1d1a16,
  amber: 0xffb347, coral: 0xff6b35, gold: 0xf5a623, teal: 0x0f8b8d,
};

// City layout: a grid of blocks separated by roads, beach + sea on the south edge.
export const CITY = {
  blocksX: 7, blocksZ: 7, block: 46, road: 14,
  get pitch() { return this.block + this.road; },
  get half() { return (this.blocksX * this.pitch) / 2; },
  // Street centre lines: 8 streets across the grid (one between each pair of blocks + edges).
  streetLines() {
    const out = [];
    const start = -this.half + this.road / 2;
    for (let i = 0; i <= this.blocksX; i++) out.push(start + i * this.pitch);
    return out;
  },
  // Block centres (for buildings / props).
  blockCentres() {
    const out = [];
    const start = -this.half + this.road + this.block / 2;
    for (let i = 0; i < this.blocksX; i++)
      for (let j = 0; j < this.blocksZ; j++)
        out.push({ x: start + i * this.pitch, z: start + j * this.pitch, i, j });
    return out;
  },
};

// Named places, in world coordinates (x east, z south; beach is +z).
export const PLACES = {
  rosaGarage: { x: -96, z: -96, name: "Mama Rosa's Garage" },
  pier: { x: 30, z: 228, name: 'Solmar Pier' },
  beach: { x: -60, z: 226, name: 'Solmar Beach' },
  downtown: { x: 0, z: 0, name: 'Downtown Solmar' },
  bank: { x: 96, z: -36, name: 'Solmar Trust Bank' },
  spray: { x: -36, z: 96, name: "Pay 'n Spray" },
  airport: { x: 150, z: -150, name: 'Solmar Airfield' },
  marina: { x: -150, z: 150, name: 'Solmar Marina' },
  stadium: { x: 150, z: 96, name: 'Solmar Bowl' },
  market: { x: -150, z: -36, name: 'Mercado Viejo' },
};

export const TUNE = {
  walkSpeed: 7, runSpeed: 11,
  carAccel: 26, carBrake: 42, carReverse: 14, carMaxSpeed: 52, carMaxReverse: 16,
  carSteer: 0.62, carGrip: 6.5, driftGrip: 2.2,
  trafficCount: 16, pedCount: 26, maxPolice: 6,
  wantedDecaySec: 22, bustedDist: 3.2, bustedTime: 2.2,
  dayLengthSec: 420, startHour: 17.5,
  cashStart: 250, sprayCost: 200, sprayRepair: 100,
};

export const MISSION_DEFS = [
  { id: 1, title: 'JOB 1 · FIRST FARE', name: 'First Fare', reward: 300,
    intro: "Mama Rosa needs a driver. Pick up her cousin at the Mercado and get him to the garage — in one piece.",
    steps: [
      { type: 'goto', place: 'market', text: 'Drive to Mercado Viejo and pick up Tito' },
      { type: 'deliver', place: 'rosaGarage', text: 'Drop Tito at Mama Rosa\u2019s Garage' },
    ] },
  { id: 2, title: 'JOB 2 · HOT WHEELS', name: 'Hot Wheels', reward: 600,
    intro: 'A Coral Comet is parked by the marina. Take it. The owner won\u2019t miss it until morning — probably.',
    steps: [
      { type: 'steal', place: 'marina', text: 'Steal the Coral Comet at the marina' },
      { type: 'deliver', place: 'rosaGarage', text: 'Deliver the Comet to the garage' },
    ] },
  { id: 3, title: 'JOB 3 · GETAWAY', name: 'Getaway', reward: 900,
    intro: 'The crew hit the bank and the whole Solmar PD is awake. Lose the heat, then bring the car home.',
    steps: [
      { type: 'escape', place: 'downtown', text: 'Lose the cops — drop your wanted level to zero' },
      { type: 'deliver', place: 'rosaGarage', text: 'Bring the getaway car back to the garage' },
    ] },
  { id: 4, title: 'JOB 4 · NIGHT RUN', name: 'Night Run', reward: 1200,
    intro: 'After dark the city changes hands. Run a package from the airfield to the pier. No lights, no stops.',
    steps: [
      { type: 'goto', place: 'airport', text: 'Pick up the package at Solmar Airfield' },
      { type: 'deliver', place: 'pier', text: 'Deliver the package to Solmar Pier' },
    ] },
  { id: 5, title: 'JOB 5 · THE BIG SCORE', name: 'The Big Score', reward: 2500,
    intro: 'One last job. Pick up the crew, hit Solmar Trust, and vanish into the night. Make it count, Rio.',
    steps: [
      { type: 'goto', place: 'stadium', text: 'Pick up the crew at Solmar Bowl' },
      { type: 'goto', place: 'bank', text: 'Reach Solmar Trust Bank' },
      { type: 'escape', place: 'beach', text: 'Escape the heat and reach the beach' },
    ] },
];
