// Renders film.html frame by frame in headless Chrome (DevTools protocol over a WebSocket, no packages) and pipes the
// frames to ffmpeg. The size, length and beat come from window.FILM in the page.
// Usage (from the film folder):
//   node tools/render.mjs stills [--variant v] --at 0,3.1,12.4 [--name hook,log,stats]   PNGs in out/<variant>/stills
//   node tools/render.mjs probe [--variant v] [--step <beat>] [--from 0] [--to 30]         labelled frames tiled into contact sheets
//   node tools/render.mjs cues [--variant v]                                               out/<variant>/cues.json for tools/sfx.mjs
//   node tools/render.mjs draft [--variant v]                                              30 fps, no motion blur
//   node tools/render.mjs full [--variant v] [--sub 4] [--jobs 3]                          60 fps, subframe motion blur
// Options: --gpu for WebGL/canvas-heavy films; CHROME=/path/to/chrome to choose the browser.
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

if (typeof WebSocket === "undefined") throw new Error("Node 22 or newer is needed (it has a built-in WebSocket); this is " + process.version);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const CHROME = process.env.CHROME || findChrome();
function findChrome() {
  const mac = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"];
  const win = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"];
  for (const p of [...mac, ...win]) if (existsSync(p)) return p;
  for (const n of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try {
      return execFileSync("which", [n]).toString().trim();
    } catch {}
  }
  throw new Error("Chrome not found: install Google Chrome or set CHROME=/path/to/chrome");
}
// The film's own size is read from window.FILM once it loads; the window starts large enough for any preset.
let W = 1080;
let H = 1920;

const args = process.argv.slice(2);
const mode = args[0];
const opt = (name, def) => {
  const i = args.indexOf("--" + name);
  return i > 0 ? args[i + 1] : def;
};
const VARIANT = opt("variant", "");
const OUT = path.join(ROOT, "out", VARIANT || "main");
const GPU = args.includes("--gpu");

// ---------------------------------------------------------------------------
// Static server for the film folder
// ---------------------------------------------------------------------------
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".mp4": "video/mp4", ".webm": "video/webm",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif",
};
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      const p = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname)));
      if (!p.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end();
      }
      try {
        const buf = await readFile(p);
        res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
        res.end(buf);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// ---------------------------------------------------------------------------
// Chrome + a minimal DevTools client
// ---------------------------------------------------------------------------
class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.id && this.pending.has(m.id)) {
          const { resolve: ok, reject: fail } = this.pending.get(m.id);
          this.pending.delete(m.id);
          if (m.error) fail(new Error(JSON.stringify(m.error)));
          else ok(m.result);
        } else if (m.method) for (const l of this.listeners) l(m);
      };
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function openFilm(server, query = "") {
  const profile = await mkdtemp(path.join(os.tmpdir(), "film-chrome-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--mute-audio",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--window-size=2200,2200",
      ...(GPU ? (process.platform === "darwin" ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : ["--enable-gpu", "--ignore-gpu-blocklist"]) : []),
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let log = "";
    proc.stderr.on("data", (d) => {
      log += d;
      const m = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    proc.on("exit", (code) => reject(new Error(`Chrome exited (${code})\n${log}`)));
  });
  const cdp = new CDP(wsUrl);
  await cdp.open();
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const s = (method, params) => cdp.send(method, params, sessionId);
  const errors = [];
  cdp.listeners.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/favicon/.test(m.params.entry.url || "")) errors.push(`${m.params.entry.text} ${m.params.entry.url || ""}`);
  });
  await s("Page.enable");
  await s("Runtime.enable");
  await s("Log.enable");
  await s("Emulation.setDeviceMetricsOverride", { width: 2200, height: 2200, deviceScaleFactor: 1, mobile: false });
  const { port } = server.address();
  await s("Page.navigate", { url: `http://127.0.0.1:${port}/film.html?render=1${VARIANT ? `&variant=${encodeURIComponent(VARIANT)}` : ""}${query}` });
  const evaluate = async (expression) => {
    const r = await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await evaluate(`new Promise((ok, fail) => { const t0 = Date.now(); const c = () => window.ready ? ok(true) : Date.now() - t0 > 20000 ? fail(new Error("film not ready")) : setTimeout(c, 25); c(); })`);
  if (errors.length) throw new Error("Page errors:\n" + errors.join("\n"));
  const film = await evaluate("window.FILM");
  W = film.width;
  H = film.height;
  await s("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const frame = async (t) => {
    await evaluate(`window.seek(${t}).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`);
    const { data } = await s("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 }, optimizeForSpeed: true });
    return Buffer.from(data, "base64");
  };
  const close = async () => {
    const exited = new Promise((resolve) => proc.once("exit", resolve));
    try {
      await cdp.send("Browser.close");
    } catch {}
    const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await Promise.race([exited, timeout(3000)]);
    if (proc.exitCode === null) {
      proc.kill();
      await Promise.race([exited, timeout(2000)]);
      if (proc.exitCode === null) proc.kill("SIGKILL");
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  };
  return { film, frame, evaluate, errors, close };
}

// ---------------------------------------------------------------------------
// ffmpeg
// ---------------------------------------------------------------------------
function ffmpeg(argv) {
  const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...argv], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) => p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error("ffmpeg exited " + c)))));
  const write = (buf) => new Promise((resolve) => (p.stdin.write(buf) ? resolve() : p.stdin.once("drain", resolve)));
  const end = () => {
    p.stdin.end();
    return done;
  };
  return { write, end };
}
// sRGB frames to BT.709 TV-range H.264.
const ENCODE = (crf) => [
  "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-profile:v", "high", "-pix_fmt", "yuv420p",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-movflags", "+faststart",
];
const TO709 = "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p";

const bar = (done, total, t0) => {
  const el = (Date.now() - t0) / 1000;
  const eta = done ? (el / done) * (total - done) : 0;
  process.stdout.write(`\r${done}/${total}  ${el.toFixed(0)} s elapsed, ${eta.toFixed(0)} s left   `);
};

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------
async function stills(server) {
  const at = opt("at", "0").split(",").map(Number);
  const names = opt("name", "").split(",").filter(Boolean);
  const dir = path.join(OUT, "stills");
  await mkdir(dir, { recursive: true });
  const f = await openFilm(server);
  for (let i = 0; i < at.length; i++) {
    const file = path.join(dir, `${names[i] || "t" + at[i].toFixed(3)}.png`);
    await writeFile(file, await f.frame(at[i]));
    console.log(file);
  }
  if (f.errors.length) console.log("Page errors:\n" + f.errors.join("\n"));
  await f.close();
}

async function probe(server) {
  const f = await openFilm(server);
  const BEAT = f.film.beat;
  const step = Number(opt("step", BEAT));
  const from = Number(opt("from", 0));
  const to = Math.min(Number(opt("to", f.film.duration)), f.film.duration);
  const tw = Number(opt("tw", W > H ? 480 : 360));
  const th = Math.round((tw * H) / W / 2) * 2;
  const tag = opt("tag", "probe");
  const dir = path.join(OUT, tag);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const cols = Number(opt("cols", W > H ? 3 : 4));
  const rows = Number(opt("rows", 3));
  // A label burned into the page for the contact sheet only.
  await f.evaluate(`(() => { const l = document.createElement("div"); l.id = "plabel"; l.style.cssText = "position:fixed;left:0;top:0;z-index:9999;background:#000;color:#fff;font:600 34px/1 system-ui;padding:8px 12px"; document.body.appendChild(l); })()`);
  const times = [];
  for (let t = from; t <= to + 1e-6; t += step) times.push(Math.min(t, f.film.duration));
  const per = cols * rows;
  while (times.length % per) times.push(null);
  const enc = ffmpeg(["-f", "image2pipe", "-c:v", "png", "-framerate", "1", "-i", "-", "-vf", `scale=${tw}:${th}:flags=lanczos,tile=${cols}x${rows}:padding=6:margin=6:color=0x101617`, "-frames:v", String(times.length / per), path.join(dir, "sheet%02d.png")]);
  let blank;
  for (const t of times) {
    if (t == null) {
      blank ??= await f.evaluate(`document.getElementById("stage").style.visibility = "hidden"`).then(() => f.frame(0));
      await enc.write(blank);
      continue;
    }
    const b = t / BEAT;
    await f.evaluate(`document.getElementById("plabel").textContent = "${t.toFixed(2)} s · bar ${Math.floor(b / 4) + 1}.${((b % 4) + 1).toFixed(1)}"`);
    await enc.write(await f.frame(t));
  }
  await enc.end();
  if (f.errors.length) console.log("Page errors:\n" + f.errors.join("\n"));
  await f.close();
  console.log(`${times.filter((t) => t != null).length} frames in ${times.length / per} sheets: ${dir}`);
}

async function cues(server) {
  const f = await openFilm(server);
  const data = await f.evaluate(`({ film: window.FILM, cues: window.CUES })`);
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "cues.json"), JSON.stringify(data, null, 1));
  await f.close();
  console.log(`${data.cues.length} cues, duration ${data.film.duration.toFixed(3)} s -> ${path.join(OUT, "cues.json")}`);
}

// Renders frames [a, b) at fps with `sub` subframes each over a 180° shutter, blended by ffmpeg tmix.
async function chunk(server, { fps, sub, a, b, file, onFrame }) {
  const f = await openFilm(server);
  const vf = sub > 1 ? `tmix=frames=${sub},select='eq(mod(n\\,${sub})\\,${sub - 1})',setpts=N/(${fps}*TB),${TO709}` : TO709;
  const enc = ffmpeg(["-f", "image2pipe", "-c:v", "png", "-framerate", String(fps * sub), "-i", "-", "-vf", vf, "-r", String(fps), ...ENCODE(fps >= 60 ? 16 : 18), file]);
  const shutter = 0.5 / fps;
  for (let i = a; i < b; i++) {
    for (let k = 0; k < sub; k++) {
      const off = sub > 1 ? ((k + 0.5) / sub - 0.5) * shutter : 0;
      await enc.write(await f.frame(Math.max(0, i / fps + off)));
    }
    onFrame();
  }
  await enc.end();
  if (f.errors.length) console.log("\nPage errors:\n" + f.errors.join("\n"));
  await f.close();
}

async function video(server, full) {
  const probeF = await openFilm(server);
  const film = probeF.film;
  await probeF.close();
  const fps = full ? 60 : 30;
  const sub = full ? Number(opt("sub", 4)) : 1;
  const jobs = Number(opt("jobs", full ? 3 : 2));
  const total = Math.round(film.duration * fps);
  await mkdir(OUT, { recursive: true });
  const name = full ? "video-60.mp4" : "video-30.mp4";
  const files = [];
  let done = 0;
  const t0 = Date.now();
  const tick = () => bar(++done, total, t0);
  const work = [];
  for (let j = 0; j < jobs; j++) {
    const a = Math.round((j * total) / jobs);
    const b = Math.round(((j + 1) * total) / jobs);
    const file = path.join(OUT, `.chunk-${name}-${j}.mp4`);
    files.push(file);
    work.push(chunk(server, { fps, sub, a, b, file, onFrame: tick }));
  }
  await Promise.all(work);
  const list = path.join(OUT, `.chunks-${name}.txt`);
  await writeFile(list, files.map((f) => `file '${f}'`).join("\n"));
  const out = path.join(OUT, name);
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]).end();
  for (const f of [...files, list]) await rm(f, { force: true });
  console.log(`\n${out}  (${total} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

const server = await serve();
try {
  if (mode === "stills") await stills(server);
  else if (mode === "probe") await probe(server);
  else if (mode === "cues") await cues(server);
  else if (mode === "draft") await video(server, false);
  else if (mode === "full") await video(server, true);
  else console.log("modes: stills | probe | cues | draft | full");
} finally {
  server.closeAllConnections();
  server.close();
}
process.exit(0);
