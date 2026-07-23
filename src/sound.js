// sound.js — a synthesized "ka-ching" cash-register sound played on each tap.
// No asset file: it's built with the Web Audio API, so there's nothing to
// download and no license to clear. Two parts fired in sequence:
//   "ka"    -> a short mechanical click (a filtered white-noise burst)
//   "ching" -> a bright two-tone bell that rings and decays, a beat later
// The AudioContext is created lazily and resumed on the first gesture (browsers
// block audio before that), everything runs through a master compressor so rapid
// taps never clip, and playback is throttled so fast clicking stays pleasant.

let ctx = null;
let master = null;
let noiseBuf = null;
let last = 0;
const MIN_GAP = 60; // ms between plays, so fast tapping doesn't machine-gun

function ensureCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createDynamicsCompressor();   // tame overlapping ka-chings
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// small reusable white-noise buffer for the mechanical "ka" click
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(ac.sampleRate * 0.05);   // 50ms
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export function playCash() {
  const nowMs = performance.now();
  if (nowMs - last < MIN_GAP) return;
  last = nowMs;

  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;

  // ---- "ka": a short mechanical click (filtered noise burst) ----
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const kaFilter = ac.createBiquadFilter();
  kaFilter.type = "lowpass";
  kaFilter.frequency.value = 1300;
  const kaGain = ac.createGain();
  kaGain.gain.setValueAtTime(0.0001, t);
  kaGain.gain.exponentialRampToValueAtTime(0.2, t + 0.002);
  kaGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  src.connect(kaFilter).connect(kaGain).connect(master);
  src.start(t);
  src.stop(t + 0.06);

  // ---- "ching": a bright two-tone bell a hair after the ka ----
  const chingAt = t + 0.05;
  const bell = ac.createGain();
  bell.gain.setValueAtTime(0.0001, chingAt);
  bell.gain.exponentialRampToValueAtTime(0.13, chingAt + 0.005);
  bell.gain.exponentialRampToValueAtTime(0.0001, chingAt + 0.3);
  bell.connect(master);

  // two detuned high tones ringing together read as a register "ching"
  for (const f of [2550, 3400]) {
    const o = ac.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    o.connect(bell);
    o.start(chingAt);
    o.stop(chingAt + 0.32);
  }
}
