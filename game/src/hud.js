// hud.js — the DOM HUD (cash, health, wanted stars, clock, objective, speed)
// and the 2D minimap that draws the city, the player, the cops and the job marker.
import { CITY, PLACES } from './config.js';
import { dist2d } from './state.js';

const $ = (id) => document.getElementById(id);

export function initHud(state) {
  const els = {
    topleft: $('hud-topleft'), topright: $('hud-topright'), objective: $('hud-objective'),
    map: $('hud-map'), speed: $('hud-speed'), hint: $('hud-hint'),
    cash: $('cash-num'), health: $('healthfill'), carhealth: $('carhealth'),
    stars: $('stars'), clock: $('clock'), objTitle: $('obj-title'), objText: $('obj-text'),
    toast: $('hud-toast'), speedNum: $('speed'), gear: $('gear'),
    wasted: $('hud-wasted'), wastedTitle: $('wasted-title'), wastedText: $('wasted-text'),
    menu: $('menu'), missions: $('menu-missions'), save: $('menu-save'),
    status: $('status'),
  };
  state.hud = els;
  state.minimapCtx = $('minimap').getContext('2d');
  let toastTimer = null;
  state.showToast = (text, ms = 2600) => {
    els.toast.textContent = text;
    els.toast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.style.opacity = '0'; }, ms);
  };
  state.announce = (text) => { els.status.textContent = text; };
}

function fmtClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const label = hour >= 6 && hour < 12 ? 'Morning' : hour >= 12 && hour < 17 ? 'Afternoon'
    : hour >= 17 && hour < 20.5 ? 'Golden hour' : hour >= 20.5 || hour < 5 ? 'Night' : 'Dawn';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${label}`;
}

export function updateHud(state) {
  const els = state.hud;
  if (!els) return;
  const inGame = state.started && !state.over;
  for (const k of ['topleft', 'topright', 'objective', 'map', 'speed', 'hint']) {
    els[k].hidden = !inGame;
  }
  if (!inGame) return;
  els.cash.textContent = Math.round(state.cash).toLocaleString('en-US');
  els.health.style.width = `${Math.max(0, state.health)}%`;
  els.health.style.background = state.health > 50 ? '#7bc96f' : state.health > 25 ? '#f5a623' : '#ff4d4d';
  els.carhealth.textContent = state.inCar && state.car
    ? `Car: ${Math.round(state.car.health)}%  ·  R near Pay 'n Spray ($200) to repair`
    : state.nearestCar ? `E — steal the ${state.nearestCar.name ?? 'car'}` : 'On foot — find a car (E)';
  const spans = els.stars.querySelectorAll('span');
  spans.forEach((s, i) => s.classList.toggle('on', i < state.wanted));
  els.clock.textContent = fmtClock(state.hour);
  const step = state.missionActive && state.marker
    ? state.marker : null;
  if (step) {
    const titles = ['JOB 1 · FIRST FARE', 'JOB 2 · HOT WHEELS', 'JOB 3 · GETAWAY', 'JOB 4 · NIGHT RUN', 'JOB 5 · THE BIG SCORE'];
    els.objTitle.textContent = titles[state.missionIndex] ?? 'JOB';
    if (step.type === 'escape') {
      els.objText.textContent = `${step.text} — stay out of sight until the heat dies down`;
    } else {
      const d = dist2d(state.inCar && state.car ? state.car.x : state.player.x,
        state.inCar && state.car ? state.car.z : state.player.z, step.x, step.z);
      els.objText.textContent = `${step.text} — ${Math.round(d)}m to ${step.label}`;
    }
  } else if (state.missionIndex >= 5) {
    els.objTitle.textContent = 'LEGEND OF SOLMAR';
    els.objText.textContent = 'All five jobs done. The city is yours, Rio.';
  } else {
    els.objTitle.textContent = 'FREE ROAM';
    els.objText.textContent = state.missionIndex === 0
      ? 'Press M to take the first job from Mama Rosa.'
      : 'Press M to take the next job, or cruise and collect cash.';
  }
  const speed = state.inCar && state.car ? Math.abs(state.car.speed) * 2.2 : Math.abs(state.player.speed) * 2.2;
  els.speedNum.innerHTML = `${Math.round(speed)} <small>mph</small>`;
  els.gear.textContent = state.inCar
    ? (state.car.speed > 1 ? 'DRIVE' : state.car.speed < -1 ? 'REVERSE' : 'PARK') + (state.wanted ? ' · WANTED' : '')
    : 'ON FOOT';
  drawMinimap(state);
}

function drawMinimap(state) {
  const ctx = state.minimapCtx;
  if (!ctx) return;
  const S = 188, half = CITY.half + 40;
  const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#141210'; ctx.fillRect(0, 0, S, S);
  // sea + sand on the south edge
  const [, seaY] = toMap(0, CITY.half + 30);
  ctx.fillStyle = '#0f8b8d'; ctx.fillRect(0, seaY, S, S - seaY);
  ctx.fillStyle = '#e8c98f'; ctx.fillRect(0, seaY - 5, S, 5);
  // roads
  ctx.strokeStyle = '#5a5148'; ctx.lineWidth = 5;
  for (const s of CITY.streetLines()) {
    const [x] = toMap(s, 0); const [, z] = toMap(0, s);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(S, z); ctx.stroke();
  }
  // blocks
  ctx.fillStyle = '#3a332c';
  for (const b of CITY.blockCentres()) {
    const [x, z] = toMap(b.x, b.z);
    const w = (CITY.block / (half * 2)) * S;
    ctx.fillRect(x - w / 2, z - w / 2, w, w);
  }
  // Pay 'n Spray
  const [sx, sz] = toMap(PLACES.spray.x, PLACES.spray.z);
  ctx.fillStyle = '#2ec4b6'; ctx.fillRect(sx - 3, sz - 3, 6, 6);
  // mission marker
  if (state.marker) {
    const [mx, mz] = toMap(state.marker.x, state.marker.z);
    const pulse = 5 + Math.sin(state.time * 4) * 2;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.arc(mx, mz, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d1a16';
    ctx.beginPath(); ctx.arc(mx, mz, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // police (flashing dots)
  for (const cop of state.police) {
    const [cx, cz] = toMap(cop.x, cop.z);
    ctx.fillStyle = Math.sin(state.time * 9) > 0 ? '#ff2a1e' : '#2a7bff';
    ctx.beginPath(); ctx.arc(cx, cz, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  // player arrow
  const px = state.inCar && state.car ? state.car.x : state.player.x;
  const pz = state.inCar && state.car ? state.car.z : state.player.z;
  const heading = state.inCar && state.car ? state.car.heading : state.player.heading;
  const [ax, ay] = toMap(px, pz);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)) + Math.PI);
  ctx.fillStyle = '#ffb347';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function showWasted(state, kind, fine) {
  const els = state.hud;
  els.wasted.style.display = 'flex';
  els.wastedTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  els.wastedText.textContent = kind === 'busted'
    ? `The Solmar PD caught up with Rio. Bail and impound fees: $${fine}.`
    : 'Rio\u2019s ride gave out. Mama Rosa sends a tow — and a bill for the trouble.';
}

export function fillMenu(state, save) {
  const els = state.hud;
  const defs = [
    '1 · First Fare — $300', '2 · Hot Wheels — $600', '3 · Getaway — $900',
    '4 · Night Run — $1,200', '5 · The Big Score — $2,500',
  ];
  els.missions.innerHTML = '<b>Five jobs for Mama Rosa:</b><br>' + defs.map((d, i) =>
    (save && i < save.missionIndex ? '✓ ' : (i === (save ? save.missionIndex : 0) ? '▸ ' : '· ')) + d
  ).join('<br>');
  els.save.textContent = save
    ? `Save found: $${Math.round(save.cash)} · ${save.missionsDone} job${save.missionsDone === 1 ? '' : 's'} done — progress resumes.`
    : '';
}
