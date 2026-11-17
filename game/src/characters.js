// characters.js — Dario on foot and the pedestrians who fill Solmar's sidewalks.
import * as THREE from 'three';
import { TUNE, CITY, PALETTE } from './config.js';
import { clamp, angleLerp, dist2d } from './state.js';
import { collideBuildings, onRoad } from './city.js';

const SKINS = [0x8a5a3b, 0xc98d64, 0x6b4429, 0xe8b98a, 0x5a3a22];
const SHIRTS = [0xff6b35, 0x2ec4b6, 0xf5d76e, 0xff5d8f, 0x7fb8a4, 0xe8e3d8, 0x4a6fa5, 0xc96f4a];
const PANTS = [0x37474f, 0x1d1a16, 0x5a6b7a, 0x8a7a66];

function makePersonMesh(rng, isPlayer) {
  const g = new THREE.Group();
  const skin = isPlayer ? 0xc98d64 : SKINS[Math.floor(rng() * SKINS.length)];
  const shirt = isPlayer ? 0xff6b35 : SHIRTS[Math.floor(rng() * SHIRTS.length)];
  const pants = isPlayer ? 0x37474f : PANTS[Math.floor(rng() * PANTS.length)];
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.08; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skinMat);
  head.position.y = 1.68; head.castShadow = true; g.add(head);
  if (isPlayer) {
    // Rio's open jacket + cap
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.5, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2ec4b6 }));
    jacket.position.y = 1.16; g.add(jacket);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10),
      new THREE.MeshLambertMaterial({ color: 0xf5d76e }));
    cap.position.y = 1.88; g.add(cap);
  } else if (rng() < 0.4) {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x1d1a16 }));
    hair.position.y = 1.72; g.add(hair);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pantsMat);
  legL.position.set(-0.16, 0.36, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirtMat);
  armL.position.set(-0.42, 1.08, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}

export function makePlayer(state, x, z) {
  const mesh = makePersonMesh(state.rng, true);
  mesh.position.set(x, 0, z);
  state.scene.add(mesh);
  const p = { mesh, x, z, heading: 0, speed: 0, walkPhase: 0, punchTimer: 0, punchCooldown: 0 };
  state.player = p;
  return p;
}

export function spawnPeds(state) {
  for (let i = 0; i < TUNE.pedCount; i++) {
    const mesh = makePersonMesh(state.rng, false);
    const x = (state.rng() - 0.5) * CITY.half * 1.6;
    const z = (state.rng() - 0.5) * CITY.half * 1.6;
    mesh.position.set(x, 0, z);
    state.scene.add(mesh);
    state.peds.push({
      mesh, x, z, heading: state.rng() * Math.PI * 2,
      speed: 1.2 + state.rng() * 1.1, walkPhase: state.rng() * 6,
      flee: 0, down: 0, retarget: 0, targetHeading: state.rng() * Math.PI * 2,
    });
  }
}

// On-foot movement: WASD relative to camera yaw, run with Shift, punch with F.
export function updatePlayerOnFoot(state, input, dt) {
  const p = state.player;
  if (!p) return;
  const yaw = state.cameraYaw;
  let mx = 0, mz = 0;
  if (input.forward) { mx += -Math.sin(yaw); mz += -Math.cos(yaw); }
  if (input.back) { mx += Math.sin(yaw); mz += Math.cos(yaw); }
  if (input.left) { mx += -Math.cos(yaw); mz += Math.sin(yaw); }
  if (input.right) { mx += Math.cos(yaw); mz += -Math.sin(yaw); }
  const len = Math.hypot(mx, mz);
  const run = input.run ? TUNE.runSpeed : TUNE.walkSpeed;
  const target = len > 0 ? run : 0;
  p.speed += clamp(target - p.speed, -30 * dt, 20 * dt);
  if (len > 0) {
    p.heading = angleLerp(p.heading, Math.atan2(mx, mz), clamp(12 * dt, 0, 1));
    const nx = p.x + Math.sin(p.heading) * p.speed * dt;
    const nz = p.z + Math.cos(p.heading) * p.speed * dt;
    const fixed = collideBuildings(state, nx, nz, 0.6);
    p.x = fixed.x; p.z = fixed.z;
    p.walkPhase += p.speed * dt * 1.6;
  }
  // punch: short-range, knocks a ped down and raises heat
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  if (input.punch && p.punchCooldown <= 0) {
    p.punchTimer = 0.28; p.punchCooldown = 0.55;
    const fx = p.x + Math.sin(p.heading) * 1.4, fz = p.z + Math.cos(p.heading) * 1.4;
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (dist2d(fx, fz, ped.x, ped.z) < 1.6) {
        ped.down = 2.5; ped.flee = 3;
        state.stats.pedsHit++;
        if (state.onEvent) state.onEvent('crime', { kind: 'assault', amount: 1 });
      }
    }
    if (state.onEvent) state.onEvent('punch', {});
  }
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  const u = p.mesh.userData;
  const swing = Math.sin(p.walkPhase) * clamp(p.speed / TUNE.walkSpeed, 0, 1) * 0.55;
  u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
  u.armL.rotation.x = p.punchTimer > 0 ? -1.6 : -swing * 0.8;
  u.armR.rotation.x = p.punchTimer > 0 ? -1.6 : swing * 0.8;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
}

// Pedestrians: stroll the sidewalks, change direction at random, flee from
// fast cars and from the player after a punch. Getting run over raises heat.
export function updatePeds(state, dt) {
  const px = state.inCar && state.car ? state.car.x : state.player.x;
  const pz = state.inCar && state.car ? state.car.z : state.player.z;
  const playerSpeed = state.inCar && state.car ? Math.abs(state.car.speed) : Math.abs(state.player.speed);
  for (const ped of state.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      ped.mesh.rotation.x = ped.down > 0 ? -Math.PI / 2 * clamp(ped.down, 0, 1) : 0;
      ped.mesh.position.y = ped.down > 0 ? 0.35 : 0;
      continue;
    }
    ped.mesh.rotation.x = 0; ped.mesh.position.y = 0;
    const dPlayer = dist2d(ped.x, ped.z, px, pz);
    if (dPlayer < 8 && playerSpeed > 14) ped.flee = 2.5;
    ped.flee = Math.max(0, ped.flee - dt);
    ped.retarget -= dt;
    if (ped.retarget <= 0) {
      ped.retarget = 2 + state.rng() * 5;
      ped.targetHeading = state.rng() * Math.PI * 2;
    }
    let heading = ped.targetHeading;
    if (ped.flee > 0) heading = Math.atan2(ped.x - px, ped.z - pz);
    ped.heading = angleLerp(ped.heading, heading, clamp(4 * dt, 0, 1));
    const speed = ped.flee > 0 ? 5.2 : ped.speed;
    const nx = ped.x + Math.sin(ped.heading) * speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * speed * dt;
    // stay out of buildings; prefer sidewalks but allow crossing
    const fixed = collideBuildings(state, nx, nz, 0.5);
    ped.x = fixed.x; ped.z = fixed.z;
    // run over by a car?
    if (state.inCar && state.car && Math.abs(state.car.speed) > 6) {
      if (dist2d(ped.x, ped.z, state.car.x, state.car.z) < 2.4) {
        ped.down = 3; ped.flee = 3;
        state.stats.pedsHit++;
        if (state.onEvent) state.onEvent('crime', { kind: 'hit-ped', amount: 1 });
        if (state.onEvent) state.onEvent('crash', { speed: Math.abs(state.car.speed) });
      }
    }
    ped.walkPhase += speed * dt * 2.2;
    const u = ped.mesh.userData;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7; u.armR.rotation.x = swing * 0.7;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

// Find the nearest enterable car within reach of the player.
export function nearestCar(state, maxDist = 4.5) {
  let best = null, bestD = maxDist;
  for (const v of state.vehicles) {
    if (v.police || v.isPlayerCar) continue;
    const d = dist2d(state.player.x, state.player.z, v.x, v.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}
