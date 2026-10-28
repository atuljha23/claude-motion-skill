// Shared audio analysis: decode, onset envelopes, tempo, kick-fitted beat grid, per-bar energy, lifts and key.
// Pure Node + ffmpeg, no packages. Used by beat.mjs, music_search.mjs and ref_video.mjs.
import { execFileSync } from "node:child_process";

export function decode(file, sr = 22050, { start, dur } = {}) {
  const pre = [];
  if (start != null) pre.push("-ss", String(start));
  if (dur != null) pre.push("-t", String(dur));
  const raw = execFileSync("ffmpeg", ["-v", "error", ...pre, "-i", file, "-vn", "-ac", "1", "-ar", String(sr), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

// Full-band and low-band (one-pole low-pass at lpHz) RMS envelopes on a hop of hopS seconds.
export function envelopes(x, sr, hopS = 0.01, lpHz = 150) {
  const hop = Math.round(sr * hopS);
  const n = Math.floor(x.length / hop);
  const full = new Float64Array(n);
  const low = new Float64Array(n);
  const a = Math.exp((-2 * Math.PI * lpHz) / sr);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    let sf = 0;
    let sl = 0;
    for (let j = i * hop; j < (i + 1) * hop; j++) {
      lp = (1 - a) * x[j] + a * lp;
      sf += x[j] * x[j];
      sl += lp * lp;
    }
    full[i] = Math.sqrt(sf / hop);
    low[i] = Math.sqrt(sl / hop);
  }
  return { full, low, hopS, n };
}

// Onset strength: positive change of log energy, weighted towards the low band (kick and bass).
function onsets(env) {
  const { full, low, n } = env;
  const on = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const df = Math.log(full[i] + 1e-6) - Math.log(full[i - 1] + 1e-6);
    const dl = Math.log(low[i] + 1e-6) - Math.log(low[i - 1] + 1e-6);
    on[i] = Math.max(0, df) * 0.4 + Math.max(0, dl) * 0.6;
  }
  return on;
}

// Tempo by autocorrelation of the onset envelope, refined with a comb over the whole track.
// `prefer` folds double/half tempos towards a range (default 90-150 BPM); pass a target BPM to fold towards it instead.
export function tempo(x, sr, { prefer = [90, 150], target } = {}) {
  const env = envelopes(x, sr, 0.01);
  const on = onsets(env);
  const n = env.n;
  let best = { bpm: 0, s: -1 };
  for (let bpm = 60; bpm <= 190; bpm += 0.1) {
    const lag = 6000 / bpm;
    let s = 0;
    for (let i = 0; i + lag * 4 < n; i++) s += on[i] * on[Math.round(i + lag)];
    if (s > best.s) best = { bpm, s };
  }
  let bpm = best.bpm;
  if (target) {
    const c = [bpm / 2, bpm, bpm * 2].sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
    bpm = c[0];
  } else {
    while (bpm < prefer[0]) bpm *= 2;
    while (bpm > prefer[1]) bpm /= 2;
  }
  const comb = (b, phase) => {
    const lag = 6000 / b;
    let s = 0;
    for (let k = 0; ; k++) {
      const i = Math.round(phase + k * lag);
      if (i >= n) break;
      s += on[i] + 0.5 * (on[i - 1] ?? 0) + 0.5 * (on[i + 1] ?? 0);
    }
    return s;
  };
  let ref = { bpm, phase: 0, s: -1 };
  for (let b = bpm - 1.5; b <= bpm + 1.5; b += 0.02) {
    const lag = 6000 / b;
    for (let p = 0; p < lag; p++) {
      const s = comb(b, p);
      if (s > ref.s) ref = { bpm: b, phase: p, s };
    }
  }
  return { bpm: ref.bpm, beat: 60 / ref.bpm, phase: ref.phase / 100, env };
}

// Kick onsets (2 ms resolution) from the low band.
export function kicks(x, sr) {
  const env = envelopes(x, sr, 0.002, 120);
  const { low, n } = env;
  const on = new Float64Array(n);
  for (let i = 4; i < n; i++) on[i] = Math.max(0, low[i] - low[i - 4]);
  const sorted = Float64Array.from(on).sort();
  const thr = sorted[Math.floor(sorted.length * 0.99)] * 0.35;
  const out = [];
  for (let i = 30; i < n - 30; i++) {
    if (on[i] < thr) continue;
    let isMax = true;
    for (let j = i - 30; j <= i + 30; j++) if (on[j] > on[i]) { isMax = false; break; }
    if (isMax) out.push(i * 0.002);
  }
  return out;
}

// Fits a beat grid to kick onsets near an estimated tempo: grid search, then least squares on matched kicks.
// Returns { bpm, beat, phase (time of beat 0), matched, total, rmsMs } or null when there are too few kicks.
export function fitGrid(ks, bpmGuess, span = 1.5) {
  if (ks.length < 8) return null;
  const score = (bpm, ph) => {
    const beat = 60 / bpm;
    let s = 0;
    for (const k of ks) {
      const d = ((((k - ph) / beat) % 1) + 1) % 1;
      const e = Math.min(d, 1 - d) * beat;
      if (e < 0.025) s += 1 - e / 0.025;
    }
    return s;
  };
  // Coarse pass, then a fine pass around the winner.
  let best = { s: -1 };
  for (let bpm = bpmGuess - span; bpm <= bpmGuess + span; bpm += 0.02)
    for (let ph = 0; ph < 60 / bpm; ph += 0.008) {
      const s = score(bpm, ph);
      if (s > best.s) best = { s, bpm, ph };
    }
  const c = best;
  for (let bpm = c.bpm - 0.03; bpm <= c.bpm + 0.03; bpm += 0.002)
    for (let ph = c.ph - 0.012; ph <= c.ph + 0.012; ph += 0.002) {
      const s = score(bpm, ph);
      if (s > best.s) best = { s, bpm, ph };
    }
  const beat = 60 / best.bpm;
  const pts = [];
  for (const k of ks) {
    const idx = Math.round((k - best.ph) / beat);
    if (Math.abs(k - (best.ph + idx * beat)) < 0.03) pts.push([idx, k]);
  }
  if (pts.length < 6) return null;
  const N = pts.length;
  const sx = pts.reduce((p, q) => p + q[0], 0);
  const sy = pts.reduce((p, q) => p + q[1], 0);
  const sxx = pts.reduce((p, q) => p + q[0] * q[0], 0);
  const sxy = pts.reduce((p, q) => p + q[0] * q[1], 0);
  const slope = (N * sxy - sx * sy) / (N * sxx - sx * sx);
  let icpt = (sy - slope * sx) / N;
  icpt -= Math.floor(icpt / slope) * slope; // first beat at or after 0
  const rms = Math.sqrt(pts.reduce((p, [i, k]) => p + (k - (icpt + i * slope)) ** 2, 0) / N);
  return { bpm: 60 / slope, beat: slope, phase: icpt, matched: N, total: ks.length, rmsMs: rms * 1000 };
}

// Mean full/low energy per bar (4 beats), normalised to the loudest bar.
export function bars(env, beat, phase) {
  const out = [];
  const per = 1 / env.hopS;
  for (let k = 0; ; k++) {
    const t0 = phase + k * 4 * beat;
    const i0 = Math.round(t0 * per);
    const i1 = Math.round((t0 + 4 * beat) * per);
    if (i1 > env.n) break;
    let ef = 0;
    let el = 0;
    for (let i = i0; i < i1; i++) {
      ef += env.full[i];
      el += env.low[i];
    }
    out.push({ bar: k + 1, t: t0, full: ef / (i1 - i0), low: el / (i1 - i0) });
  }
  const mf = Math.max(...out.map((b) => b.full), 1e-9);
  const ml = Math.max(...out.map((b) => b.low), 1e-9);
  for (const b of out) {
    b.full /= mf;
    b.low /= ml;
  }
  return out;
}

// Lifts: bars whose energy jumps clearly above the two bars before (a band coming in, a drop).
// Drops-outs (sudden quiet bars) are returned too, because a gap before a drop is a strong edit point.
export function lifts(bs, { rise = 0.18 } = {}) {
  const up = [];
  const down = [];
  for (let i = 2; i < bs.length; i++) {
    const prev = (bs[i - 1].full + bs[i - 2].full) / 2;
    const e = 0.5 * bs[i].full + 0.5 * bs[i].low;
    const pe = 0.5 * prev + 0.5 * (bs[i - 1].low + bs[i - 2].low) / 2;
    if (e - pe > rise) up.push({ bar: bs[i].bar, t: bs[i].t, jump: +(e - pe).toFixed(2) });
    if (pe - e > rise + 0.1) down.push({ bar: bs[i].bar, t: bs[i].t, fall: +(pe - e).toFixed(2) });
  }
  return { up, down };
}

// Musical key from chroma (Krumhansl profiles). Returns [{ key, r }] best first.
export function key(x, sr) {
  const N = 8192;
  const fft = (re, im) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = (-2 * Math.PI) / len;
      for (let i = 0; i < n; i += len)
        for (let k = 0; k < len / 2; k++) {
          const c = Math.cos(a * k), s = Math.sin(a * k);
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * c - im[i + k + len / 2] * s;
          const vi = re[i + k + len / 2] * s + im[i + k + len / 2] * c;
          re[i + k] = ur + vr;
          im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr;
          im[i + k + len / 2] = ui - vi;
        }
    }
  };
  const chroma = new Float64Array(12);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const step = Math.max(N / 2, Math.floor(x.length / 400)); // cap the work on long files
  for (let off = 0; off + N <= x.length; off += step) {
    for (let i = 0; i < N; i++) {
      re[i] = x[off + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 1; b < N / 2; b++) {
      const f = (b * sr) / N;
      if (f < 80 || f > 2000) continue;
      const pc = ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
      chroma[pc] += Math.hypot(re[b], im[b]);
    }
  }
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const corr = (a, b) => {
    const ma = a.reduce((s, v) => s + v, 0) / 12;
    const mb = b.reduce((s, v) => s + v, 0) / 12;
    let nn = 0, da = 0, db = 0;
    for (let i = 0; i < 12; i++) {
      nn += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) ** 2;
      db += (b[i] - mb) ** 2;
    }
    return nn / Math.sqrt(da * db);
  };
  const res = [];
  for (let k = 0; k < 12; k++) {
    const rot = Array.from({ length: 12 }, (_, i) => chroma[(i + k) % 12]);
    res.push({ key: names[k] + " major", r: corr(rot, MAJ) }, { key: names[k] + " minor", r: corr(rot, MIN) });
  }
  return res.sort((a, b) => b.r - a.r);
}

// One-call analysis used by the CLIs.
export function analyse(file, { target, sr = 22050, dur } = {}) {
  const x = decode(file, sr, { dur });
  const tp = tempo(x, sr, target ? { target } : {});
  const fit = fitGrid(kicks(x, sr), tp.bpm);
  // Trust the kick fit when it locks well; otherwise keep the onset tempo.
  const grid = fit && fit.rmsMs < 12 && fit.matched > 20 ? { ...fit, source: "kicks" } : { bpm: tp.bpm, beat: tp.beat, phase: tp.phase, source: "onsets" };
  const bs = bars(tp.env, grid.beat, grid.phase);
  return { file, duration: x.length / sr, grid, fit, bars: bs, lifts: lifts(bs), key: key(x, sr).slice(0, 3) };
}

export const bar = (v, w = 24) => "#".repeat(Math.round(v * w)).padEnd(w);
