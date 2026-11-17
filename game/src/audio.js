// audio.js — all sound is synthesized with WebAudio. No audio files, no network.
export function createAudio() {
  const api = { ctx: null, engine: null, engineGain: null, muted: false };
  api.ensure = () => {
    if (api.ctx) { if (api.ctx.state === 'suspended') api.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      api.ctx = new AC();
      // engine: two detuned saws through a lowpass, pitch follows speed
      api.engine = api.ctx.createOscillator();
      api.engine.type = 'sawtooth';
      api.engine.frequency.value = 55;
      const osc2 = api.ctx.createOscillator();
      osc2.type = 'square'; osc2.frequency.value = 28;
      const lp = api.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      api.engineGain = api.ctx.createGain(); api.engineGain.gain.value = 0;
      api.engine.connect(lp); osc2.connect(lp);
      lp.connect(api.engineGain); api.engineGain.connect(api.ctx.destination);
      api.engine.start(); osc2.start();
      api._osc2 = osc2;
    } catch { api.ctx = null; }
  };
  api.engineSpeed = (speed01, on) => {
    if (!api.ctx || !api.engineGain) return;
    const t = api.ctx.currentTime;
    api.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
    api.engine.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    api._osc2.frequency.setTargetAtTime(28 + speed01 * 62, t, 0.08);
  };
  api.blip = (freq, dur = 0.12, type = 'sine', vol = 0.16) => {
    if (!api.ctx || api.muted) return;
    const o = api.ctx.createOscillator(), g = api.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, api.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, api.ctx.currentTime + dur);
    o.connect(g); g.connect(api.ctx.destination);
    o.start(); o.stop(api.ctx.currentTime + dur);
  };
  api.chime = (notes) => {
    if (!api.ctx || api.muted) return;
    notes.forEach((f, i) => setTimeout(() => api.blip(f, 0.18, 'triangle', 0.18), i * 110));
  };
  api.noise = (dur = 0.25, vol = 0.25) => {
    if (!api.ctx || api.muted) return;
    const len = Math.floor(api.ctx.sampleRate * dur);
    const buf = api.ctx.createBuffer(1, len, api.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = api.ctx.createBufferSource(); src.buffer = buf;
    const g = api.ctx.createGain(); g.gain.value = vol;
    const lp = api.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    src.connect(lp); lp.connect(g); g.connect(api.ctx.destination);
    src.start();
  };
  // two-tone police siren, looping while wanted
  api.siren = (() => {
    let timer = null, high = false;
    return {
      start() {
        if (!api.ctx || timer) return;
        timer = setInterval(() => {
          high = !high;
          api.blip(high ? 880 : 660, 0.32, 'sine', 0.045);
        }, 340);
      },
      stop() { clearInterval(timer); timer = null; },
    };
  })();
  return api;
}
