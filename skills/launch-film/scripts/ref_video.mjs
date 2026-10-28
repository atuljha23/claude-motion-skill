// Measures a reference video so a new film can borrow its rhythm and look (never its footage, music or copy):
// format, shot lengths, cuts per bar and how many cuts land on the beat, the tempo of its music, a pace curve,
// the colour palette (ground, ink, accents) and a contact sheet with one frame per shot for Claude to look at.
// Usage:
//   node ref_video.mjs <video file | URL> [--out ref] [--scene 0.3] [--max-shots 36]
// URLs need yt-dlp on PATH. Writes <out>/style-card.md, style-card.json, sheet-NN.png (frames listed in the card).
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { analyse } from "./lib/audio.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes("--" + n) ? args[args.indexOf("--" + n) + 1] : d);
let input = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!input) {
  console.log("usage: node ref_video.mjs <video file | URL> [--out ref] [--scene 0.3] [--max-shots 36]");
  process.exit(1);
}
const OUT = path.resolve(opt("out", "ref"));
const SCENE = Number(opt("scene", 0.3));
const MAXSHOTS = Number(opt("max-shots", 36));
await mkdir(OUT, { recursive: true });

if (/^https?:\/\//.test(input)) {
  const has = spawnSync("yt-dlp", ["--version"]).status === 0;
  if (!has) throw new Error("This is a URL and yt-dlp isn't installed. Install it (brew install yt-dlp / pipx install yt-dlp) or download the video and pass the file.");
  execFileSync("yt-dlp", ["-q", "-f", "bv*[height<=1920]+ba/b", "--merge-output-format", "mp4", "-o", path.join(OUT, "reference.%(ext)s"), input], { stdio: "inherit" });
  input = path.join(OUT, (await readdir(OUT)).find((f) => f.startsWith("reference.")));
}

// --- Format
const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", input]).toString());
const vs = probe.streams.find((s) => s.codec_type === "video");
const hasAudio = probe.streams.some((s) => s.codec_type === "audio");
const [fn, fd] = (vs.avg_frame_rate || vs.r_frame_rate).split("/").map(Number);
const fps = fd ? fn / fd : fn;
const dur = Number(probe.format.duration);
let W = vs.width, H = vs.height;
const rot = Number(vs.tags?.rotate ?? vs.side_data_list?.find((d) => d.rotation != null)?.rotation ?? 0);
if (Math.abs(rot) === 90) [W, H] = [H, W];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const ratio = `${W / gcd(W, H)}:${H / gcd(W, H)}`;

// --- Per-frame scene score (one pass on a small copy): cuts are frames above the threshold, pace is the score over time.
const meta = spawnSync("ffmpeg", ["-v", "error", "-i", input, "-an", "-vf", "scale=240:-2,select='gte(scene,0)',metadata=print:file=-", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 }).stdout;
const frames = [];
let cur = null;
for (const line of meta.split("\n")) {
  const t = line.match(/pts_time:([\d.]+)/);
  if (t) cur = { t: Number(t[1]), s: 0 };
  const s = line.match(/lavfi\.scene_score=([\d.]+)/);
  if (s && cur) {
    cur.s = Number(s[1]);
    frames.push(cur);
  }
}
const cuts = [];
for (const f of frames) if (f.s >= SCENE && f.t > 0.05 && (!cuts.length || f.t - cuts[cuts.length - 1] > 0.12)) cuts.push(+f.t.toFixed(3));
// Change events: bursts of on-screen change. Motion-graphics films rarely hard-cut, so their rhythm lives in these
// (a word slamming in, a phone turning, a tile landing). A burst is a local peak over ±0.12 s above the 88th
// percentile; its time is where it starts (the score first passes 40% of the peak), because motion starts on the beat
// and peaks later.
const sortedS = frames.map((f) => f.s).sort((a, b) => a - b);
const evThr = Math.max(0.004, sortedS[Math.floor(sortedS.length * 0.88)] ?? 0);
const perS = frames.length / Math.max(dur, 1e-3);
const win = Math.max(1, Math.round(0.12 * perS));
const events = [];
frames.forEach((f, i) => {
  if (f.s < evThr) return;
  for (let j = Math.max(0, i - win); j <= Math.min(frames.length - 1, i + win); j++) if (frames[j].s > f.s) return;
  let k = i;
  while (k > 0 && i - k < 0.35 * perS && frames[k - 1].s > 0.4 * f.s) k--;
  const t = +frames[k].t.toFixed(3);
  if (!events.length || t - events[events.length - 1].t > 0.1) events.push({ t, peak: f.s });
});
// The biggest quarter of the bursts: the moves the edit is built around (a phone arriving, a wall of tiles, a cut).
const strongCut = [...events].sort((a, b) => b.peak - a.peak)[Math.floor(events.length / 4)]?.peak ?? Infinity;
const strong = events.filter((e) => e.peak >= strongCut).map((e) => e.t);
const eventTimes = events.map((e) => e.t);
const bounds = [0, ...cuts, dur];
const shots = bounds.slice(1).map((b, i) => ({ i: i + 1, start: +bounds[i].toFixed(3), end: +b.toFixed(3), len: +(b - bounds[i]).toFixed(3) }));
const lens = shots.map((s) => s.len).sort((a, b) => a - b);
const median = lens[Math.floor(lens.length / 2)];
const mean = dur / shots.length;
// Pace: mean scene score per second (movement inside shots plus cuts).
const pace = [];
for (let s = 0; s < Math.ceil(dur); s++) {
  const fr = frames.filter((f) => f.t >= s && f.t < s + 1);
  pace.push(+(fr.reduce((p, f) => p + Math.min(f.s, SCENE), 0) / Math.max(1, fr.length)).toFixed(4));
}
const maxPace = Math.max(...pace, 1e-6);

// --- Music: tempo, grid, and how the cuts sit on it.
let music = null;
if (hasAudio) {
  try {
    const a = analyse(input);
    const g = a.grid;
    const tolS = Math.max(0.07, 2 / fps);
    const fit = (ts) => {
      const off = ts.map((c) => {
        const d = (c - g.phase) / g.beat;
        return { err: (d - Math.round(d)) * g.beat, beat: Math.round(d) };
      });
      const on = off.filter((o) => Math.abs(o.err) <= tolS);
      return { on: ts.length ? +(on.length / ts.length).toFixed(2) : 0, bar: ts.length ? +(on.filter((o) => ((o.beat % 4) + 4) % 4 === 0).length / ts.length).toFixed(2) : 0 };
    };
    const fc = fit(cuts);
    const fe = fit(eventTimes);
    const fs = fit(strong);
    // Where inside the beat things start: 8 bins from the beat onwards. A tall first bin (or a tall bin a little later,
    // from detection lag) means an edit built on the beat; a flat histogram means it isn't.
    const phaseHist = (ts) => {
      const h = new Array(8).fill(0);
      for (const t of ts) h[Math.floor(((((t - g.phase) / g.beat) % 1) + 1) % 1 * 8) % 8]++;
      return h;
    };
    const hAll = phaseHist(eventTimes);
    const peakBin = hAll.indexOf(Math.max(...hAll));
    const concentration = eventTimes.length ? +((hAll[peakBin] + hAll[(peakBin + 1) % 8] + hAll[(peakBin + 7) % 8]) / eventTimes.length).toFixed(2) : 0;
    // By chance alone, a ±tol window catches 2*tol/beat of random times.
    const chance = +Math.min(1, (2 * tolS) / g.beat).toFixed(2);
    const meanBeats = mean / g.beat;
    music = {
      bpm: +g.bpm.toFixed(2),
      beat: +g.beat.toFixed(4),
      phase: +g.phase.toFixed(3),
      grid: g.source,
      key: a.key[0].key,
      cutsOnBeat: fc.on,
      cutsOnBarStart: fc.bar,
      eventsOnBeat: fe.on,
      eventsOnBarStart: fe.bar,
      strongOnBeat: fs.on,
      strongOnBarStart: fs.bar,
      chance,
      phaseHistogram: hAll,
      phasePeakMs: Math.round(((peakBin + 0.5) / 8) * g.beat * 1000),
      phaseConcentration: concentration,
      beatsPerShot: +meanBeats.toFixed(2),
      lifts: a.lifts.up.map((l) => +l.t.toFixed(2)),
      dropouts: a.lifts.down.map((l) => +l.t.toFixed(2)),
    };
  } catch (e) {
    music = { error: e.message };
  }
}

// --- Palette: k-means on small frames sampled through the video.
const PW = 48;
const PH = Math.max(2, Math.round((PW * H) / W));
const step = Math.max(0.5, dur / 40);
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", input, "-vf", `fps=${(1 / step).toFixed(4)},scale=${PW}:${PH}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 28 });
const px = [];
for (let i = 0; i + 2 < raw.length; i += 3) px.push([raw[i], raw[i + 1], raw[i + 2]]);
const K = 7;
let cents = Array.from({ length: K }, (_, k) => {
  const sorted = [...px].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  return sorted[Math.floor(((k + 0.5) / K) * sorted.length)].slice();
});
let assign = new Int32Array(px.length);
for (let it = 0; it < 12; it++) {
  for (let i = 0; i < px.length; i++) {
    let bi = 0, bd = Infinity;
    for (let k = 0; k < K; k++) {
      const d = (px[i][0] - cents[k][0]) ** 2 + (px[i][1] - cents[k][1]) ** 2 + (px[i][2] - cents[k][2]) ** 2;
      if (d < bd) { bd = d; bi = k; }
    }
    assign[i] = bi;
  }
  const sum = Array.from({ length: K }, () => [0, 0, 0, 0]);
  for (let i = 0; i < px.length; i++) {
    const s = sum[assign[i]];
    s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3]++;
  }
  cents = cents.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
}
const counts = new Array(K).fill(0);
for (const a of assign) counts[a]++;
const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
// Chroma (0-1): how colourful a colour is regardless of how dark it is, so deep teals don't count as accents.
const sat = (c) => (Math.max(...c) - Math.min(...c)) / 255;
const palette = cents.map((c, k) => ({ hex: hex(c), share: +(counts[k] / px.length).toFixed(3), lum: +lum(c).toFixed(2), sat: +sat(c).toFixed(2) })).filter((p) => p.share > 0.004).sort((a, b) => b.share - a.share);
const ground = palette[0];
const ink = [...palette].sort((a, b) => Math.abs(b.lum - ground.lum) - Math.abs(a.lum - ground.lum))[0];
const accents = palette.filter((p) => p.sat > 0.18 && p !== ground).slice(0, 3);
// (accentHues is computed below, after the pixels are measured.)
const meanLum = px.reduce((p, c) => p + lum(c), 0) / px.length;
// Accent hues: small, colourful areas get lost in a k-means palette, so bin colourful pixels by hue as well.
const hueBins = Array.from({ length: 12 }, () => ({ n: 0, r: 0, g: 0, b: 0 }));
let colourful = 0;
for (const c of px) {
  const ch = sat(c);
  const l = lum(c);
  if (ch < 0.2 || l < 0.12 || l > 0.95) continue;
  colourful++;
  const [r, g, b] = c.map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
  h = ((h * 60) + 360) % 360;
  const bin = hueBins[Math.floor(h / 30) % 12];
  bin.n++; bin.r += c[0]; bin.g += c[1]; bin.b += c[2];
}
const accentHues = hueBins
  .filter((b) => b.n / px.length > 0.002)
  .sort((a, b) => b.n - a.n)
  .slice(0, 3)
  .map((b) => ({ hex: hex([b.r / b.n, b.g / b.n, b.b / b.n]), share: +(b.n / px.length).toFixed(3) }));

// --- Contact sheet: one frame from each shot (evenly thinned if there are many). With few hard cuts, frames evenly
// spaced through the video instead (24 of them), so a motion-graphics film still shows its whole progression.
const even = shots.length < 8;
const pickShots = even
  ? Array.from({ length: Math.min(MAXSHOTS, 24) }, (_, k) => ({ i: 0, start: ((k + 0.5) * dur) / Math.min(MAXSHOTS, 24) - 0.001, len: 0.002 }))
  : shots.length <= MAXSHOTS ? shots : Array.from({ length: MAXSHOTS }, (_, k) => shots[Math.floor((k * shots.length) / MAXSHOTS)]);
const fdir = path.join(OUT, "frames");
await rm(fdir, { recursive: true, force: true });
await mkdir(fdir, { recursive: true });
const TW = W >= H ? 400 : 240;
pickShots.forEach((s, k) => {
  const t = s.start + Math.min(s.len / 2, 0.6 + s.len * 0.25);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(3), "-i", input, "-frames:v", "1", "-vf", `scale=${TW}:-2`, path.join(fdir, String(k + 1).padStart(3, "0") + ".png")]);
});
const cols = W >= H ? 4 : 6;
const rows = W >= H ? 4 : 3;
const per = cols * rows;
const nSheets = Math.ceil(pickShots.length / per);
for (const f of (await readdir(OUT)).filter((f) => /^sheet-\d+\.png$/.test(f))) await rm(path.join(OUT, f));
for (let sh = 0; sh < nSheets; sh++) {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-start_number", String(sh * per + 1), "-i", path.join(fdir, "%03d.png"), "-frames:v", "1", "-vf", `tile=${cols}x${rows}:padding=6:margin=6:color=0x202020`, path.join(OUT, `sheet-${String(sh + 1).padStart(2, "0")}.png`)]);
}
// A poster frame: the very first frame, which is what a feed shows before anyone presses play.
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", input, "-frames:v", "1", "-vf", `scale=${TW * 2}:-2`, path.join(OUT, "first-frame.png")]);

const card = {
  source: path.resolve(input),
  format: { width: W, height: H, ratio, fps: +fps.toFixed(2), duration: +dur.toFixed(2), audio: hasAudio },
  events: eventTimes,
  strongEvents: strong,
  editing: { changeEvents: events.length, eventsPerSecond: +(events.length / dur).toFixed(2), shots: shots.length, cutsPerSecond: +(cuts.length / dur).toFixed(2), meanShot: +mean.toFixed(2), medianShot: +median.toFixed(2), shortest: lens[0], longest: lens[lens.length - 1], sceneThreshold: SCENE },
  music,
  look: { meanLuminance: +meanLum.toFixed(2), ground: ground.hex, ink: ink.hex, accents: accents.map((a) => a.hex), accentHues, colourfulShare: +(colourful / px.length).toFixed(3), palette },
  pace,
  shots,
  sheets: Array.from({ length: nSheets }, (_, i) => path.join(OUT, `sheet-${String(i + 1).padStart(2, "0")}.png`)),
  sheetFrames: pickShots.map((s, k) => ({ n: k + 1, shot: s.i, at: +(s.start + Math.min(s.len / 2, 0.6 + s.len * 0.25)).toFixed(2) })),
};
await writeFile(path.join(OUT, "style-card.json"), JSON.stringify(card, null, 1));

const spark = pace.map((p) => " ▁▂▃▄▅▆▇█"[Math.min(8, Math.round((p / maxPace) * 8))]).join("");
const md = [
  `# Reference style card`,
  ``,
  `Source: ${card.source}`,
  ``,
  `## Format`,
  `${W}×${H} (${ratio}), ${card.format.fps} fps, ${card.format.duration} s, ${hasAudio ? "with" : "no"} audio.`,
  ``,
  `## Editing rhythm`,
  `- ${shots.length} shots, ${card.editing.cutsPerSecond} cuts per second. Shot length: median ${median.toFixed(2)} s, mean ${mean.toFixed(2)} s, ${lens[0].toFixed(2)}–${lens[lens.length - 1].toFixed(2)} s.`,
  music && !music.error
    ? `- Music ${music.bpm} BPM (${music.key}, grid from ${music.grid}). ` +
      (cuts.length ? `${Math.round(music.cutsOnBeat * 100)}% of cuts land on a beat (${Math.round(music.cutsOnBarStart * 100)}% on a bar's first beat), about ${music.beatsPerShot} beats per shot. ` : "") +
      `Events by position in the beat (8 slices, beat first): ${music.phaseHistogram.join(" ")}; ${Math.round(music.phaseConcentration * 100)}% sit within a slice of the busiest (chance: 38%), around ${music.phasePeakMs} ms after the beat. The biggest moves: ${Math.round(music.strongOnBeat * 100)}% start on a beat, ${Math.round(music.strongOnBarStart * 100)}% on a bar's first beat; all change events: ${Math.round(music.eventsOnBeat * 100)}% (chance alone: ${Math.round(music.chance * 100)}%).`
    : hasAudio ? `- Music could not be measured (${music?.error}).` : `- No audio track.`,
  music?.lifts?.length ? `- Music lifts at ${music.lifts.join(", ")} s; drop-outs at ${music.dropouts.join(", ") || "none"} s.` : ``,
  `- Pace (movement and cuts per second, 0–${pace.length} s): \`${spark}\``,
  `- Hard cuts (s): ${cuts.map((c) => c.toFixed(2)).join(", ") || "none (it moves by animation, not cuts)"}`,
  `- Biggest moves (s): ${strong.map((c) => c.toFixed(2)).join(", ")}`,
  `- All change events, ${events.length} (${(events.length / dur).toFixed(2)}/s): ${eventTimes.map((c) => c.toFixed(2)).join(", ")}`,
  ``,
  `## Look`,
  `- ${meanLum < 0.35 ? "Dark" : meanLum > 0.65 ? "Light" : "Mid-tone"} overall (mean luminance ${meanLum.toFixed(2)}). Ground ${ground.hex}, ink ${ink.hex}${accents.length ? `, accents ${accents.map((a) => a.hex).join(", ")}` : ", no saturated colour in the main palette"}.`,
  `- Palette by share: ${palette.map((p) => `${p.hex} ${Math.round(p.share * 100)}%`).join(", ")}`,
  `- Colourful pixels: ${Math.round((colourful / px.length) * 100)}% of the frame${accentHues.length ? `; accent hues ${accentHues.map((a) => `${a.hex} (${(a.share * 100).toFixed(1)}%)`).join(", ")}` : ""}.`,
  ``,
  `## Frames`,
  `First frame: ${path.join(OUT, "first-frame.png")}`,
  ...card.sheets.map((s) => `Sheet: ${s}`),
  `Sheet order (left to right, top to bottom${even ? ", evenly spaced" : ", one per shot"}): ${card.sheetFrames.map((f) => `${f.n}=${f.at}s`).join(", ")}`,
  ``,
  `## To fill in after looking at the sheets`,
  `Type (serif/sans, weight, size relative to frame, how words enter), layout (centred, left, full-bleed product), devices and how they move,`,
  `transitions (cuts, pushes, morphs, masks), colour use, graphic devices, the hook in the first second, the end card, and what NOT to copy.`,
].join("\n");
await writeFile(path.join(OUT, "style-card.md"), md + "\n");
console.log(md);
