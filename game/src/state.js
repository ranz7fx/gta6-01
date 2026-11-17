// state.js — the one shared game state every system reads and writes, plus the
// seeded random generator that makes the city identical on every load.
import { TUNE } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const angleLerp = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// The single mutable state object. main.js creates it; systems mutate its fields.
export function createState() {
  return {
    rng: mulberry32(20261117),
    time: 0,            // seconds since boot
    hour: TUNE.startHour, // time of day, 0..24
    paused: false, started: false, over: false,
    cash: TUNE.cashStart,
    health: 100,
    wanted: 0, wantedHeat: 0, wantedTimer: 0,
    bustedTimer: 0, wasted: false,
    missionIndex: 0,    // 0-based into MISSION_DEFS; 5 = all done
    missionStep: 0,
    missionActive: false,
    freeRoam: false,
    inCar: false,
    car: null,          // the car the player drives (a vehicle record)
    player: null,       // on-foot character record
    vehicles: [],       // traffic + parked + police (police flagged)
    police: [],
    peds: [],
    pickups: [],        // cash bundles on the street
    spray: null,        // Pay 'n Spray zone
    marker: null,       // current mission marker {x,z,label}
    stats: { carsStolen: 0, pedsHit: 0, missionsDone: 0, topSpeed: 0, busted: 0 },
    scene: null, camera: null, renderer: null,
    sun: null, hemi: null, skyMesh: null, seaMesh: null,
    city: null,         // { buildings:[{x,z,hw,hd,h}], colliders, lamps, signs }
    cameraYaw: 0, cameraPitch: 0.32, cameraDist: 11,
    autopilot: null,    // {throttle, steer} forced input for screenshots
    shotMode: null,
    onEvent: null,      // (kind, data) hook for hud/audio
  };
}

// Local save: cash + mission progress only. Never any credential.
const SAVE_KEY = 'solmar-heat-save-v1';
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.cash !== 'number' || typeof s.missionIndex !== 'number') return null;
    return s;
  } catch { return null; }
}
export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.round(state.cash), missionIndex: state.missionIndex,
      missionsDone: state.stats.missionsDone,
    }));
  } catch { /* storage unavailable: play on without saving */ }
}
