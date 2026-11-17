// shots.js — deterministic staging for the four screenshots. Each shot sets the
// time of day, the player's car and position, the wanted level and a camera,
// then lets the simulation run so the frame is alive, not posed.
//   ?shot=cover  golden-hour police chase down the beach avenue (the cover)
//   ?shot=street on foot at the pier at sunset, pedestrians and traffic
//   ?shot=night  downtown at night, neon + police lights
//   ?shot=city   high wide shot of the whole city at golden hour
import { PLACES, PALETTE } from './config.js';
import { addHeat } from './police.js';
import { startMission } from './missions.js';
import { makeVehicle } from './vehicles.js';

function placePlayerInCar(state, carName, x, z, heading, speed) {
  const car = state.vehicles.find(v => v.name === carName) ??
    state.vehicles.find(v => v.kind === 'parked');
  car.parked = false; car.isPlayerCar = true;
  car.x = x; car.z = z; car.heading = heading; car.speed = speed;
  state.car = car; state.inCar = true;
  state.player.x = x; state.player.z = z;
  return car;
}

function placePlayerOnFoot(state, x, z, heading) {
  state.player.x = x; state.player.z = z; state.player.heading = heading;
  state.inCar = false; state.car = null;
}

export function applyShot(state, name) {
  state.shotMode = name;
  const S = state;
  if (name === 'cover') {
    S.hour = 17.6;
    // Beach avenue run: south down street x=-23 toward the sea, cops behind.
    placePlayerInCar(S, 'Rio\u2019s Runner', -23, 148, 0, 26);
    S.car.heading = 0; S.car.speed = 30;
    S.cameraYaw = Math.PI + 0.45; S.cameraPitch = 0.3; S.cameraDist = 22;
    addHeat(S, 3, 'staged chase');
    startMission(S, 2); // Getaway: the chase IS the job
    // two pursuit cars close behind, two civilians ahead — the chase reads at once
    for (const [dx, dz] of [[-5, -12], [5, -16]]) {
      const cop = makeVehicle(S, 'police', -23 + dx, 148 + dz, 0, { police: true, color: PALETTE.policeWhite, vertical: true });
      cop.speed = 30; cop.targetSpeed = 34;
    }
    for (const [dx, dz] of [[-3, 42], [3, 58]]) {
      makeVehicle(S, 'traffic', -23 + dx, 148 + dz, 0, { vertical: true, targetSpeed: 12 });
    }
    S.autopilot = { throttle: 0.7, steer: 0.02 };
    S.showToast('JOB 3 · GETAWAY — Lose the cops', 4000);
  } else if (name === 'street') {
    S.hour = 17.4; // golden hour from the pier, city skyline ahead
    placePlayerOnFoot(S, 42, 244, Math.PI); // sand beside the pier, facing the city
    S.cameraYaw = 0; S.cameraPitch = 0.3; S.cameraDist = 11; // camera on the pier, looking north
    startMission(S, 0);
    // pull a few pedestrians onto the sand near the pier so the beach reads alive
    S.peds.slice(0, 5).forEach((p, i) => {
      p.x = 20 + i * 5; p.z = 234 + (i % 2) * 7;
      p.heading = Math.PI * (i % 2 ? 0.9 : 0.1); p.flee = 0; p.down = 0;
    });
    // beach-road traffic rolling past ahead
    makeVehicle(S, 'traffic', -40, 217, Math.PI / 2, { vertical: false, targetSpeed: 11 });
    makeVehicle(S, 'traffic', 46, 217, -Math.PI / 2, { vertical: false, targetSpeed: 11 });
  } else if (name === 'night') {
    S.hour = 22.4;
    placePlayerInCar(S, 'Coral Comet', -23, 110, Math.PI, 18);
    S.car.heading = Math.PI; // north up the downtown avenue, mid-block (no pole in frame)
    S.cameraYaw = 0.35; S.cameraPitch = 0.3; S.cameraDist = 14; S.lockCam = true; // fixed three-quarter rear view
    addHeat(S, 2, 'staged night');
    startMission(S, 3); // Night Run
    S.autopilot = { throttle: 0.55, steer: -0.01 };
  } else if (name === 'city') {
    S.hour = 17.9;
    // aerial establishing shot: high over downtown, sea to the south
    placePlayerInCar(S, 'Rio\u2019s Runner', -90, 37, Math.PI / 2, 20);
    S.car.heading = Math.PI / 2; // east along the avenue
    S.cameraYaw = -2.4; S.cameraPitch = 0.5; S.cameraDist = 95; S.lockCam = true;
    startMission(S, 0);
    for (const [dx, dz] of [[-6, -18], [6, -26]]) {
      const cop = makeVehicle(S, 'police', -90 + dx, 37 + dz, Math.PI / 2, { police: true, color: PALETTE.policeWhite, vertical: false });
      cop.speed = 22; cop.targetSpeed = 30;
    }
    makeVehicle(S, 'traffic', -40, 37, Math.PI / 2, { vertical: false, targetSpeed: 12 });
    makeVehicle(S, 'traffic', -140, 37, Math.PI / 2, { vertical: false, targetSpeed: 12 });
    S.autopilot = { throttle: 0.5, steer: 0 };
  }
  // hide the start menu, show the HUD, run the sim
  S.started = true;
  S.hud.menu.style.display = 'none';
  window.__shotReady = false;
  // settle in SIM time (headless rendering is slow: wall-clock lies, sim time doesn't).
  // Run the world ~2.4 sim-seconds so police close in and traffic spreads, then flag ready.
  const sim0 = S.time;
  const wall0 = performance.now();
  const settle = setInterval(() => {
    if (S.time - sim0 > 2.4 || performance.now() - wall0 > 25000) {
      clearInterval(settle);
      window.__shotReady = true;
      window.__shotName = name;
    }
  }, 100);
}
