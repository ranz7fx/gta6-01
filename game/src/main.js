// main.js — Solmar Heat bootstrap: renderer, game loop, chase camera,
// day/night cycle, entering and exiting cars, menu and game-over flow.
import * as THREE from 'three';
import { TUNE, MISSION_DEFS, PLACES } from './config.js';
import { createState, loadSave, writeSave, clamp, lerp } from './state.js';
import { buildCity } from './city.js';
import { makeVehicle, driveCar, updateTraffic, spawnTraffic } from './vehicles.js';
import { makePlayer, spawnPeds, updatePlayerOnFoot, updatePeds, nearestCar } from './characters.js';
import { updatePolice, addHeat, trySpray, endRun } from './police.js';
import { startMission, updateMissions, spawnPickups, updatePickups, currentMission } from './missions.js';
import { initHud, updateHud, showWasted, fillMenu } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { applyShot } from './shots.js';

const state = createState();
const canvas = document.getElementById('game');
const audio = createAudio();
const input = createInput(canvas);
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

// --- renderer / scene ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffc98a, 220, 780);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);
state.scene = scene; state.camera = camera; state.renderer = renderer;
// debug / playtest hook (harmless in production): window.__game exposes state
window.__game = state;
// headlights: one spotlight that rides the player's car at night
const headlight = new THREE.SpotLight(0xffe9b0, 0, 55, 0.55, 0.5, 1.2);
scene.add(headlight); scene.add(headlight.target);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- events: the one place where gameplay talks to HUD + audio ---
state.onEvent = (kind, d = {}) => {
  const show = state.showToast;
  switch (kind) {
    case 'crime': {
      addHeat(state, d.amount ?? 1, d.kind);
      if (d.kind === 'hit-ped') show('Pedestrian down — the PD noticed that.');
      break;
    }
    case 'wanted':
      if (d.level > 0) {
        show(d.level >= 3 ? `WANTED LEVEL ${d.level} — Solmar PD is on you!` : `Wanted level ${d.level} — lay low.`);
        audio.siren.start();
      } else { show('You lost the heat. Breathe, Rio.'); audio.siren.stop(); }
      break;
    case 'crash': audio.noise(0.22, 0.22); break;
    case 'bump': audio.blip(140, 0.08, 'square', 0.1); break;
    case 'punch': audio.noise(0.08, 0.12); break;
    case 'rammed': audio.noise(0.12, 0.14); break;
    case 'pickup': show(`+$${d.value} found on the street.`); audio.chime([880, 1174]); break;
    case 'spray': show(`Pay 'n Spray: repaired and clean — $${d.cost}.`); audio.chime([523, 659, 784]); break;
    case 'mission-start': show(`${d.mission.title} — ${d.mission.intro}`, 4200); state.announce(d.mission.intro); break;
    case 'step-done': audio.chime([659, 880]); break;
    case 'mission-done': show(`${d.mission.title} complete — $${d.reward} in the pocket.`, 3600); audio.chime([523, 659, 784, 1046]); break;
    case 'campaign-done': show('All five jobs done. Legend of Solmar!', 5000); break;
    case 'toast': show(d.text); break;
    case 'over': {
      audio.siren.stop();
      showWasted(state, d.kind, d.fine);
      state.announce(d.kind === 'busted' ? 'Busted by the police.' : 'Wasted.');
      writeSave(state);
      break;
    }
  }
};

// --- world ---
buildCity(state);
makePlayer(state, PLACES.rosaGarage.x + 6, PLACES.rosaGarage.z + 8);
spawnTraffic(state);
spawnPeds(state);
spawnPickups(state);
initHud(state);
const save = loadSave();
if (save) {
  state.cash = save.cash;
  state.missionIndex = Math.min(save.missionIndex, MISSION_DEFS.length);
  state.stats.missionsDone = save.missionsDone ?? 0;
}
fillMenu(state, save);

// --- menu buttons ---
const startGame = (roam) => {
  audio.ensure();
  state.started = true;
  state.freeRoam = roam;
  state.hud.menu.style.display = 'none';
  if (!roam && state.missionIndex < MISSION_DEFS.length) startMission(state, state.missionIndex);
  else state.showToast(roam ? 'Free roam — Solmar is yours.' : 'All jobs done. Free roam it is.');
};
document.getElementById('play-btn').addEventListener('click', () => startGame(false));
document.getElementById('roam-btn').addEventListener('click', () => startGame(true));
document.getElementById('wasted-btn').addEventListener('click', () => respawn());

function respawn() {
  state.over = false; state.wasted = false;
  state.health = 100; state.wanted = 0; state.wantedHeat = 0; state.bustedTimer = 0;
  state.hud.wasted.style.display = 'none';
  // leave the car where it died; Rio walks out at the garage
  if (state.car) { state.car.isPlayerCar = false; state.car = null; }
  state.inCar = false;
  state.player.x = PLACES.rosaGarage.x + 6; state.player.z = PLACES.rosaGarage.z + 8;
  state.player.heading = 0;
  writeSave(state);
}

// --- entering / exiting cars ---
function tryEnterCar() {
  if (state.inCar) {
    // exit: step out to the side of the car
    const c = state.car;
    state.player.x = c.x + Math.cos(c.heading) * 3;
    state.player.z = c.z - Math.sin(c.heading) * 3;
    state.player.heading = c.heading;
    c.isPlayerCar = false;
    state.car = null; state.inCar = false;
    return;
  }
  const car = nearestCar(state);
  if (!car) return;
  if (car.parked) {
    car.parked = false;
    state.stats.carsStolen++;
    addHeat(state, 1, 'grand theft auto');
    state.showToast(car.name ? `You took the ${car.name}. The owner will notice.` : 'Car jacked. Drive like you mean it.');
    audio.chime([392, 523]);
  }
  car.isPlayerCar = true;
  state.car = car; state.inCar = true;
  state.player.x = car.x; state.player.z = car.z;
}

// --- day / night ---
function updateSky(dt) {
  state.hour = (state.hour + (dt / TUNE.dayLengthSec) * 24) % 24;
  const h = state.hour;
  // sun elevation: noon high, 6h/18h horizon, night below
  const ang = ((h - 6) / 12) * Math.PI;
  const elev = Math.sin(ang);
  const sunDir = new THREE.Vector3(Math.cos(ang) * 0.55, Math.max(elev, -0.25), 0.6).normalize();
  const day = clamp(elev * 1.6 + 0.25, 0, 1);
  const dusk = clamp(1 - Math.abs(elev) * 3.2, 0, 1) * (h > 12 ? 1 : 0.4);
  const night = 1 - day;
  state.sun.position.copy(sunDir).multiplyScalar(320);
  state.sun.position.y = Math.max(state.sun.position.y, -40);
  state.sun.intensity = 0.25 + day * 2.1;
  state.sun.color.setHSL(0.09 + dusk * 0.02, 0.85, 0.55 + day * 0.12);
  state.hemi.intensity = 0.35 + day * 0.8;
  if (state.moon) state.moon.intensity = night * 0.75;
  state.night01 = night;
  const top = new THREE.Color().setHSL(0.54, 0.45, 0.62 - night * 0.45);
  const mid = new THREE.Color().setHSL(0.08 + dusk * 0.01, 0.75, 0.62 - night * 0.4);
  const bot = new THREE.Color().setHSL(0.06, 0.9, 0.58 - night * 0.42);
  state.skyMat.uniforms.top.value.copy(top);
  state.skyMat.uniforms.mid.value.copy(mid);
  state.skyMat.uniforms.bot.value.copy(bot);
  state.skyMat.uniforms.sunDir.value.copy(sunDir);
  state.skyMat.uniforms.sunCol.value.setHSL(0.11, 0.9, 0.75 - night * 0.35);
  scene.fog.color.copy(mid).lerp(new THREE.Color(0x141c2e), night * 0.7);
  // windows + lamps + neon wake up at night
  for (const m of state.city.windowMats) m.emissiveIntensity = night * 0.9 + dusk * 0.25;
  for (const m of state.city.lampMats) m.color.setHex(night > 0.5 ? 0xffe9a8 : 0x8a7a5a);
  for (const m of state.city.neonMats) m.opacity = 0.35 + night * 0.65;
  // traffic lights cycle
  for (const l of state.city.lights) {
    const phase = (state.time * 0.08 + l.phase) % 1;
    l.lamps.forEach((lamp, i) => {
      const on = (phase < 0.45 && i === 2) || (phase >= 0.45 && phase < 0.55 && i === 1) || (phase >= 0.55 && i === 0);
      lamp.material.color.setHex(on ? [0xff3b30, 0xffcc00, 0x34c759][i] : 0x222222);
    });
  }
  // sea shimmer
  if (state.seaMesh) state.seaMesh.position.y = -0.4 + Math.sin(state.time * 0.5) * 0.12;
}

// --- camera: chase cam behind the car / over-the-shoulder on foot ---
function updateCamera(dt) {
  const mouse = input.consumeMouse();
  state.cameraYaw -= mouse.dx * 0.0032;
  state.cameraPitch = clamp(state.cameraPitch + mouse.dy * 0.0022, 0.08, 1.1);
  // follow the car's heading when driving, free orbit on foot (unless locked, e.g. aerial shot)
  if (state.inCar && state.car && !state.lockCam) {
    const targetYaw = state.car.heading + Math.PI;
    let d = (targetYaw - state.cameraYaw) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    state.cameraYaw += d * clamp(1.6 * dt, 0, 1);
  }
  const tx = state.inCar && state.car ? state.car.x : state.player.x;
  const tz = state.inCar && state.car ? state.car.z : state.player.z;
  const dist = state.cameraDist;
  const cx = tx + Math.sin(state.cameraYaw) * Math.cos(state.cameraPitch) * dist;
  const cz = tz + Math.cos(state.cameraYaw) * Math.cos(state.cameraPitch) * dist;
  const cy = 2.2 + Math.sin(state.cameraPitch) * dist;
  camera.position.set(cx, cy, cz);
  camera.lookAt(tx, 2.4, tz);
  // keep the camera out of buildings (cheap: clamp height above roofs nearby;
  // locked shots — aerials — frame from above on purpose and skip the clamp)
  if (!state.lockCam) {
    const roof = state.city.buildings.reduce((m, b) => {
      const inside = Math.abs(cx - b.x) < b.hw + 2 && Math.abs(cz - b.z) < b.hd + 2;
      return inside ? Math.max(m, b.h + 2) : m;
    }, 0);
    if (camera.position.y < roof) camera.position.y = roof;
  }
}

// --- main loop ---
let last = performance.now();
let saveTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!state.started) { renderer.render(scene, camera); return; }
  if (state.paused) { renderer.render(scene, camera); return; }
  state.time += dt;
  input.poll(state);
  const edges = input.consumeEdges();
  if (edges.pause && !state.over) {
    state.paused = !state.paused;
    state.showToast(state.paused ? 'Paused — press P to resume.' : 'Back on the streets.');
  }
  if (state.over) { updateHud(state); renderer.render(scene, camera); return; }
  if (edges.enterCar) tryEnterCar();
  if (edges.mission && !state.missionActive && state.missionIndex < MISSION_DEFS.length) {
    startMission(state, state.missionIndex);
  }
  if (edges.spray) trySpray(state);

  if (state.inCar && state.car) {
    driveCar(state, state.car, input, dt);
    state.stats.topSpeed = Math.max(state.stats.topSpeed, Math.abs(state.car.speed));
    audio.engineSpeed(Math.abs(state.car.speed) / TUNE.carMaxSpeed, true);
  } else {
    updatePlayerOnFoot(state, input, dt);
    audio.engineSpeed(0, false);
  }
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateMissions(state, dt);
  updatePickups(state, dt);
  updateSky(dt);
  updateCamera(dt);
  // headlights follow the player's car
  if (state.inCar && state.car) {
    const h = state.car.heading;
    headlight.position.set(state.car.x + Math.sin(h) * 2.4, 1.3, state.car.z + Math.cos(h) * 2.4);
    headlight.target.position.set(state.car.x + Math.sin(h) * 24, 0.4, state.car.z + Math.cos(h) * 24);
    headlight.intensity = 30 + (state.night01 ?? 0) * 260;
  } else headlight.intensity = 0;
  state.nearestCar = state.inCar ? null : nearestCar(state);
  updateHud(state);
  saveTimer += dt;
  if (saveTimer > 10) { saveTimer = 0; writeSave(state); }
  renderer.render(scene, camera);
}

// menu camera: slow orbit over the city before the player starts
(function menuOrbit() {
  if (state.started) return;
  camera.position.set(Math.sin(state.time * 0.02) * 190, 90, Math.cos(state.time * 0.02) * 190 + 40);
  camera.lookAt(0, 0, 40);
  requestAnimationFrame(menuOrbit);
})();

// shot mode: stage the scene and start the sim immediately
if (shotName) {
  applyShot(state, shotName);
} else {
  // idle menu orbit needs a ticking clock
  const tick = () => { if (!state.started) { state.time += 0.016; updateSky(0.016); } requestAnimationFrame(tick); };
  tick();
}
requestAnimationFrame(frame);
