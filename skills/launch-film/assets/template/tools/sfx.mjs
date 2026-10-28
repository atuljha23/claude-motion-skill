// Synthesises the sound-effect track from out/<variant>/cues.json (written by `render.mjs cues`). No samples, no downloads:
// every sound is built here from sines, filtered noise and envelopes, seeded so each render is identical.
// Tonal sounds use the pentatonic scale of the song's key (CONFIG.music.key, measured with the skill's beat.mjs).
// Voice cues (type "voice", file = a name in assets/voice) go to a separate stem so the mix can duck the music under them.
// Each sound is levelled against the music under it: the music can swing 25 dB between a breakdown and a drop.
// Usage: node tools/sfx.mjs [--variant v] [--verbose]   ->  out/<variant>/sfx.wav and voice.wav (48 kHz stereo float)
// Add a sound: write a function in S below and give it a level in LEVEL.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const VARIANT = args.includes("--variant") ? args[args.indexOf("--variant") + 1] : "";
const OUT = path.join(ROOT, "out", VARIANT || "main");
const SR = 48000;

const { film, cues } = JSON.parse(await readFile(path.join(OUT, "cues.json"), "utf8"));
const MUSIC = path.resolve(ROOT, film.music);
const LEN = Math.ceil((film.duration + 1.5) * SR);
const L = new Float32Array(LEN);
const R = new Float32Array(LEN);
// Each cue is first drawn into a scratch buffer, measured against the music under it, then mixed in at its target level.
const TL = new Float32Array(LEN);
const TR = new Float32Array(LEN);
let lo = LEN;
let hi = 0;

// Notes from the key, e.g. "A minor" or "F# major". Minor pentatonic: 0 3 5 7 10; major: 0 2 4 7 9 (semitones).
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const [kRoot, kMode] = String(film.key || "A minor").trim().split(/\s+/);
const flat = { "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#" };
const rootPc = Math.max(0, NAMES.indexOf(flat[kRoot] ?? kRoot));
const minor = !/maj/i.test(kMode || "minor");
const SCALE = minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
// Frequency of scale degree d (0 = root) counted up from the root in octave `oct` (A4 = 440 Hz).
const hz = (oct, semis) => 440 * Math.pow(2, (rootPc + semis + 12 * (oct - 4) - 9) / 12);
const deg = (oct, d) => hz(oct + Math.floor(d / 5), SCALE[((d % 5) + 5) % 5]);
const TRIAD = minor ? [3, 7, 10] : [0, 4, 7]; // a bright chord: the relative major in a minor key
const N = { R2: hz(2, 0), R3: hz(3, 0), R4: hz(4, 0), T5: TRIAD.map((x) => hz(5, x)), T6: TRIAD.map((x) => hz(6, x)), FIFTH6: hz(6, 7), R6: hz(6, 0), R7: hz(7, 0) };
const NODE_NOTES = [0, 1, 2, 3, 4, 5].map((d) => deg(5, d));

// Seeded noise.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pan = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)];
const add = (i, v, p = 0) => {
  if (i < 0 || i >= LEN) return;
  const [gl, gr] = pan(p);
  TL[i] += v * gl;
  TR[i] += v * gr;
  if (i < lo) lo = i;
  if (i > hi) hi = i;
};

// RBJ band-pass whose centre can move every sample.
function bandpass(q) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, fc) => {
    const w = (2 * Math.PI * Math.min(fc, SR * 0.45)) / SR;
    const al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}
const onePoleLP = (fc) => {
  const a = Math.exp((-2 * Math.PI * fc) / SR);
  let y = 0;
  return (x) => (y = (1 - a) * x + a * y);
};

// A struck tone: sine with a couple of partials and an exponential decay.
function bell(t0, f, amp, tau, p = 0, partials = [[2, 0.18, 0.5], [3.01, 0.06, 0.3]]) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(tau * 7 * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const att = Math.min(1, t / 0.0025);
    let v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / tau);
    for (const [m, a, td] of partials) v += a * Math.sin(2 * Math.PI * f * m * t) * Math.exp(-t / (tau * td));
    add(i0 + k, amp * att * v, p);
  }
}
// Filtered noise with an envelope function env(u) over `dur`, band centre fc(u), pan pn(u).
function noise(t0, dur, amp, env, fc, q = 1.2, pn = () => 0, seed = 1) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  const r = rng(seed);
  const bp = bandpass(q);
  for (let k = 0; k < n; k++) {
    const u = k / n;
    add(i0 + k, amp * env(u) * bp(r() * 2 - 1, fc(u)) * 2.2, pn(u));
  }
}
function click(t0, amp, fc = 3500, p = 0, seed = 7) {
  const i0 = Math.round(t0 * SR);
  const r = rng(seed);
  const bp = bandpass(0.9);
  for (let k = 0; k < SR * 0.012; k++) {
    const t = k / SR;
    add(i0 + k, amp * bp(r() * 2 - 1, fc) * Math.exp(-t / 0.0018) * 3, p);
  }
}
function tone(t0, dur, amp, freq, env, p = 0) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const u = k / n;
    ph += (2 * Math.PI * freq(u)) / SR;
    add(i0 + k, amp * env(u) * Math.sin(ph), p);
  }
}

const S = {
  shimmer(t, g, _n, i) {
    noise(t, 0.9, 0.12 * g, (u) => Math.sin(Math.PI * u) ** 2, (u) => 5200 + 3000 * u, 3, (u) => -0.7 + 1.4 * u, 121 + i);
    [N.R7, N.T6[1] * 2, N.T6[0] * 2].forEach((f, k) => bell(t + 0.12 + k * 0.09, f, 0.035 * g, 0.25, -0.5 + k * 0.5, []));
  },
  tap(t, g) {
    click(t, 0.32 * g, 3200);
    bell(t, 1400, 0.16 * g, 0.012, 0, []);
    bell(t, 700, 0.12 * g, 0.02, 0, []);
  },
  pop(t, g, _n, i) {
    const p = [-0.35, 0.35, -0.1][i % 3];
    const i0 = Math.round(t * SR);
    let ph = 0;
    for (let k = 0; k < SR * 0.16; k++) {
      const tt = k / SR;
      ph += (2 * Math.PI * (430 + 420 * (1 - Math.exp(-tt / 0.014)))) / SR;
      add(i0 + k, 0.42 * g * Math.min(1, tt / 0.002) * Math.exp(-tt / 0.045) * Math.sin(ph), p);
    }
    click(t, 0.12 * g, 2500, p, 11 + i);
  },
  riser(t, g) {
    const d = 1.94;
    noise(t, d, 0.3 * g, (u) => u * u * (u < 0.985 ? 1 : (1 - u) / 0.015), (u) => 300 * Math.pow(18, u), 2.5, (u) => 0.4 * Math.sin(u * 9), 21);
    noise(t, d, 0.22 * g, (u) => u * u * (u < 0.985 ? 1 : (1 - u) / 0.015), (u) => 350 * Math.pow(16, u), 2.5, (u) => -0.4 * Math.sin(u * 9), 22);
    tone(t + 0.4, d - 0.4, 0.05 * g, (u) => N.R3 * Math.pow(4, u), (u) => u * u * (u < 0.97 ? 1 : (1 - u) / 0.03));
  },
  suck(t, g, _n, i) {
    noise(t, 0.28, 0.24 * g, (u) => Math.sin(Math.PI * u) ** 2, (u) => 2400 - 1700 * u, 2, () => [-0.3, 0.3, 0][i % 3], 31 + i);
  },
  impact(t, g) {
    const i0 = Math.round(t * SR);
    let ph = 0;
    const lp = onePoleLP(260);
    const r = rng(41);
    for (let k = 0; k < SR * 1.2; k++) {
      const tt = k / SR;
      ph += (2 * Math.PI * (48 + 70 * Math.exp(-tt / 0.06))) / SR;
      const body = Math.sin(ph) * Math.exp(-tt / 0.32) * Math.min(1, tt / 0.003);
      const thud = lp(r() * 2 - 1) * Math.exp(-tt / 0.05) * 2.5;
      add(i0 + k, g * (0.55 * body + 0.35 * thud));
    }
    noise(t, 0.5, 0.06 * g, (u) => Math.exp(-u * 6), () => 6000, 0.8, () => 0, 43);
  },
  whoosh(t, g, _n, i) {
    noise(t - 0.12, 0.5, 0.26 * g, (u) => Math.sin(Math.PI * u) ** 2, (u) => 700 + 2600 * Math.sin(Math.PI * u), 1.6, (u) => -0.6 + 1.2 * u, 51 + i);
  },
  swish(t, g, _n, i) {
    noise(t, 0.3, 0.2 * g, (u) => Math.sin(Math.PI * Math.min(1, u * 1.3)) ** 2, (u) => 1100 + 1800 * u, 1.8, (u) => 0.5 - u, 61 + i);
  },
  sheet(t, g, _n, i) {
    noise(t, 0.26, 0.17 * g, (u) => Math.sin(Math.PI * u) ** 1.5, (u) => 1400 + 2600 * u, 2, () => 0, 71 + i);
  },
  sheetDown(t, g, _n, i) {
    noise(t, 0.24, 0.15 * g, (u) => Math.sin(Math.PI * u) ** 1.5, (u) => 3800 - 2400 * u, 2, () => 0, 81 + i);
  },
  select(t, g) {
    click(t, 0.2 * g, 4200);
    bell(t + 0.005, deg(6, 2), 0.12 * g, 0.06, 0, [[2, 0.1, 0.4]]);
  },
  success(t, g) {
    bell(t, N.FIFTH6, 0.16 * g, 0.3, -0.15);
    bell(t + 0.09, N.R7, 0.15 * g, 0.42, 0.15);
  },
  tick(t, g) {
    click(t, 0.2 * g, 5200);
    bell(t, 2490, 0.05 * g, 0.01, 0, []);
  },
  node(t, g, note) {
    bell(t, NODE_NOTES[note % NODE_NOTES.length], 0.17 * g, 0.2, 0, [[4, 0.22, 0.15], [2, 0.08, 0.5]]);
    click(t, 0.06 * g, 3000);
  },
  chime(t, g) {
    bell(t, N.T6[0], 0.15 * g, 0.5, -0.2);
    bell(t + 0.11, N.T6[1], 0.14 * g, 0.5, 0);
    bell(t + 0.22, N.T6[2], 0.13 * g, 0.6, 0.2);
  },
  key(t, g, _n, i) {
    const r = rng(91 + i);
    click(t, (0.16 + 0.06 * r()) * g, 2600 + 1400 * r(), (r() - 0.5) * 0.3, 92 + i);
    bell(t, 170 + 30 * r(), 0.07 * g, 0.014, 0, []);
  },
  riser2(t, g) {
    noise(t, 0.48, 0.3 * g, (u) => u * u * u * (u < 0.97 ? 1 : (1 - u) / 0.03), (u) => 500 * Math.pow(16, u), 2.2, (u) => -0.5 + u, 101);
  },
  thump(t, g, _n, i) {
    bell(t, 180, 0.2 * g, 0.05, 0, [[4, 0.3, 0.4]]);
    click(t, 0.08 * g, 1800, 0, 111 + i);
  },
  boing(t, g, _n, i) {
    const i0 = Math.round(t * SR);
    let ph = 0;
    for (let k = 0; k < SR * 0.45; k++) {
      const tt = k / SR;
      const f = deg(4, 2) * (1 + 0.5 * Math.exp(-tt / 0.03)) * (1 + 0.06 * Math.sin(2 * Math.PI * 9 * tt) * Math.exp(-tt / 0.25));
      ph += (2 * Math.PI * f) / SR;
      add(i0 + k, 0.35 * g * Math.min(1, tt / 0.003) * Math.exp(-tt / 0.14) * Math.sin(ph), [-0.3, 0.3, 0][i % 3]);
    }
  },
  paper(t, g, _n, i) {
    noise(t, 0.35, 0.16 * g, (u) => Math.sin(Math.PI * u) ** 2 * (0.7 + 0.3 * Math.sin(u * 40)), (u) => 2500 + 2500 * u, 0.9, (u) => 0.3 - 0.6 * u, 131 + i);
  },
  end(t, g) {
    const i0 = Math.round(t * SR);
    let ph = 0;
    for (let k = 0; k < SR * 1.6; k++) {
      const tt = k / SR;
      ph += (2 * Math.PI * (N.R2 * 0.5 + 40 * Math.exp(-tt / 0.05))) / SR;
      add(i0 + k, 0.4 * g * Math.sin(ph) * Math.exp(-tt / 0.45) * Math.min(1, tt / 0.004));
    }
    const chord = [0, minor ? 3 : 4, 7, 12].map((x) => hz(4, x));
    chord.forEach((f, k) => bell(t + k * 0.015, f, (0.07 - k * 0.006) * g, 0.9, [-0.3, 0.3, -0.1, 0.1][k]));
  },
};

// Level of each sound relative to the music under it: [measure from (s after cue), window (s), target dB].
// The music swings ~25 dB between the drops and the breakdown, so fixed gains would vanish or shout.
const LEVEL = {
  tap: [0, 0.08, -13], pop: [0, 0.12, -9], node: [0, 0.15, -11], riser: [1.5, 0.4, -8], suck: [0, 0.2, -13],
  impact: [0, 0.15, -5], whoosh: [-0.12, 0.3, -12], swish: [0, 0.2, -13], sheet: [0, 0.2, -14], sheetDown: [0, 0.2, -15],
  select: [0, 0.1, -12], success: [0, 0.2, -8], tick: [0, 0.06, -14], chime: [0, 0.3, -5], key: [0, 0.05, -15],
  riser2: [0.15, 0.3, -10], thump: [0, 0.1, -14], end: [0, 0.4, -4], shimmer: [0.2, 0.5, -14], boing: [0, 0.15, -11], paper: [0, 0.2, -14],
};
const DEFAULT_LEVEL = [0, 0.15, -12];
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", MUSIC, "-af", `atrim=start=${film.songStart}:duration=${film.duration + 1},asetpts=PTS-STARTPTS`, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
const music = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const db = (get, t, d) => {
  const a = Math.max(0, Math.round(t * SR));
  const b = Math.round((t + d) * SR);
  let sum = 0;
  for (let i = a; i < b; i++) sum += get(i) ** 2;
  return 10 * Math.log10(sum / Math.max(1, b - a) + 1e-12);
};
const count = {};
const report = [];
// Voice stem: the clips as they are, at a fixed level (the mix ducks the music under them).
const VL = new Float32Array(LEN);
for (const c of cues.filter((c) => c.type === "voice")) {
  const vf = [c.file, path.join(ROOT, "assets/voice", c.file), path.join(ROOT, "assets/voice", c.file + ".mp3"), path.join(ROOT, "assets/voice", c.file + ".wav")].map((f) => path.resolve(ROOT, f)).find((f) => existsSync(f));
  if (!vf) throw new Error("voice clip not found: " + c.file);
  const vr = execFileSync("ffmpeg", ["-v", "error", "-i", vf, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const v = new Float32Array(vr.buffer, vr.byteOffset, vr.byteLength / 4);
  const i0 = Math.round(c.t * SR);
  for (let k = 0; k < v.length && i0 + k < LEN; k++) if (i0 + k >= 0) VL[i0 + k] += v[k] * c.gain;
}
for (const c of cues) {
  if (c.type === "voice") continue;
  const fn = S[c.type];
  if (!fn) throw new Error("no sound for cue type " + c.type);
  count[c.type] = (count[c.type] ?? -1) + 1;
  fn(c.t, 1, c.note ?? 0, count[c.type]);
  const [off, d, target] = LEVEL[c.type] ?? DEFAULT_LEVEL;
  // The end sting is measured against the music just before the fade, not the fade itself.
  const musicDb = db((i) => music[i] || 0, c.type === "end" ? c.t - d : c.t + off, d);
  const sfxDb = db((i) => (TL[i] + TR[i]) / 2, c.t + off, d);
  const gainDb = Math.max(-30, Math.min(24, target - (sfxDb - musicDb))) + 20 * Math.log10(c.gain);
  const g = 10 ** (gainDb / 20);
  for (let i = lo; i <= hi; i++) {
    L[i] += TL[i] * g;
    R[i] += TR[i] * g;
    TL[i] = 0;
    TR[i] = 0;
  }
  lo = LEN;
  hi = 0;
  report.push(`${c.t.toFixed(2).padStart(6)} ${c.type.padEnd(9)} music ${musicDb.toFixed(1).padStart(6)} dB, gain ${gainDb.toFixed(1).padStart(6)} dB`);
}
if (args.includes("--verbose")) console.log(report.join("\n"));

// 32-bit float WAV.
function wav(Lc, Rc) {
  const data = Buffer.alloc(LEN * 8);
  for (let i = 0; i < LEN; i++) {
    data.writeFloatLE(Lc[i], i * 8);
    data.writeFloatLE(Rc[i], i * 8 + 4);
  }
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0);
  hdr.writeUInt32LE(36 + data.length, 4);
  hdr.write("WAVE", 8);
  hdr.write("fmt ", 12);
  hdr.writeUInt32LE(16, 16);
  hdr.writeUInt16LE(3, 20);
  hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(SR, 24);
  hdr.writeUInt32LE(SR * 8, 28);
  hdr.writeUInt16LE(8, 32);
  hdr.writeUInt16LE(32, 34);
  hdr.write("data", 36);
  hdr.writeUInt32LE(data.length, 40);
  return Buffer.concat([hdr, data]);
}
await writeFile(path.join(OUT, "voice.wav"), wav(VL, VL));
let peak = 0;
for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
await writeFile(path.join(OUT, "sfx.wav"), wav(L, R));
console.log(`${cues.length} cues, peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS -> ${path.join(OUT, "sfx.wav")}`);
