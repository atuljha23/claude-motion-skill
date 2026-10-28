// Analyses a music track for a beat-cut film: tempo, a kick-fitted beat grid, key, per-bar energy, lifts and drop-outs,
// and (with --land) where to start the song so a chosen song bar lands on a chosen film bar.
// Usage:
//   node beat.mjs <audio> [--bpm 120] [--json]
//   node beat.mjs <audio> --land 17:9        song bar 17 (e.g. the drop) lands on film bar 9
// Prints a bar chart; the first column is the song bar, then its start time.
import { analyse, bar } from "./lib/audio.mjs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && !/^\d/.test(a));
const opt = (n, d) => (args.includes("--" + n) ? args[args.indexOf("--" + n) + 1] : d);
if (!file) {
  console.log("usage: node beat.mjs <audio> [--bpm N] [--land songBar:filmBar] [--json]");
  process.exit(1);
}
const a = analyse(file, { target: opt("bpm") ? Number(opt("bpm")) : undefined });
const g = a.grid;
let land;
if (opt("land")) {
  const [sb, fb] = opt("land").split(":").map(Number);
  const songStart = g.phase + (sb - 1) * 4 * g.beat - (fb - 1) * 4 * g.beat;
  land = { songBar: sb, filmBar: fb, songStart, ok: songStart >= 0 };
}
if (args.includes("--json")) {
  console.log(JSON.stringify({ ...a, land }, null, 1));
  process.exit(0);
}
console.log(`${file}`);
console.log(`duration ${a.duration.toFixed(1)} s · key ${a.key.map((k) => `${k.key} (${k.r.toFixed(2)})`).join(", ")}`);
console.log(`grid ${g.bpm.toFixed(3)} BPM, beat ${g.beat.toFixed(5)} s, bar ${(4 * g.beat).toFixed(4)} s, beat 0 at ${g.phase.toFixed(4)} s (from ${g.source})`);
if (a.fit) console.log(`kick fit: ${a.fit.matched}/${a.fit.total} kicks on the grid, rms ${a.fit.rmsMs.toFixed(1)} ms${a.fit.rmsMs > 12 ? "  (loose: check by ear or with a probe sheet)" : ""}`);
console.log("");
for (const b of a.bars) console.log(`bar ${String(b.bar).padStart(3)} ${b.t.toFixed(2).padStart(7)} s  full ${bar(b.full)} ${b.full.toFixed(2)}  low ${bar(b.low, 16)} ${b.low.toFixed(2)}`);
console.log("");
console.log("lifts (energy jumps):  " + (a.lifts.up.map((l) => `bar ${l.bar} @ ${l.t.toFixed(2)} s (+${l.jump})`).join(", ") || "none"));
console.log("drop-outs (sudden quiet): " + (a.lifts.down.map((l) => `bar ${l.bar} @ ${l.t.toFixed(2)} s (-${l.fall})`).join(", ") || "none"));
if (land) {
  console.log("");
  if (land.ok) console.log(`start the song at ${land.songStart.toFixed(4)} s: song bar ${land.songBar} lands on film bar ${land.filmBar} (film t = ${((land.filmBar - 1) * 4 * g.beat).toFixed(3)} s)`);
  else console.log(`song bar ${land.songBar} comes too early to land on film bar ${land.filmBar}: pick a later song bar or an earlier film bar`);
}
