// police.js — the wanted system: heat from crimes, Solmar PD pursuit cars,
// busted/wasted flow, and cooling off at Pay 'n Spray.
import { TUNE, PALETTE, CITY } from './config.js';
import { clamp, dist2d, angleLerp } from './state.js';
import { makeVehicle } from './vehicles.js';
import { nearestStreet } from './city.js';

export function addHeat(state, amount, reason) {
  if (state.over) return;
  state.wantedHeat = clamp(state.wantedHeat + amount, 0, 5);
  const newLevel = Math.floor(state.wantedHeat);
  if (newLevel > state.wanted) {
    state.wanted = newLevel;
    state.wantedTimer = 0;
    if (state.onEvent) state.onEvent('wanted', { level: state.wanted, reason });
  }
}

function spawnPolice(state) {
  const want = Math.min(state.wanted + 1, TUNE.maxPolice);
  const px = state.inCar && state.car ? state.car.x : state.player.x;
  const pz = state.inCar && state.car ? state.car.z : state.player.z;
  while (state.police.length < want) {
    const a = state.rng() * Math.PI * 2;
    const sx = px + Math.cos(a) * (55 + state.rng() * 30);
    const sz = pz + Math.sin(a) * (55 + state.rng() * 30);
    const s = nearestStreet(sx, sz, state.rng);
    const car = makeVehicle(state, 'police', s.x, s.z, s.heading,
      { police: true, color: PALETTE.policeWhite, vertical: s.vertical });
    car.targetSpeed = 30 + state.wanted * 3;
  }
}

function removePolice(state) {
  for (const cop of [...state.police]) {
    state.scene.remove(cop.mesh);
    state.vehicles.splice(state.vehicles.indexOf(cop), 1);
    state.police.splice(state.police.indexOf(cop), 1);
  }
}

export function updatePolice(state, dt) {
  // wanted decays when the player stays clean and unseen
  if (state.wanted > 0) {
    state.wantedTimer += dt;
    const nearestCop = state.police.reduce((m, c) => Math.min(m, dist2d(c.x, c.z,
      state.inCar && state.car ? state.car.x : state.player.x,
      state.inCar && state.car ? state.car.z : state.player.z)), 1e9);
    if (state.wantedTimer > TUNE.wantedDecaySec && nearestCop > 60) {
      state.wantedHeat = Math.max(0, state.wantedHeat - dt * 0.25);
      const lvl = Math.floor(state.wantedHeat);
      if (lvl < state.wanted) {
        state.wanted = lvl;
        if (state.onEvent) state.onEvent('wanted', { level: lvl, reason: 'cooled off' });
      }
    }
  }
  if (state.wanted > 0) spawnPolice(state);
  else if (state.police.length) removePolice(state);

  const tx = state.inCar && state.car ? state.car.x : state.player.x;
  const tz = state.inCar && state.car ? state.car.z : state.player.z;
  const playerSpeed = state.inCar && state.car ? state.car.speed : 0;
  let closestCop = 1e9;
  for (const cop of state.police) {
    const d = dist2d(cop.x, cop.z, tx, tz);
    closestCop = Math.min(closestCop, d);
    // chase: steer toward the player, ram when close
    const wantHeading = Math.atan2(tx - cop.x, tz - cop.z);
    cop.heading = angleLerp(cop.heading, wantHeading, clamp(2.2 * dt, 0, 1));
    const target = d > 6 ? cop.targetSpeed : cop.targetSpeed * 0.7;
    cop.speed += clamp(target - cop.speed, -20 * dt, 12 * dt);
    const nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
    const nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
    // buildings stop cops too (they are not ghosts)
    let blocked = false;
    for (const c of state.city.colliders) {
      if (nx > c.minX - 1 && nx < c.maxX + 1 && nz > c.minZ - 1 && nz < c.maxZ + 1) { blocked = true; break; }
    }
    if (blocked) {
      // steer toward the nearest street centreline instead of spinning in place
      const lines = CITY.streetLines();
      let bx = cop.x, bz = cop.z, bd = 1e9;
      for (const s of lines) {
        const d = Math.abs(cop.x - s);
        if (d < bd) { bd = d; bx = s; bz = cop.z; }
        const d2 = Math.abs(cop.z - s);
        if (d2 < bd) { bd = d2; bx = cop.x; bz = s; }
      }
      cop.heading = angleLerp(cop.heading, Math.atan2(bx - cop.x, bz - cop.z), clamp(3 * dt, 0, 1));
      cop.speed *= 0.6;
    } else { cop.x = nx; cop.z = nz; }
    // ram damage
    if (d < 3.6) {
      if (state.inCar && state.car) {
        state.car.health = Math.max(0, state.car.health - 14 * dt);
        state.car.speed *= 0.96;
        if (state.onEvent) state.onEvent('rammed', {});
      }
    }
    // light bar flash
    cop.sirenPhase += dt * 9;
    const on = Math.sin(cop.sirenPhase) > 0;
    if (cop.mesh.userData.lightRed) {
      cop.mesh.userData.lightRed.material.color.setHex(on ? 0xff2a1e : 0x551111);
      cop.mesh.userData.lightBlue.material.color.setHex(on ? 0x113355 : 0x2a7bff);
    }
    const spin = (cop.speed * dt) / 0.42;
    for (const w of cop.mesh.userData.wheels) w.rotation.x += spin;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
  }

  // Busted: on foot, a cop gets close and stays close.
  if (!state.inCar && state.wanted >= 2 && closestCop < TUNE.bustedDist) {
    state.bustedTimer += dt;
    if (state.bustedTimer > TUNE.bustedTime) endRun(state, 'busted');
  } else state.bustedTimer = Math.max(0, state.bustedTimer - dt * 2);
  // Wasted: car destroyed while wanted, or health gone on foot.
  if (state.inCar && state.car && state.car.health <= 0) endRun(state, 'wasted');
  if (!state.inCar && state.health <= 0) endRun(state, 'wasted');
}

export function endRun(state, kind) {
  if (state.over) return;
  state.over = true;
  state.wasted = true;
  state.stats.busted++;
  const fine = kind === 'busted' ? Math.min(400, Math.round(state.cash * 0.25)) : 0;
  state.cash = Math.max(0, state.cash - fine);
  if (state.onEvent) state.onEvent('over', { kind, fine });
}

// Pay 'n Spray: drive in, pay, repair + clear wanted. Called from main loop.
export function trySpray(state) {
  if (!state.inCar || !state.car || !state.spray) return false;
  const d = dist2d(state.car.x, state.car.z, state.spray.x, state.spray.z);
  if (d > state.spray.r || state.cash < TUNE.sprayCost) return false;
  state.cash -= TUNE.sprayCost;
  state.car.health = 100;
  state.wanted = 0; state.wantedHeat = 0; state.wantedTimer = 0;
  if (state.onEvent) state.onEvent('spray', { cost: TUNE.sprayCost });
  return true;
}
