// vehicles.js — car factory, arcade driving physics, traffic AI and parked cars.
import * as THREE from 'three';
import { PALETTE, TUNE, CITY, PLACES } from './config.js';
import { clamp, angleLerp, dist2d } from './state.js';
import { collideBuildings, nearestStreet, onRoad } from './city.js';

const WHEEL_R = 0.42;

export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x888888 });
  const glass = new THREE.MeshPhongMaterial({ color: 0x1a2830, shininess: 120, specular: 0xffffff });
  const trim = new THREE.MeshLambertMaterial({ color: 0x1d1a16 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.5), paint);
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), opts.police ? paint : glass);
  cabin.position.set(0, 1.18, -0.25); cabin.castShadow = true; g.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, 0.7), paint);
  nose.position.set(0, 0.55, 2.35); g.add(nose);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.3, 0.3), trim);
  bumper.position.set(0, 0.32, 2.5); g.add(bumper);
  const bumper2 = bumper.clone(); bumper2.position.z = -2.5; g.add(bumper2);
  // headlights / taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
  for (const sx of [-0.72, 0.72]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), hl);
    h.position.set(sx, 0.68, 2.56); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), tl);
    t.position.set(sx, 0.68, -2.56); g.add(t);
  }
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.32, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141210 });
  for (const [wx, wz] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, WHEEL_R, wz);
    w.castShadow = true; g.add(w); wheels.push(w);
  }
  if (opts.police) {
    // black hood + doors band, white body: paint the cabin black, add light bar
    cabin.material = new THREE.MeshLambertMaterial({ color: PALETTE.policeBlack });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), trim);
    bar.position.set(0, 1.58, -0.25); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.24, 0.52),
      new THREE.MeshBasicMaterial({ color: 0xff2a1e }));
    red.position.set(-0.34, 1.58, -0.25); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.24, 0.52),
      new THREE.MeshBasicMaterial({ color: 0x2a7bff }));
    blue.position.set(0.34, 1.58, -0.25); g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
  }
  g.userData.wheels = wheels;
  return g;
}

export function makeVehicle(state, kind, x, z, heading, opts = {}) {
  const color = opts.color ?? PALETTE.carPaint[Math.floor(state.rng() * PALETTE.carPaint.length)];
  const mesh = makeCarMesh(color, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  state.scene.add(mesh);
  const v = {
    kind, mesh, x, z, heading,
    speed: 0, steer: 0, health: 100,
    police: !!opts.police, parked: !!opts.parked,
    targetSpeed: opts.targetSpeed ?? 9 + state.rng() * 5,
    vertical: opts.vertical ?? false, street: opts.street ?? 0,
    lane: opts.lane ?? (state.rng() < 0.5 ? -3.2 : 3.2),
    turnAt: null, stuck: 0, sirenPhase: state.rng() * 10,
    name: opts.name ?? null, isPlayerCar: false,
  };
  state.vehicles.push(v);
  if (v.police) state.police.push(v);
  return v;
}

// Arcade driving: speed along heading, steering that bites more at low speed,
// handbrake drops grip for drifts. Collisions: buildings, other cars, peds handled by callers.
export function driveCar(state, v, input, dt) {
  const forward = { x: Math.sin(v.heading), z: Math.cos(v.heading) };
  const throttle = input.throttle, brake = input.brake, steerIn = input.steer;
  if (throttle > 0) v.speed += TUNE.carAccel * throttle * dt;
  if (brake > 0) {
    if (v.speed > 0.5) v.speed -= TUNE.carBrake * brake * dt;
    else v.speed -= TUNE.carReverse * brake * dt;
  }
  v.speed -= v.speed * 0.55 * dt; // drag
  if (!throttle && !brake) v.speed -= Math.sign(v.speed) * 4 * dt;
  v.speed = clamp(v.speed, -TUNE.carMaxReverse, TUNE.carMaxSpeed);
  const grip = input.handbrake ? TUNE.driftGrip : TUNE.carGrip;
  const steerTarget = steerIn * TUNE.carSteer * clamp(Math.abs(v.speed) / 12, 0.25, 1);
  v.steer = angleLerp(v.steer, steerTarget, clamp(grip * dt, 0, 1));
  v.heading += (v.steer * v.speed * dt) / 3.4;
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  const fixed = collideBuildings(state, nx, nz, 2.1);
  const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
  if (hitWall) {
    if (Math.abs(v.speed) > 8 && state.onEvent) state.onEvent('crash', { speed: Math.abs(v.speed) });
    v.speed *= 0.45;
  }
  v.x = fixed.x; v.z = fixed.z;
  // car-car push-out
  for (const o of state.vehicles) {
    if (o === v || o.parked && o === state.car) continue;
    const d = dist2d(v.x, v.z, o.x, o.z);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) / 2;
      const px = (v.x - o.x) / d * push, pz = (v.z - o.z) / d * push;
      v.x += px; v.z += pz;
      if (!o.police && !o.parked) { o.x -= px; o.z -= pz; }
      if (Math.abs(v.speed) > 6) {
        v.speed *= 0.82; o.health = Math.max(0, (o.health ?? 100) - 4);
        if (state.onEvent) state.onEvent('bump', { speed: Math.abs(v.speed) });
      }
    }
  }
  // wheels spin + steer visual
  const spin = (v.speed * dt) / WHEEL_R;
  for (const w of v.mesh.userData.wheels) w.rotation.x += spin;
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
  // body roll / pitch for feel
  v.mesh.rotation.z = -v.steer * 0.06 * clamp(Math.abs(v.speed) / 20, 0, 1);
  v.mesh.rotation.x = clamp(-(throttle ? 0.02 : 0) + (brake && v.speed > 1 ? 0.03 : 0), -0.04, 0.04);
  return hitWall;
}

// Traffic: follow the street grid, turn at intersections, stop for red lights
// and for slow cars ahead. Pure lane-following — no pathfinding needed.
export function updateTraffic(state, dt) {
  const lines = CITY.streetLines();
  const half = CITY.half;
  for (const v of state.vehicles) {
    if (v.police || v.parked || v.isPlayerCar) continue;
    const ahead = { x: v.x + Math.sin(v.heading) * 9, z: v.z + Math.cos(v.heading) * 9 };
    let blocked = false;
    for (const o of state.vehicles) {
      if (o === v) continue;
      if (dist2d(ahead.x, ahead.z, o.x, o.z) < 4.5) { blocked = true; break; }
    }
    // red light: stop before the intersection if the light is red for our axis
    const nearX = lines.some(s => Math.abs(v.x - s) < 12 && Math.abs(v.z % 60) < 14);
    const lightRed = ((state.time * 0.12 + (v.vertical ? 0.5 : 0)) % 1) < 0.5;
    if (nearX && lightRed && onRoad(v.x, v.z)) {
      // only stop if actually approaching an intersection
      const toCross = v.vertical
        ? lines.some(s => Math.abs(v.z - s) < 11 && Math.sign(Math.cos(v.heading)) === Math.sign(s - v.z))
        : lines.some(s => Math.abs(v.x - s) < 11 && Math.sign(Math.sin(v.heading)) === Math.sign(s - v.x));
      if (toCross) blocked = true;
    }
    const target = blocked ? 0 : v.targetSpeed;
    v.speed += clamp(target - v.speed, -14 * dt, 8 * dt);
    let nx = v.x + Math.sin(v.heading) * v.speed * dt;
    let nz = v.z + Math.cos(v.heading) * v.speed * dt;
    // at an intersection, sometimes turn
    const atCross = lines.some(s => Math.abs(v.x - s) < 2.5) && lines.some(s => Math.abs(v.z - s) < 2.5);
    if (atCross && !v.turnAt) {
      if (state.rng() < 0.3) {
        v.heading += (state.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        v.vertical = !v.vertical;
      }
      v.turnAt = state.time + 2;
    }
    if (v.turnAt && state.time > v.turnAt) v.turnAt = null;
    // keep on the road: if we drifted off-grid (after a turn), snap lane
    const fixed = collideBuildings(state, nx, nz, 2.1);
    if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) {
      v.heading += Math.PI / 2; v.vertical = !v.vertical; v.speed *= 0.5;
      nx = v.x; nz = v.z;
    }
    // wrap around the city edge so traffic never runs out
    if (nx > half + 20 || nx < -half - 20 || nz > half + 20 || nz < -half - 20) {
      const s = nearestStreet((state.rng() - 0.5) * half, (state.rng() - 0.5) * half, state.rng);
      v.x = s.x; v.z = s.z; v.heading = s.heading; v.vertical = s.vertical; v.speed = v.targetSpeed;
    } else { v.x = nx; v.z = nz; }
    const spin = (v.speed * dt) / WHEEL_R;
    for (const w of v.mesh.userData.wheels) w.rotation.x += spin;
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = v.heading;
  }
}

export function spawnTraffic(state) {
  for (let i = 0; i < TUNE.trafficCount; i++) {
    const s = nearestStreet((state.rng() - 0.5) * CITY.half, (state.rng() - 0.5) * CITY.half, state.rng);
    makeVehicle(state, 'traffic', s.x, s.z, s.heading, { vertical: s.vertical });
  }
  // parked cars near key places, including the mission-2 target
  const parked = [
    { x: PLACES.marina.x + 8, z: PLACES.marina.z - 6, color: 0xff6b35, name: 'Coral Comet' },
    { x: PLACES.rosaGarage.x + 14, z: PLACES.rosaGarage.z + 4, color: 0xff6b35, name: 'Rio\u2019s Runner' },
    { x: -30, z: 150, color: 0xf5d76e },
    { x: 90, z: 30, color: 0xe8e3d8 },
    { x: 150, z: -90, color: 0x37474f },
    { x: -150, z: 60, color: 0xc0392b },
    { x: 30, z: -150, color: 0x7fb8a4 },
    { x: -90, z: -150, color: 0xff8fa3 },
  ];
  for (const p of parked) {
    makeVehicle(state, 'parked', p.x, p.z, state.rng() * Math.PI * 2,
      { parked: true, color: p.color, name: p.name ?? null });
  }
}
