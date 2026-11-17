// missions.js — Mama Rosa's five-job chain, the 3D waypoint beacon, and the
// cash bundles scattered around Solmar as a free-roam activity.
import * as THREE from 'three';
import { MISSION_DEFS, PLACES, PALETTE } from './config.js';
import { dist2d } from './state.js';
import { addHeat } from './police.js';

let beacon = null;
let ring = null;

function ensureBeacon(state) {
  if (beacon) return;
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 30; g.add(beam);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: PALETTE.amber }));
  gem.position.y = 9; g.add(gem);
  ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.6, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25; g.add(ring);
  g.userData.gem = gem;
  state.scene.add(g);
  beacon = g;
}

export function currentMission(state) {
  if (state.missionIndex >= MISSION_DEFS.length) return null;
  return MISSION_DEFS[state.missionIndex];
}

export function currentStep(state) {
  const m = currentMission(state);
  if (!m) return null;
  return m.steps[state.missionStep] ?? null;
}

export function missionPlace(step) {
  return PLACES[step.place];
}

export function startMission(state, index = 0) {
  if (index >= MISSION_DEFS.length) return false;
  state.missionIndex = index;
  state.missionStep = 0;
  state.missionActive = true;
  ensureBeacon(state);
  const m = MISSION_DEFS[index];
  if (state.onEvent) state.onEvent('mission-start', { mission: m });
  // mission 3 and 5 start hot; mission 4 runs at night
  if (index === 2) { addHeat(state, 3, 'job'); }
  if (index === 3) { state.hour = 22.2; }
  if (index === 4) { state.hour = 21.4; addHeat(state, 1, 'job'); }
  updateMarker(state);
  return true;
}

export function updateMarker(state) {
  const step = currentStep(state);
  if (!step || !state.missionActive) {
    if (beacon) beacon.visible = false;
    state.marker = null;
    return;
  }
  ensureBeacon(state);
  const p = missionPlace(step);
  beacon.visible = true;
  beacon.position.set(p.x, 0, p.z);
  state.marker = { x: p.x, z: p.z, label: p.name, text: step.text, type: step.type };
}

function completeStep(state) {
  const m = currentMission(state);
  const step = currentStep(state);
  state.missionStep++;
  if (state.onEvent) state.onEvent('step-done', { mission: m, step });
  if (state.missionStep >= m.steps.length) {
    state.cash += m.reward;
    state.stats.missionsDone++;
    state.missionActive = false;
    state.missionIndex++;
    if (state.onEvent) state.onEvent('mission-done', { mission: m, reward: m.reward });
    updateMarker(state);
    if (state.missionIndex >= MISSION_DEFS.length && state.onEvent) {
      state.onEvent('campaign-done', {});
    }
  } else updateMarker(state);
}

export function updateMissions(state, dt) {
  if (beacon && beacon.visible) {
    beacon.userData.gem.rotation.y += dt * 2;
    beacon.userData.gem.position.y = 9 + Math.sin(state.time * 2) * 0.8;
    ring.material.opacity = 0.55 + Math.sin(state.time * 3) * 0.3;
  }
  if (!state.missionActive || state.over) return;
  const step = currentStep(state);
  if (!step) return;
  const px = state.inCar && state.car ? state.car.x : state.player.x;
  const pz = state.inCar && state.car ? state.car.z : state.player.z;
  const p = missionPlace(step);
  const d = dist2d(px, pz, p.x, p.z);
  if (step.type === 'escape') {
    if (state.wanted === 0 && state.wantedHeat < 0.5) {
      if (state.missionIndex === 2) completeStep(state); // getaway: heat gone = done
      else if (dist2d(px, pz, p.x, p.z) < 16) completeStep(state);
    }
    return;
  }
  if (d < 9) {
    if (step.type === 'steal') {
      // the target car is the Coral Comet; stealing it raises heat
      const comet = state.vehicles.find(v => v.name === 'Coral Comet');
      if (comet && state.inCar && state.car === comet) completeStep(state);
      else if (state.onEvent && !state._stealHintAt) {
        state._stealHintAt = state.time;
        state.onEvent('toast', { text: 'Get in the Coral Comet — then drive it to the garage.' });
      }
    } else completeStep(state);
  }
  // mission 2: the comet becomes the player's car the moment they enter it
  if (step.type === 'steal' && state.inCar && state.car && state.car.name === 'Coral Comet'
    && !state._cometStolen) {
    state._cometStolen = true;
    addHeat(state, 1, 'grand theft auto');
  }
}

// Cash pickups: green-gold bundles on sidewalks, worth $50-150.
export function spawnPickups(state) {
  const spots = [
    { x: -60, z: 24 }, { x: 60, z: -84 }, { x: 120, z: 120 }, { x: -120, z: -120 },
    { x: 24, z: -120 }, { x: -84, z: 60 }, { x: 150, z: 24 }, { x: -24, z: 150 },
    { x: 84, z: 84 }, { x: -150, z: 120 }, { x: 120, z: -150 }, { x: 0, z: 90 },
  ];
  for (const s of spots) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
    box.position.y = 0.5; g.add(box);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.12, 0.62),
      new THREE.MeshBasicMaterial({ color: PALETTE.gold }));
    band.position.y = 0.5; g.add(band);
    g.position.set(s.x, 0, s.z);
    state.scene.add(g);
    state.pickups.push({ mesh: g, x: s.x, z: s.z, value: 50 + Math.floor(state.rng() * 3) * 50, taken: false });
  }
}

export function updatePickups(state, dt) {
  const px = state.inCar && state.car ? state.car.x : state.player.x;
  const pz = state.inCar && state.car ? state.car.z : state.player.z;
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    pk.mesh.rotation.y += dt;
    pk.mesh.position.y = Math.sin(state.time * 2 + pk.x) * 0.15;
    if (dist2d(px, pz, pk.x, pk.z) < 2.6) {
      pk.taken = true;
      pk.mesh.visible = false;
      state.cash += pk.value;
      if (state.onEvent) state.onEvent('pickup', { value: pk.value });
    }
  }
}
