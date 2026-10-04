// Tiny procedural background loop: a bouncy marimba-ish tune over an "oom-pah" bass.
// Everything is synthesised with WebAudio, so there are no audio files to ship.
const STORE_KEY = 'disc-it-music';
const BPM = 116;
const STEP = 60 / BPM / 2; // eighth note
const LOOKAHEAD = 0.3;

// Semitones above C4 (C major pentatonic); null = rest, 'b' = a slidey "boing".
const MELODY = [
  [7, null, 12, 9, 7, null, 4, null],
  [9, null, 12, 16, 14, null, 12, 9],
  [9, null, 12, 9, 7, null, 9, 12],
  [14, 12, null, 9, 7, null, 2, null],
  [12, null, 16, 12, 9, null, 7, 9],
  [12, 14, null, 16, 19, null, 16, null],
  [12, null, 9, 12, 9, null, 7, 4],
  [14, null, 'b', null, 7, 4, 2, 0],
];
// Bass roots (semitones from C2) for C, Am, F, G, repeated.
const ROOTS = [0, -3, -7, -5, 0, -3, -7, -5];

const mtof = semis => 261.63 * 2 ** (semis / 12);

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    return { volume: Math.min(1, Math.max(0, Number(saved?.volume ?? 0.5))), muted: Boolean(saved?.muted) };
  } catch { return { volume: 0.5, muted: false }; }
}

export function createMusic() {
  const prefs = loadPrefs();
  let ctx = null;
  let master = null;
  let noise = null;
  let timer = 0;
  let nextTime = 0;
  let step = 0;
  const listeners = new Set();

  const level = () => (prefs.muted ? 0 : prefs.volume * prefs.volume * 0.5);
  const emit = () => listeners.forEach(fn => fn({ ...prefs }));
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); } catch { /* private mode */ } };
  const applyLevel = () => { if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.05); };

  function env(node, t, peak, decay) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.linearRampToValueAtTime(peak, t + 0.006);
    node.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  function tone(type, freq, t, peak, decay, slideTo) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + decay * 0.8);
    env(g, t, peak, decay);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  function marimba(freq, t) {
    tone('sine', freq, t, 0.34, 0.42);
    tone('triangle', freq * 4, t, 0.07, 0.12); // woody "tock"
  }

  function hat(t, accent) {
    const src = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noise;
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    env(g, t, accent ? 0.1 : 0.05, 0.05);
    src.connect(hp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.08);
  }

  function schedule(i, t) {
    const bar = Math.floor(i / 8) % MELODY.length;
    const beat = i % 8;
    const root = ROOTS[bar];
    // Bass: bouncy root / fifth on the beats, a little pickup on the "and" of 3.
    if (beat % 2 === 0) tone('triangle', mtof(root - 24 + (beat % 4 ? 7 : 0)), t, 0.5, STEP * 1.6);
    if (beat === 5) tone('triangle', mtof(root - 12), t, 0.3, STEP);
    // Soft kick on 1 and 3, hats on the off-beats.
    if (beat === 0 || beat === 4) tone('sine', 110, t, 0.55, 0.14, 45);
    if (beat % 2 === 1) hat(t, beat === 3);
    const note = MELODY[bar][beat];
    if (note === 'b') tone('sine', mtof(0), t, 0.3, 0.3, mtof(12));
    else if (note !== null) marimba(mtof(note), t);
  }

  function tick() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      schedule(step, nextTime);
      nextTime += STEP;
      step = (step + 1) % (MELODY.length * 8);
    }
  }

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(tick, 60);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }

  return {
    start,
    getState: () => ({ ...prefs }),
    setVolume(v) { prefs.volume = Math.min(1, Math.max(0, v)); if (prefs.volume > 0) prefs.muted = false; applyLevel(); save(); emit(); },
    toggleMute() { prefs.muted = !prefs.muted; applyLevel(); save(); emit(); },
    subscribe(fn) { listeners.add(fn); fn({ ...prefs }); return () => listeners.delete(fn); },
    dispose() { clearInterval(timer); ctx?.close(); },
  };
}
