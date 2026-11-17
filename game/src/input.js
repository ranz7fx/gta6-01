// input.js — keyboard + pointer-lock mouse camera. Edge-triggered actions
// (enter car, punch, mission, pause) are consumed once per press.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    forward: false, back: false, left: false, right: false,
    run: false, handbrake: false,
    throttle: 0, brake: 0, steer: 0,
    punch: false, enterCar: false, mission: false, pause: false, spray: false,
    mouseDX: 0, mouseDY: 0,
  };
  const KEYMAP = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'handbrake',
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) { if (e.code === 'Space') e.preventDefault(); return; }
    input.keys.add(e.code);
    const mapped = KEYMAP[e.code];
    if (mapped) input[mapped] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyF') input.punch = true;
    if (e.code === 'KeyE') input.enterCar = true;
    if (e.code === 'KeyM') input.mission = true;
    if (e.code === 'KeyP' || e.code === 'Escape') input.pause = true;
    if (e.code === 'KeyR') input.spray = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
    const mapped = KEYMAP[e.code];
    if (mapped) input[mapped] = false;
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    for (const k of ['forward', 'back', 'left', 'right', 'run', 'handbrake']) input[k] = false;
  });
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      input.mouseDX += e.movementX; input.mouseDY += e.movementY;
    }
  });
  // Per-frame: collapse held keys into driving axes. Autopilot overrides.
  input.poll = (state) => {
    if (state.autopilot) {
      input.throttle = state.autopilot.throttle;
      input.brake = state.autopilot.brake ?? 0;
      input.steer = state.autopilot.steer;
      input.handbrake = false;
      return;
    }
    input.throttle = input.forward ? 1 : 0;
    input.brake = input.back ? 1 : 0;
    input.steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  };
  input.consumeEdges = () => {
    const edges = { punch: input.punch, enterCar: input.enterCar, mission: input.mission, pause: input.pause, spray: input.spray };
    input.punch = input.enterCar = input.mission = input.pause = input.spray = false;
    return edges;
  };
  input.consumeMouse = () => {
    const dx = input.mouseDX, dy = input.mouseDY;
    input.mouseDX = 0; input.mouseDY = 0;
    return { dx, dy };
  };
  return input;
}
