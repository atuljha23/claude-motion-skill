// Sets up a new film folder from the template: the engine and example scenes, the render/sound/mix tools, the vibe's
// fonts (downloaded from Google Fonts into fonts/), the measured music, official store badges and a filled-in film.config.js.
// Usage:
//   node new_film.mjs <folder> --name "Acme" --vibe keynote --format 9:16 --music track.mp3
//        [--land 17:11]       song bar 17 lands on film bar 11 (the feature wall); default: the song's biggest lift
//        [--url acme.app] [--badges appstore,googleplay] [--logo logo.svg] [--accent "#ff5a8a"] [--look night]
// Formats: 9:16 (1080×1920), 4:5 (1080×1350), 1:1 (1080×1080), 16:9 (1920×1080), or WxH.
import path from "node:path";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { analyse } from "./lib/audio.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SKILL = path.resolve(HERE, "..");
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes("--" + n) ? args[args.indexOf("--" + n) + 1] : d);
const dir = args[0] && !args[0].startsWith("--") ? path.resolve(args[0]) : null;
const VIBES = JSON.parse(await readFile(path.join(SKILL, "assets/vibes.json"), "utf8"));
const vibeId = opt("vibe", "keynote");
const vibe = VIBES[vibeId];
if (!dir || !opt("name") || !opt("music") || !vibe) {
  console.log(`usage: node new_film.mjs <folder> --name "Name" --music track.mp3 [--vibe ${Object.keys(VIBES).join("|")}] [--format 9:16] [--land songBar:filmBar] [--url x] [--badges appstore,googleplay] [--logo file] [--accent #hex] [--look name]`);
  process.exit(1);
}
if (existsSync(path.join(dir, "film.js"))) throw new Error(`${dir} already has a film.js: pick an empty folder`);
const FORMATS = { "9:16": [1080, 1920], "4:5": [1080, 1350], "1:1": [1080, 1080], "16:9": [1920, 1080] };
const fmt = opt("format", "9:16");
const [W, H] = FORMATS[fmt] ?? fmt.split(/[x×]/).map(Number);
if (!W || !H) throw new Error("format: 9:16, 4:5, 1:1, 16:9 or WxH");
const name = opt("name");
const slug = (name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "film") + "-launch";

await mkdir(path.join(dir, "assets/music"), { recursive: true });
await mkdir(path.join(dir, "fonts"), { recursive: true });
await cp(path.join(SKILL, "assets/template"), dir, { recursive: true });

// --- Fonts: the vibe's Google Fonts, saved locally so renders never depend on the network.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const families = [...new Set(Object.values(vibe.fonts))];
let fontCss = "";
for (const fam of families) {
  try {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, "+").replace(/%3A/g, ":").replace(/%40/g, "@").replace(/%3B/g, ";").replace(/%2C/g, ",")}&display=block`, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    let css = await res.text();
    // Keep the latin subsets (plus latin-ext for accented names); download each file once.
    const blocks = css.split(/(?=\/\* )/).filter((b) => /\/\* latin(-ext)? \*\//.test(b));
    css = blocks.join("");
    let n = 0;
    for (const url of [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))]) {
      const file = `${fam.split(":")[0].replace(/\s+/g, "")}-${++n}.woff2`;
      await writeFile(path.join(dir, "fonts", file), Buffer.from(await (await fetch(url)).arrayBuffer()));
      css = css.split(url).join(file);
    }
    fontCss += css.replace(/url\(([^)]+)\)/g, (_m, f) => `url(fonts/${f})`);
  } catch (e) {
    console.log(`font ${fam}: ${e.message} (the film falls back to system fonts until it is fixed)`);
  }
}
await writeFile(path.join(dir, "fonts.css"), fontCss || "/* no web fonts */\n");

// --- Music: copy, measure, and pick where the song starts.
const musicSrc = path.resolve(opt("music"));
const musicFile = "assets/music/" + path.basename(musicSrc).replace(/\s+/g, "-");
await cp(musicSrc, path.join(dir, musicFile));
const a = analyse(musicSrc, { target: opt("bpm") ? Number(opt("bpm")) : undefined });
const g = a.grid;
const timeline = { problem: 2, reveal: 4, features: [6, 8], gap: 10, wall: 11, end: 13, endHit: 15 };
let land = opt("land");
let songStart;
let landNote;
const startFor = (songBar, filmBar) => g.phase + (songBar - 1) * 4 * g.beat - (filmBar - 1) * 4 * g.beat;
if (land) {
  const [sb, fb] = land.split(":").map(Number);
  songStart = startFor(sb, fb);
  if (songStart < 0) throw new Error(`song bar ${sb} comes too early to land on film bar ${fb}`);
  landNote = `song bar ${sb} lands on film bar ${fb} (--land)`;
} else {
  // The biggest lift that can land on the feature wall (needs enough song before it).
  const cands = [...a.lifts.up].filter((l) => startFor(l.bar, timeline.wall) >= 0).sort((p, q) => q.jump - p.jump);
  if (cands.length) {
    songStart = startFor(cands[0].bar, timeline.wall);
    landNote = `the song's biggest lift (song bar ${cands[0].bar}, ${cands[0].t.toFixed(2)} s) lands on the feature wall (film bar ${timeline.wall})`;
  } else {
    songStart = g.phase;
    landNote = "no clear lift found: the film starts on the song's first beat";
  }
}
const filmLen = (timeline.endHit - 1) * 4 * g.beat + 0.9;
if (songStart + filmLen > a.duration) console.log(`warning: the song ends ${(songStart + filmLen - a.duration).toFixed(1)} s before the film does; land an earlier bar or shorten the timeline`);

// --- Badges: Apple's and Google's official artwork (follow their badge guidelines; don't redraw or recolour them).
const badges = [];
for (const b of (opt("badges", "") || "").split(",").filter(Boolean)) {
  try {
    await mkdir(path.join(dir, "assets/badges"), { recursive: true });
    if (b === "appstore") {
      const r = await fetch("https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/en-us");
      if (!r.ok) throw new Error("HTTP " + r.status);
      await writeFile(path.join(dir, "assets/badges/app-store.svg"), Buffer.from(await r.arrayBuffer()));
      badges.push("assets/badges/app-store.svg");
    } else if (b === "googleplay") {
      const r = await fetch("https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png");
      if (!r.ok) throw new Error("HTTP " + r.status);
      const raw = path.join(dir, "assets/badges/google-play-raw.png");
      await writeFile(raw, Buffer.from(await r.arrayBuffer()));
      // Google's PNG carries a transparent margin; trim it so both badges match in height.
      const [bw, bh] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", raw]).toString().trim().split(",").map(Number);
      const px = execFileSync("ffmpeg", ["-v", "error", "-i", raw, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 26 });
      let x0 = bw, y0 = bh, x1 = 0, y1 = 0;
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (px[(y * bw + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", `crop=${x1 - x0 + 1}:${y1 - y0 + 1}:${x0}:${y0}`, path.join(dir, "assets/badges/google-play.png")]);
      await rm(raw);
      badges.push("assets/badges/google-play.png");
    } else console.log(`badge ${b}: unknown (appstore, googleplay)`);
  } catch (e) {
    console.log(`badge ${b}: ${e.message}; add the official file to assets/badges by hand`);
  }
}
let logo = null;
if (opt("logo")) {
  logo = "assets/" + path.basename(opt("logo"));
  await cp(path.resolve(opt("logo")), path.join(dir, logo));
}

// --- Config
const looks = JSON.parse(JSON.stringify(vibe.looks));
if (opt("accent")) for (const l of Object.values(looks)) l.acc = l.accHi = opt("accent");
const lookOrder = opt("look") && looks[opt("look")] ? [opt("look"), ...Object.keys(looks).filter((k) => k !== opt("look"))] : Object.keys(looks);
const config = {
  name,
  slug,
  url: opt("url") ?? null,
  width: W,
  height: H,
  vibe: vibeId,
  looks: Object.fromEntries(lookOrder.map((k) => [k, looks[k]])),
  fonts: { display: vibe.fonts.display.split(":")[0], body: vibe.fonts.body.split(":")[0], displayWeight: vibeId === "kinetic" ? 400 : vibeId === "playful" ? 700 : vibeId === "developer" || vibeId === "product" ? 600 : 400 },
  displayItalicAccent: vibe.displayItalicAccent,
  motion: vibe.motion,
  music: { file: musicFile, bpm: +g.bpm.toFixed(3), beat: +g.beat.toFixed(5), songStart: +songStart.toFixed(4), key: a.key[0].key, credit: "TODO: track title, artist, source and licence" },
  timeline,
  logo,
  badges,
  voiceLead: 0.18,
  copy: {
    hook: ["Your one-line hook", "*goes right here.*"],
    hookSub: null,
    problem: ["The *problem* people have?", "Or the *question* they ask?"],
    tagline: "What it is, in one line",
    features: [
      { caption: ["The first thing", "*it does.*"], sub: "One short line of detail", screen: { kicker: "Screen kicker", title: "Screen title", rows: ["First row", "Second row", "Third row"], button: "Continue" } },
      { caption: ["The second thing", "*it does.*"], sub: "One short line of detail", screen: { kicker: "Screen kicker", title: "Another screen", rows: ["Row one", "Row two", "Row three"], button: "Done" } },
    ],
    gap: ["From the first step", "*to the big payoff.*"],
    tiles: [
      { title: "Feature one", sub: "Short detail" },
      { title: "Feature two", sub: "Short detail", big: "24" },
      { title: "Feature three", sub: "Short detail" },
      { title: "Feature four", sub: "Short detail" },
      { title: "Feature five", sub: "Short detail" },
      { title: "Feature six", sub: "Short detail" },
    ],
    cta: "Free to start",
  },
};
await writeFile(
  path.join(dir, "film.config.js"),
  `// Film settings and copy. Accent words are written *like this*. Every line here must be true of the product today.\n` +
    `// timeline is in bars (1 bar = 4 beats = ${(4 * g.beat).toFixed(3)} s); music.songStart is where in the track film t = 0 sits.\n` +
    `window.CONFIG = ${JSON.stringify(config, null, 2)};\n`,
);

const bt = (bar) => (bar - 1) * 4 * g.beat;
const md = `# ${name} launch film

${W}×${H} (${fmt}), ${vibe.name} vibe, about ${filmLen.toFixed(1)} s.

## Music
\`${musicFile}\`: ${g.bpm.toFixed(3)} BPM (grid from ${g.source}${a.fit ? `, kick fit rms ${a.fit.rmsMs.toFixed(1)} ms` : ""}), ${a.key[0].key}.
Film t = 0 is ${songStart.toFixed(4)} s into the song: ${landNote}.
Song lifts at ${a.lifts.up.map((l) => l.t.toFixed(1) + " s").join(", ") || "none"}; in film time ${a.lifts.up.map((l) => (l.t - songStart).toFixed(1)).filter((x) => x > 0 && x < filmLen).join(", ") || "none"} s.

## Beat map (film time; one bar = ${(4 * g.beat).toFixed(3)} s)
| Bars | Time (s) | Scene |
|---|---|---|
| 1 | 0–${bt(2).toFixed(1)} | Hook (frame 0 is the poster) |
| ${timeline.problem}–${timeline.reveal - 1} | ${bt(timeline.problem).toFixed(1)}–${bt(timeline.reveal).toFixed(1)} | Problem lines, one every 2 beats |
| ${timeline.reveal}–${timeline.features[0] - 1} | ${bt(timeline.reveal).toFixed(1)}–${bt(timeline.features[0]).toFixed(1)} | Reveal: mark, name, tagline |
| ${timeline.features[0]}–${timeline.gap - 1} | ${bt(timeline.features[0]).toFixed(1)}–${bt(timeline.gap).toFixed(1)} | Features on the device |
| ${timeline.gap} | ${bt(timeline.gap).toFixed(1)}–${bt(timeline.wall).toFixed(1)} | Gap line, riser |
| ${timeline.wall}–${timeline.end - 1} | ${bt(timeline.wall).toFixed(1)}–${bt(timeline.end).toFixed(1)} | Feature wall, one tile per beat (the drop) |
| ${timeline.end}–${timeline.endHit} | ${bt(timeline.end).toFixed(1)}–${filmLen.toFixed(1)} | End card, end hit on bar ${timeline.endHit} |

## Build
\`\`\`
open film.html                                   # preview: Space plays with the music, arrows step, slider scrubs
node tools/render.mjs stills --at 0,${bt(timeline.reveal + 1).toFixed(1)},${bt(timeline.features[0] + 1).toFixed(1)},${bt(timeline.wall + 1).toFixed(1)},${(filmLen - 0.5).toFixed(1)} --name hook,reveal,feature,wall,end
node tools/render.mjs probe                      # one frame per beat, contact sheets in out/main/probe
node tools/render.mjs cues && node tools/sfx.mjs
node tools/render.mjs draft && node tools/mix.mjs --video out/main/video-30.mp4 --out out/main/draft.mp4
node tools/render.mjs full --sub 4 --jobs 4 && node tools/mix.mjs --video out/main/video-60.mp4 --out out/${slug}.mp4
\`\`\`
Other looks: add \`--variant <name>\` (${Object.keys(looks).join(", ")}) to every command.

## Honesty
- TODO: where each claim, number and on-screen string comes from.
- Music: TODO credit and licence.
`;
await writeFile(path.join(dir, "BEATMAP.md"), md);
console.log(md);
console.log(`\nCreated ${dir}`);
