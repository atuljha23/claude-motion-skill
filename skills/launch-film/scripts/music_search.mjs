// Finds music for a film at a chosen tempo. Pulls candidate tracks from Mixkit's free library (pages for the vibe's genres,
// moods and instruments), measures each one (tempo, kick-fitted grid, key, lifts), keeps the ones near the target BPM,
// ranks them, and cuts previews the length of the film. Local files can be measured alongside with --file.
// Usage:
//   node music_search.mjs --bpm 100 --vibe warm --len 40 --out music
//   node music_search.mjs --bpm 124 --sources electronic,tag/uplifting --pages 2 --tol 4
//   node music_search.mjs --bpm 90 --file ~/Music/a.mp3 --file ~/Music/b.wav        only measure these
// Writes <out>/shortlist.md, shortlist.json and previews/<id>.mp3. Downloads are cached in ~/.cache/launch-film/mixkit.
// Licence: Mixkit's Free Music Licence covers use in videos, commercial included, without credit
// (https://mixkit.co/license/#musicFree). Re-check it for unusual uses (resale, TV/broadcast, Content ID).
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { analyse } from "./lib/audio.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes("--" + n) ? args[args.indexOf("--" + n) + 1] : d);
const all = (n) => args.flatMap((a, i) => (a === "--" + n ? [args[i + 1]] : []));
const BPM = Number(opt("bpm", 0));
const TOL = Number(opt("tol", 6));
const LEN = Number(opt("len", 40));
const TOP = Number(opt("top", 8));
const MAX = Number(opt("max", 40));
const PAGES = Number(opt("pages", 1));
const OUT = path.resolve(opt("out", "music"));
const CACHE = opt("cache", path.join(os.homedir(), ".cache/launch-film/mixkit"));
const VIBES = JSON.parse(await readFile(path.join(HERE, "../assets/vibes.json"), "utf8"));
const vibe = opt("vibe") ? VIBES[opt("vibe")] : null;
if (opt("vibe") && !vibe) throw new Error(`unknown vibe "${opt("vibe")}"; one of ${Object.keys(VIBES).join(", ")}`);
const files = all("file");
const sources = opt("sources") ? opt("sources").split(",") : files.length ? [] : vibe?.mixkit ?? [];
const target = BPM || (vibe ? Math.round((vibe.bpm[0] + vibe.bpm[1]) / 2) : 0);
if (!target && !files.length) {
  console.log("usage: node music_search.mjs --bpm N [--vibe name | --sources a,b] [--len 40] [--tol 6] [--top 8] [--out music] [--file f ...]");
  process.exit(1);
}
await mkdir(CACHE, { recursive: true });
await mkdir(path.join(OUT, "previews"), { recursive: true });

// --- Mixkit listing pages carry a JSON-LD ItemList with each track's mp3 URL, name, artist, genre and duration.
async function listing(src, page) {
  const url = `https://mixkit.co/free-stock-music/${src.replace(/^\/|\/$/g, "")}/${page > 1 ? `?page=${page}` : ""}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (launch-film skill)" }, redirect: "follow" });
  if (!res.ok) return [];
  const html = await res.text();
  const items = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d;
    try {
      d = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const g of d?.["@graph"] ?? []) {
      if (g["@type"] !== "ItemList") continue;
      for (const it of g.itemListElement ?? []) {
        const id = String(it.url).match(/\/(\d+)\.mp3/)?.[1];
        if (!id) continue;
        const dur = String(it.duration || "").match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
        items.push({
          id: "mixkit-" + id,
          mp3: it.url,
          title: it.name,
          artist: typeof it.byArtist === "string" ? it.byArtist : it.byArtist?.name ?? "",
          genre: it.genre ?? "",
          duration: dur ? Number(dur[1] || 0) * 60 + Number(dur[2] || 0) : 0,
          page: `https://mixkit.co/free-stock-music/${src}/`,
          source: src,
          licence: "Mixkit Free Music Licence (no credit needed): https://mixkit.co/license/#musicFree",
        });
      }
    }
  }
  return items;
}

const cands = new Map();
for (const src of sources) {
  for (let p = 1; p <= PAGES; p++) {
    const items = await listing(src, p);
    for (const it of items) if (!cands.has(it.id)) cands.set(it.id, it);
    process.stdout.write(`\r${cands.size} tracks listed (${src} p${p})            `);
    if (!items.length) break;
  }
}
if (sources.length) process.stdout.write("\n");
// Too short to carry the film plus an intro: skip before downloading.
// Take tracks from each source in turn, so --max doesn't fill up from the first page alone.
const bySrc = sources.map((s) => [...cands.values()].filter((c) => c.source === s && (!c.duration || c.duration >= LEN + 4)));
let list = [];
for (let i = 0; list.length < MAX && bySrc.some((b) => b[i]); i++) for (const b of bySrc) if (b[i] && list.length < MAX) list.push(b[i]);
for (const f of files) list.push({ id: "local-" + path.basename(f).replace(/\.[^.]+$/, ""), local: path.resolve(f.replace(/^~/, os.homedir())), title: path.basename(f), artist: "", genre: "", source: "local", licence: "your file: check you have the rights" });

const results = [];
let k = 0;
for (const c of list) {
  k++;
  const file = c.local ?? path.join(CACHE, c.id + ".mp3");
  try {
    if (!existsSync(file)) {
      const r = await fetch(c.mp3);
      if (!r.ok) throw new Error("download " + r.status);
      await writeFile(file, Buffer.from(await r.arrayBuffer()));
    }
    process.stdout.write(`\r${k}/${list.length} measuring ${c.title.slice(0, 40).padEnd(40)}`);
    const a = analyse(file, { target: target || undefined, dur: LEN + 60 }); // only the part a film can use
    const bpm = a.grid.bpm;
    // Compare with the target directly and at half/double time (a 62 BPM ballad cuts fine on every beat of a 124 film's half grid).
    const ratio = target ? [1, 0.5, 2].map((m) => ({ m, d: Math.abs(bpm * m - target) })).sort((p, q) => p.d - q.d)[0] : { m: 1, d: 0 };
    const intro = a.bars.findIndex((b) => b.full > 0.55);
    const firstLift = a.lifts.up.find((l) => l.t > 3 && l.t < LEN + 10);
    const shape = a.lifts.up.filter((l) => l.t < LEN + 20).map((l) => `${l.t.toFixed(0)}s`).join(" ");
    let score = 0;
    score += Math.max(0, 1 - ratio.d / Math.max(1, TOL)) * 5; // tempo
    score += ratio.m === 1 ? 1 : 0; // straight time beats half/double
    score += firstLift ? 2 : 0; // a lift inside the film to cut to
    score += a.fit && a.fit.rmsMs < 12 ? 1.5 : 0; // clean, kick-led grid: easy to cut to
    score += a.duration >= LEN + 8 ? 0.5 : 0;
    results.push({
      ...c,
      file,
      duration: +a.duration.toFixed(1),
      bpm: +bpm.toFixed(2),
      timing: ratio.m === 1 ? "straight" : ratio.m === 0.5 ? "double time (cut every 2nd beat)" : "half time (cut twice per beat)",
      offBy: +ratio.d.toFixed(1),
      key: a.key[0].key,
      grid: { beat: +a.grid.beat.toFixed(5), phase: +a.grid.phase.toFixed(4), source: a.grid.source, rmsMs: a.fit ? +a.fit.rmsMs.toFixed(1) : null },
      quietIntroBars: Math.max(0, intro),
      lifts: a.lifts.up.map((l) => ({ bar: l.bar, t: +l.t.toFixed(2), jump: l.jump })),
      dropouts: a.lifts.down.map((l) => ({ bar: l.bar, t: +l.t.toFixed(2) })),
      shape: shape || "flat (no clear lift)",
      score: +score.toFixed(2),
    });
  } catch (e) {
    process.stdout.write(`\n  skipped ${c.title}: ${e.message}\n`);
  }
}
process.stdout.write("\n");
const inRange = results.filter((r) => !target || r.offBy <= TOL).sort((a, b) => b.score - a.score);
const pick = inRange.slice(0, TOP);

// Previews: the first LEN seconds from the first beat, with short fades, so people hear what the film would get.
for (const r of pick) {
  const out = path.join(OUT, "previews", r.id + ".mp3");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(r.grid.phase), "-t", String(LEN + 2), "-i", r.file, "-af", `afade=t=in:d=0.2,afade=t=out:st=${LEN - 0.5}:d=2.5`, "-ac", "2", "-b:a", "128k", out]);
  r.preview = out;
}
await writeFile(path.join(OUT, "shortlist.json"), JSON.stringify({ target, tol: TOL, len: LEN, vibe: opt("vibe") ?? null, sources, measured: results.length, shortlist: pick, others: inRange.slice(TOP) }, null, 1));
const md = [
  `# Music shortlist: ${target ? target + " BPM ± " + TOL : "measured files"}${vibe ? `, ${vibe.name} vibe` : ""}`,
  "",
  `Measured ${results.length} tracks${sources.length ? ` from ${sources.join(", ")}` : ""}; ${inRange.length} in range. Previews are the first ${LEN} s from the first beat.`,
  "Lifts are where the energy jumps (a band coming in or a drop): the best places to land the logo or the feature wall.",
  "",
  "| # | Track | BPM | Timing | Key | Lifts in the first minute | Grid | Length |",
  "|---|---|---|---|---|---|---|---|",
  ...pick.map((r, i) => `| ${i + 1} | ${r.title}${r.artist ? ` (${r.artist})` : ""}${r.genre ? `, ${r.genre}` : ""} | ${r.bpm} | ${r.timing} | ${r.key} | ${r.shape} | ${r.grid.source}${r.grid.rmsMs != null ? `, ${r.grid.rmsMs} ms` : ""} | ${Math.round(r.duration)} s |`),
  "",
  "Files:",
  ...pick.map((r, i) => `${i + 1}. ${r.preview}  (source: ${r.mp3 ?? r.local})`),
  "",
  "The analysis measures tempo, energy and structure only. It cannot judge mood or taste: listen before choosing.",
].join("\n");
await writeFile(path.join(OUT, "shortlist.md"), md + "\n");
console.log(md);
