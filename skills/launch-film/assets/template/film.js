"use strict";
// Launch film template. Every frame is a pure function of time: window.seek(t) draws time t and nothing else.
// No CSS transitions, no timers, no Math.random, no state carried between frames. Settings and copy live in
// film.config.js; this file is the engine (top half) and the scenes (bottom half). Rewrite the scenes freely.

const CFG = window.CONFIG;
const params = new URLSearchParams(location.search);
const RENDER = params.has("render");
const LOOK = CFG.looks[params.get("variant")] ? params.get("variant") : Object.keys(CFG.looks)[0];
if (RENDER) document.body.classList.add("render");

const W = CFG.width;
const H = CFG.height;
const WIDE = W > H;
const S = Math.min(W, H) / 1080; // type and spacing scale; the template is drawn for a 1080 px short side
const M = Math.round(80 * S); // side margin
const BEAT = CFG.music.beat;
const BAR = 4 * BEAT;
const bt = (bar, beat = 1) => (bar - 1) * BAR + (beat - 1) * BEAT;
const TL = CFG.timeline;
const END_HIT = bt(TL.endHit);
const DURATION = END_HIT + 0.9;
window.FILM = { duration: DURATION, fps: 60, width: W, height: H, beat: BEAT, songStart: CFG.music.songStart, endHit: END_HIT, music: CFG.music.file, key: CFG.music.key, slug: CFG.slug, variant: LOOK };

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  out: (u) => 1 - Math.pow(1 - u, 3),
  in: (u) => u * u * u,
  o5: (u) => 1 - Math.pow(1 - u, 5),
  sine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
  lin: (u) => u,
};
// Closed-form spring step response from 0 to 1 (f in Hz, z = damping ratio). Below z 0.7 it overshoots.
function spring(dt, f, z) {
  if (dt <= 0) return 0;
  const w = 2 * Math.PI * f;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + ((z * w) / wd) * Math.sin(wd * dt));
}
const SP = { ui: [3.1, 0.8], box: [2.0, 0.82], type: [1.75, 0.84], soft: [1.25, 0.9], snap: [4.2, 0.74], pop: [2.6, 0.58] };
const sp = (t, t0, kind = "ui") => spring(t - t0, SP[kind][0], SP[kind][1]);
const MO = CFG.motion;
const f2 = (n) => n.toFixed(2);
// Deterministic noise (use instead of Math.random).
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// A property track: moves [{ t, d, e, v }] applied in order (they must not overlap).
function track(t, moves) {
  const cur = { ...moves[0].v };
  for (let i = 1; i < moves.length; i++) {
    const m = moves[i];
    if (t <= m.t) break;
    const u = (m.e || E.io)(prog(t, m.t, m.t + m.d));
    for (const k in m.v) cur[k] = lerp(cur[k], m.v[k], u);
    if (u < 1) break;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
function h(tag, cls, parent, html) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html != null) el.innerHTML = html;
  if (parent) parent.appendChild(el);
  return el;
}
// Writes a style only when it changed (seeking every frame stays cheap).
const styleCache = new WeakMap();
function css(el, props) {
  let c = styleCache.get(el);
  if (!c) styleCache.set(el, (c = {}));
  for (const k in props) {
    const v = props[k];
    if (c[k] !== v) {
      el.style[k] = v;
      c[k] = v;
    }
  }
}
const vis = (el, on) => css(el, { visibility: on ? "inherit" : "hidden" });
function show(el, o) {
  vis(el, o > 0.002);
  css(el, { opacity: f2(clamp(o)) });
}

// "*word*" marks accent words (an accent may span several words).
function wordsInto(el, text) {
  const spans = [];
  let acc = false;
  const words = text.split(" ");
  words.forEach((raw, i) => {
    let w = raw;
    if (w.startsWith("*")) {
      acc = true;
      w = w.slice(1);
    }
    let end = false;
    if (w.endsWith("*")) {
      end = true;
      w = w.slice(0, -1);
    }
    const m = h("span", "wm" + (MO.transition === "rise" ? "" : " open"), el);
    const inner = h("span", "wi" + (acc ? " acc" : ""), m);
    inner.textContent = w;
    spans.push(inner);
    if (end) acc = false;
    if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
  });
  return spans;
}
function textBlock(parent, lines, size, top, cls = "display center") {
  const el = h("div", "abs " + cls, parent);
  css(el, { left: M + "px", right: M + "px", top: top + "px", fontSize: size + "px" });
  const spans = [];
  for (const line of Array.isArray(lines) ? lines : [lines]) spans.push(...wordsInto(h("span", "ln", el), line));
  return { el, spans, size };
}
// Shrinks a block's font until its widest line fits (lines never wrap). Call after fonts load.
function fitFont(block, maxW = W - 2 * M) {
  const el = block.el;
  css(el, { fontSize: block.size + "px" });
  let w = 0;
  for (const ln of el.querySelectorAll(".ln")) {
    ln.style.display = "inline-block";
    w = Math.max(w, ln.offsetWidth);
    ln.style.display = "";
  }
  if (w > maxW) css(el, { fontSize: Math.floor((block.size * maxW) / w) + "px" });
}

// Words enter on the vibe's transition and leave upwards. tOut null = they stay.
//   rise: out of masks on a spring · slam: scale down from big, hard · pop: overshooting scale · fade: soft opacity rise
function words(spans, t, tIn, tOut, o = {}) {
  const st = o.stagger ?? MO.stagger;
  const kind = o.kind ?? MO.spring;
  const mode = o.mode ?? MO.transition;
  spans.forEach((s, i) => {
    const t0 = tIn + i * st;
    const p = sp(t, t0, kind);
    let y = 0, sc = 1, op = 1, r = 0;
    if (mode === "rise") {
      y = (1 - p) * 115 * (MO.rise || 1);
      r = (1 - p) * (MO.rot ?? 3);
    } else if (mode === "slam") {
      sc = 1 + (1 - p) * 0.9;
      op = t >= t0 ? 1 : 0;
    } else if (mode === "pop") {
      sc = Math.max(0, p);
      r = (1 - p) * (MO.rot ?? 6);
      op = t >= t0 ? 1 : 0;
    } else {
      op = clamp(p * 1.3);
      y = (1 - p) * 30;
    }
    if (tOut != null && t > tOut) {
      const u = E.in(prog(t, tOut + i * st * 0.4, tOut + i * st * 0.4 + 0.32));
      if (mode === "rise") y -= u * 125;
      else {
        op *= 1 - u;
        y -= u * 40;
      }
    }
    css(s, { transform: `translateY(${f2(y)}%) scale(${f2(sc * 1000) / 1000}) rotate(${f2(r)}deg)`, opacity: f2(clamp(op)) });
  });
}
// The accent gradient drifts slowly so accent words never sit still.
function sheen(spans, t, speed = 0.18) {
  for (const s of spans) if (s.classList.contains("acc")) css(s, { backgroundPosition: `${f2(((t * speed) % 1) * -220 + 110)}% 0` });
}

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------
const stage = $("#stage");
const look = CFG.looks[LOOK];
const darkGround = (() => {
  const c = look.ground.replace("#", "");
  const v = (i) => parseInt(c.slice(i, i + 2), 16) / 255;
  return 0.2126 * v(0) + 0.7152 * v(2) + 0.0722 * v(4) < 0.45;
})();
const tokens = {
  "--ground": look.ground, "--ground2": look.ground2, "--ink": look.ink, "--sub": look.sub, "--acc": look.acc, "--acc-hi": look.accHi,
  "--tile": darkGround ? "rgba(255,255,255,0.055)" : "#ffffff", "--tile-line": darkGround ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
  "--screen-bg": look.screenBg ?? "#f6f7f5", "--screen-ink": look.screenInk ?? "#16201c", "--screen-sub": look.screenSub ?? "#66726d",
  "--card": "#ffffff", "--line": "rgba(0,0,0,0.07)", "--chrome-bg": "#e9ebe8",
  "--display": `"${CFG.fonts.display}"`, "--body": `"${CFG.fonts.body}"`, "--display-weight": String(CFG.fonts.displayWeight ?? 400),
};
for (const k in tokens) stage.style.setProperty(k, tokens[k]);
css(stage, { width: W + "px", height: H + "px" });
if (CFG.displayItalicAccent) stage.classList.add("italic-acc");
if (!RENDER) {
  const fit = () => {
    const s = Math.min((innerWidth - 24) / W, (innerHeight - 110) / H, 1);
    css(stage, { transform: `scale(${s})`, marginBottom: `${-(1 - s) * H}px` });
  };
  addEventListener("resize", fit);
  fit();
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------
const bg = $("#bg");
const titleL = h("div", "layer", stage);
const world = h("div", "", stage);
world.id = "world";
const capL = h("div", "layer", stage);
const wallL = h("div", "layer", stage);
const endL = h("div", "layer", stage);
const C = CFG.copy;

// ---------------------------------------------------------------------------
// Timeline (seconds), from the bar map in film.config.js
// ---------------------------------------------------------------------------
const T = {
  hook: 0,
  problem: bt(TL.problem),
  reveal: bt(TL.reveal),
  features: TL.features.map((b) => bt(b)),
  gap: bt(TL.gap),
  wall: bt(TL.wall),
  end: bt(TL.end),
};
// Each feature section runs until the next one (or the gap); its button tap lands two beats before it ends.
const featureEnd = (i) => T.features[i + 1] ?? T.gap;
const tapTime = (i) => featureEnd(i) - 2 * BEAT;

// ---------------------------------------------------------------------------
// Scenes: build once
// ---------------------------------------------------------------------------
// Hook: readable at t = 0, because frame 0 is the poster and the first autoplay frame.
const hook = textBlock(titleL, C.hook, 150 * S, H * (WIDE ? 0.34 : 0.37));
const hookSub = C.hookSub ? textBlock(titleL, C.hookSub, 44 * S, H * (WIDE ? 0.34 : 0.37) + 360 * S, "sub center") : null;
const problems = (C.problem || []).map((line) => textBlock(titleL, line, 112 * S, H * 0.42));

// Reveal: the mark (assets/logo.svg or .png if CONFIG.logo is set, else a squircle with the initial), the name, the tagline.
const mark = h("div", "abs", titleL);
const MARK = 220 * S;
css(mark, { left: W / 2 - MARK / 2 + "px", top: H * 0.5 - MARK - 120 * S + "px", width: MARK + "px", height: MARK + "px", borderRadius: MARK * 0.26 + "px", display: "flex", alignItems: "center", justifyContent: "center" });
if (CFG.logo) {
  const img = h("img", "", mark);
  img.src = CFG.logo;
  css(img, { width: "100%", height: "100%", objectFit: "contain" });
} else {
  css(mark, { background: "var(--acc)", color: "var(--ground)", font: `400 ${150 * S}px/1 var(--display)` });
  mark.textContent = CFG.name.trim()[0];
}
const nameB = textBlock(titleL, CFG.name, 200 * S, H * 0.5 - 40 * S);
const tagB = textBlock(titleL, C.tagline, 54 * S, H * 0.5 + 200 * S, "sub center");

// Feature captions sit above the device (tall) or left of it (wide).
const caps = C.features.map((f) => {
  const top = WIDE ? H * 0.34 : 150 * S;
  const b = textBlock(capL, f.caption, (WIDE ? 104 : 116) * S, top, "display " + (WIDE ? "" : "center"));
  if (WIDE) css(b.el, { right: W * 0.5 + "px" });
  const sub = f.sub ? textBlock(capL, f.sub, 40 * S, top + 270 * S, "sub " + (WIDE ? "" : "center")) : null;
  if (sub && WIDE) css(sub.el, { right: W * 0.5 + "px" });
  return { b, sub };
});

// Device: a phone (3D or flat) or a browser window. "none" skips it and the captions carry the features.
const DEVICE = MO.devices === "none" ? null : MO.devices === "browser" ? makeBrowser() : makePhone();
function makePhone() {
  const sw = 390, sh = 844, bez = 12, r = 62, gr = 52, depth = MO.devices === "3d" ? 7 : 0;
  const PW = sw + 2 * bez, PH = sh + 2 * bez;
  const root = h("div", "phone", world);
  css(root, { width: PW + "px", height: PH + "px", left: W / 2 - PW / 2 + "px", top: H / 2 - PH / 2 + "px" });
  for (let k = depth; k >= 1; k--) {
    const s = h("div", "slab", root);
    css(s, { borderRadius: r + "px", background: k === depth ? "#1d2023" : "#3a3e42", transform: `translateZ(${-k * 2.6}px)` });
  }
  const body = h("div", "pbody", root);
  css(body, { borderRadius: r + "px", background: "linear-gradient(140deg, #8a8f94 0%, #3b3f43 22%, #5d6266 48%, #2a2d30 70%, #7a7f84 100%)", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.18), 0 50px 110px rgba(0,0,0,0.4)" });
  const glass = h("div", "glass", body);
  css(glass, { left: bez + "px", top: bez + "px", width: sw + "px", height: sh + "px", borderRadius: gr + "px" });
  const island = h("div", "island", glass);
  css(island, { left: sw / 2 - 62 + "px", top: "11px", width: "124px", height: "36px" });
  const sweep = h("div", "sweep", glass);
  css(sweep, { background: "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.22) 48%, rgba(255,255,255,0.05) 54%, transparent 62%)" });
  return { kind: "phone", root, glass, sweep, sw, sh, w: PW, h: PH };
}
function makeBrowser() {
  const sw = 1280, sh = 800;
  const root = h("div", "browser", world);
  css(root, { width: sw + "px", height: sh + 52 + "px", left: W / 2 - sw / 2 + "px", top: H / 2 - (sh + 52) / 2 + "px" });
  h("div", "chrome", root, `<span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span class="url">${CFG.url ?? ""}</span>`);
  const glass = h("div", "", root);
  css(glass, { position: "relative", width: sw + "px", height: sh + "px", overflow: "hidden" });
  const sweep = h("div", "sweep", glass);
  css(sweep, { background: "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.18) 48%, transparent 60%)", zIndex: 5 });
  return { kind: "browser", root, glass, sweep, sw, sh, w: sw, h: sh + 52 };
}
// One screen per feature: a real screenshot (feature.image) or the placeholder UI below.
// The strongest films rebuild the real screens in code from the product's own tokens and strings: do that next.
const screens = DEVICE ? C.features.map((f, i) => {
  const el = h("div", "screen", DEVICE.glass);
  if (f.image) {
    const img = h("img", "", el);
    img.src = f.image;
    css(img, { width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" });
    return { el };
  }
  const sc = f.screen || {};
  const top = DEVICE.kind === "phone" ? 70 : 40;
  h("div", "ph-pad ph-kick", el, sc.kicker ?? "").style.top = top + "px";
  const title = h("div", "ph-pad display", el, sc.title ?? f.caption.join(" ").replace(/\*/g, ""));
  css(title, { top: top + 26 + "px", fontSize: (DEVICE.kind === "phone" ? 34 : 44) + "px", lineHeight: "1.05" });
  const card = h("div", "ph-pad ph-card", el);
  css(card, { top: top + (DEVICE.kind === "phone" ? 150 : 120) + "px" });
  const rows = (sc.rows ?? ["First thing", "Second thing", "Third thing"]).map((r) => h("div", "ph-row", card, `<span class="ph-dot"></span><span>${r}</span>`));
  const btn = h("div", "ph-pad ph-btn", el, sc.button ?? "Continue");
  css(btn, { bottom: (DEVICE.kind === "phone" ? 60 : 40) + "px" });
  const tap = h("div", "tap", el);
  return { el, rows, btn, tap };
}) : [];
// Where the device sits: hidden below, then in, then out at the gap. dx/dy in px, rotations in degrees.
const HID = { dx: 0, dy: H * 0.95, ry: MO.devices === "3d" ? 18 : 0, rx: MO.devices === "3d" ? 8 : 0, rz: 0, s: 1 };
const DS = DEVICE ? (WIDE ? Math.min((H * 0.72) / DEVICE.h, (W * 0.46) / DEVICE.w) : Math.min((H * 0.66) / DEVICE.h, (W * 0.8) / DEVICE.w)) : 1;
const IN = { dx: WIDE ? W * 0.22 : 0, dy: WIDE ? 20 * S : H * 0.12, ry: MO.devices === "3d" ? -8 : 0, rx: MO.devices === "3d" ? 3 : 0, rz: 0, s: DS };
const IN2 = { ...IN, ry: MO.devices === "3d" ? 7 : 0 };
const MOVES = [
  { v: HID },
  { t: T.features[0] - 0.35, d: 0.9, e: E.o5, v: IN },
  { t: T.features[1] - 0.3, d: 0.8, v: IN2 },
  { t: T.gap - 0.1, d: 0.6, e: E.in, v: { ...HID, dy: H * 1.25 } },
];

// Feature wall: tiles land one per beat on the drop.
const tiles = (C.tiles || []).slice(0, 8);
const wallWrap = h("div", "layer", wallL);
const tileEls = (() => {
  const cols = WIDE ? 4 : 2;
  const rows = Math.ceil(tiles.length / cols);
  const G = 22 * S;
  const top = WIDE ? 70 * S : H * 0.13;
  const areaH = WIDE ? H - 140 * S : H * 0.74;
  const tw = (W - 2 * 48 * S - (cols - 1) * G) / cols;
  const th = Math.min((areaH - (rows - 1) * G) / rows, tw * 1.05);
  const y0 = top + (areaH - rows * th - (rows - 1) * G) / 2;
  return tiles.map((tl, i) => {
    const e = h("div", "tile", wallWrap);
    const c = i % cols, r = Math.floor(i / cols);
    css(e, { left: 48 * S + c * (tw + G) + "px", top: y0 + r * (th + G) + "px", width: tw + "px", height: th + "px" });
    h("div", "lab", e, `${tl.title}${tl.sub ? `<small>${tl.sub}</small>` : ""}`);
    const art = h("div", "art", e);
    if (tl.big) art.innerHTML = `<div class="display" style="font-size:${110 * S}px;line-height:1;color:var(--acc)">${tl.big}</div>`;
    else {
      // A small abstract graphic per tile; replace with the real thing (a stat, a mini UI, an icon).
      const n = 4 + (i % 3);
      art.innerHTML = Array.from({ length: n }, (_, k) => `<div style="height:${14 * S}px;margin-bottom:${12 * S}px;border-radius:99px;background:var(--acc);opacity:${0.25 + 0.6 * hash(i * 7 + k)};width:0"></div>`).join("");
    }
    return { e, art, bars: [...art.children].filter((x) => x.style.width === "0px"), i };
  });
})();
const gapB = C.gap ? textBlock(capL, C.gap, 120 * S, H * 0.4) : null;

// End card
const endName = textBlock(endL, CFG.name, 210 * S, H * 0.36);
const endTag = textBlock(endL, C.tagline, 54 * S, H * 0.36 + 250 * S, "sub center");
const endCta = C.cta ? textBlock(endL, C.cta, 64 * S, H * 0.36 + 360 * S, "display center") : null;
const endUrl = CFG.url ? textBlock(endL, CFG.url, 44 * S, H * 0.36 + (C.cta ? 470 : 360) * S, "sub center") : null;
const badgeRow = h("div", "abs", endL);
css(badgeRow, { left: "0px", right: "0px", top: H * 0.36 + (C.cta ? 560 : 450) * S + "px", display: "flex", gap: 24 * S + "px", justifyContent: "center" });
const badges = (CFG.badges || []).map((src) => {
  const img = h("img", "", badgeRow);
  img.src = src;
  css(img, { height: 104 * S + "px" });
  return img;
});

// ---------------------------------------------------------------------------
// Scenes: draw at time t
// ---------------------------------------------------------------------------
function renderBg(t) {
  const gx = W / 2 + W * 0.2 * Math.sin(t * 0.21);
  const gy = H * 0.6 + H * 0.13 * Math.cos(t * 0.17);
  const pulse = 1 + 0.35 * (t >= T.wall ? Math.exp(-(t - T.wall) * 1.6) : 0) + 0.25 * (t >= END_HIT ? Math.exp(-(t - END_HIT) * 1.4) : 0);
  const R = Math.max(W, H) * 0.47 * pulse;
  css(bg, { background: `radial-gradient(${f2(R)}px ${f2(R)}px at ${f2(gx)}px ${f2(gy)}px, color-mix(in srgb, var(--acc) ${darkGround ? 14 : 9}%, transparent), transparent 70%), linear-gradient(180deg, var(--ground) 0%, var(--ground2) 140%)` });
}

function renderTitle(t) {
  // Hook: whole at t = 0, leaves on the problem.
  show(hook.el, t < T.problem + 0.6 ? 1 : 0);
  words(hook.spans, t, -10, T.problem - 0.1, { stagger: 0.03 });
  sheen(hook.spans, t);
  if (hookSub) {
    show(hookSub.el, t < T.problem + 0.6 ? 1 : 0);
    words(hookSub.spans, t, -10, T.problem - 0.15);
  }
  // Problem lines: one every two beats, each replacing the last.
  problems.forEach((p, i) => {
    const a = T.problem + i * 2 * BEAT;
    const b = i < problems.length - 1 ? a + 2 * BEAT - 0.12 : T.reveal - 0.12;
    show(p.el, t >= a - 0.02 && t < b + 0.6 ? 1 : 0);
    words(p.spans, t, a, b);
    sheen(p.spans, t);
  });
  // Reveal: mark, then name, then tagline; it all clears before the first feature.
  const on = t >= T.reveal - 0.05 && t < T.features[0] + 0.4;
  show(mark, on ? 1 : 0);
  if (on) {
    const u = sp(t, T.reveal, MO.spring === "pop" ? "pop" : "box");
    const out = E.in(prog(t, T.features[0] - 0.35, T.features[0] + 0.1));
    css(mark, { transform: `translateY(${f2((1 - u) * 160 * S - out * 200 * S)}px) scale(${f2(0.6 + 0.4 * u)})`, opacity: f2(clamp(u * 2) * (1 - out)) });
  }
  show(nameB.el, on ? 1 : 0);
  words(nameB.spans, t, T.reveal + BEAT, T.features[0] - 0.3, { stagger: 0 });
  show(tagB.el, on ? 1 : 0);
  words(tagB.spans, t, T.reveal + 2 * BEAT, T.features[0] - 0.3, { stagger: 0.03 });
}

function renderDevice(t) {
  if (!DEVICE) return;
  const p = track(t, MOVES);
  const drift = Math.sin(t * 0.6) * 4;
  css(DEVICE.root, { transform: `translate3d(${f2(p.dx)}px, ${f2(p.dy + drift)}px, 0) rotateY(${f2(p.ry)}deg) rotateX(${f2(p.rx)}deg) rotateZ(${f2(p.rz)}deg) scale(${f2(p.s * 1000) / 1000})` });
  vis(DEVICE.root, p.dy < H * 1.1);
  // Glass sweep as the device arrives and on each new screen.
  let x = -140;
  for (const t0 of T.features.map((f) => f + 0.5)) if (t >= t0 && t < t0 + 1) x = lerp(-100, 100, E.io(prog(t, t0, t0 + 1)));
  css(DEVICE.sweep, { transform: `translateX(${f2(x)}%)` });
  // Screens push like a navigation stack; inside each, rows land and the button gets a tap.
  screens.forEach((s, i) => {
    const a = T.features[i];
    const b = i < screens.length - 1 ? T.features[i + 1] : Infinity;
    let xx = 0, o = 1;
    if (i > 0) xx = (1 - E.io(prog(t, a, a + 0.55))) * 100;
    if (t >= b) xx = -35 * E.io(prog(t, b, b + 0.55));
    if ((i > 0 && t < a) || t >= b + 0.55) o = 0;
    show(s.el, o);
    css(s.el, { transform: `translateX(${f2(xx)}%)` });
    if (!s.rows) return;
    s.rows.forEach((r, k) => {
      const u = sp(t, a + 0.3 + (k + 1) * BEAT * 0.5, "ui");
      css(r, { transform: `translateY(${f2((1 - u) * 24)}px)`, opacity: f2(clamp(u * 1.6)) });
    });
    const tapAt = tapTime(i);
    const tu = prog(t, tapAt - 0.05, tapAt + 0.42);
    show(s.tap, t > tapAt - 0.05 && tu < 1 ? (tu < 0.25 ? tu / 0.25 : 1 - (tu - 0.25) / 0.75) : 0);
    css(s.tap, { left: DEVICE.sw / 2 + "px", top: DEVICE.sh - (DEVICE.kind === "phone" ? 86 : 66) + "px", transform: `scale(${f2(0.55 + 0.75 * E.out(tu))})` });
    css(s.btn, { transform: `scale(${f2(1 - 0.04 * Math.sin(Math.PI * prog(t, tapAt - 0.02, tapAt + 0.2)))})` });
  });
}

function renderCaptions(t) {
  caps.forEach((c, i) => {
    const a = T.features[i];
    const b = i < caps.length - 1 ? T.features[i + 1] - 0.15 : T.gap - 0.15;
    const on = t >= a - 0.05 && t < b + 0.6;
    show(c.b.el, on ? 1 : 0);
    words(c.b.spans, t, a, b);
    sheen(c.b.spans, t);
    if (c.sub) {
      show(c.sub.el, on ? 1 : 0);
      words(c.sub.spans, t, a + BEAT, b);
    }
  });
  if (gapB) {
    const on = t >= T.gap - 0.05 && t < T.wall + 0.5;
    show(gapB.el, on ? 1 : 0);
    words(gapB.spans, t, T.gap + 0.1, T.wall - 0.25, { stagger: BEAT / 2 });
    sheen(gapB.spans, t);
  }
}

function renderWall(t) {
  const on = t >= T.wall - 0.05 && t < T.end + 0.7;
  show(wallL, on ? 1 : 0);
  if (!on) return;
  const zoom = 1.04 - 0.05 * E.sine(prog(t, T.wall, T.end));
  css(wallWrap, { transform: `scale(${f2(zoom * 1000) / 1000})`, transformOrigin: `${W / 2}px ${H / 2}px` });
  tileEls.forEach((x) => {
    const t0 = T.wall + x.i * BEAT;
    const u = sp(t, t0, MO.spring === "soft" ? "box" : "pop");
    const out = E.in(prog(t, T.end - 0.12 + x.i * 0.025, T.end + 0.3 + x.i * 0.025));
    show(x.e, t >= t0 ? clamp(u * 2.5) * (1 - out) : 0);
    css(x.e, { transform: `translateY(${f2((1 - u) * 90 * S - out * 160 * S)}px) scale(${f2((0.82 + 0.18 * u) * (1 + 0.15 * out))})` });
    x.bars.forEach((b, k) => css(b, { width: f2(clamp(sp(t, t0 + 0.15 + k * 0.08, "box")) * (45 + 55 * hash(x.i * 13 + k))) + "%" }));
  });
}

function renderEnd(t) {
  const on = t >= T.end - 0.05;
  show(endL, on ? 1 : 0);
  if (!on) return;
  // Never a frozen last frame: a slow drift, and a small kick on the end hit.
  const drift = 1 + 0.025 * E.sine(prog(t, T.end, DURATION));
  const hit = t >= END_HIT ? 0.012 * Math.exp(-(t - END_HIT) * 5) * Math.sin((t - END_HIT) * 20) : 0;
  css(endL, { transform: `scale(${f2((drift + hit) * 1000) / 1000})`, transformOrigin: `${W / 2}px ${H / 2}px` });
  words(endName.spans, t, T.end + 0.05, null, { stagger: 0 });
  sheen(endName.spans, t);
  words(endTag.spans, t, T.end + BEAT, null);
  if (endCta) words(endCta.spans, t, T.end + 2 * BEAT, null);
  if (endUrl) words(endUrl.spans, t, T.end + 3 * BEAT, null);
  badges.forEach((b, i) => {
    const u = sp(t, T.end + BAR + i * BEAT, "pop");
    show(b, clamp(u * 2.5));
    css(b, { transform: `translateY(${f2((1 - u) * 40 * S)}px) scale(${f2(0.85 + 0.15 * u)})` });
  });
}

// ---------------------------------------------------------------------------
// Sound cues: tools/sfx.mjs synthesises each type in the song's key and levels it against the music under it.
// voice(t, "file") places a clip from assets/voice so its first word lands on t (set CONFIG.voiceLead to the clip's silent lead-in).
// ---------------------------------------------------------------------------
const CUES = [];
const cue = (t, type, gain = 1, note = 0, file) => CUES.push({ t: +t.toFixed(4), type, gain, note, ...(file ? { file } : {}) });
const voice = (t, file) => cue(t - (CFG.voiceLead ?? 0.18), "voice", 1, 0, file);
function planCues() {
  cue(0.02, "node", 0.7, 0);
  problems.forEach((_, i) => {
    cue(T.problem + i * 2 * BEAT - 0.1, i ? "swish" : "whoosh", 0.8);
    cue(T.problem + i * 2 * BEAT + 0.04, "thump", 0.9);
  });
  cue(T.reveal - BEAT - 0.02, "riser2", 0.9);
  cue(T.reveal, "impact", 0.8);
  cue(T.reveal + BEAT, "pop", 0.9);
  cue(T.reveal + 2 * BEAT, "tick", 0.7);
  T.features.forEach((a, i) => {
    cue(a - 0.1, "whoosh", 0.9);
    if (DEVICE) cue(a + 0.5, "shimmer", 0.7);
    screens[i]?.rows?.forEach((_, k) => cue(a + 0.3 + (k + 1) * BEAT * 0.5, "node", 0.6, k + 1));
    if (screens[i]?.tap) cue(tapTime(i), "tap");
  });
  if (gapB) {
    cue(T.gap, "whoosh", 0.7);
    cue(T.wall - BEAT - 0.02, "riser2");
  }
  cue(T.wall, "impact");
  tileEls.forEach((x) => cue(T.wall + x.i * BEAT + 0.02, "pop", 0.75));
  cue(T.end, "swish");
  cue(T.end + 0.05, "thump");
  badges.forEach((_, i) => cue(T.end + BAR + i * BEAT, "pop", 0.8));
  cue(END_HIT, "end");
}

// ---------------------------------------------------------------------------
// Seek: draw, then wait for anything asynchronous (image sequences, canvases) before the frame is captured.
// ---------------------------------------------------------------------------
function render(t) {
  renderBg(t);
  renderTitle(t);
  renderDevice(t);
  renderCaptions(t);
  renderWall(t);
  renderEnd(t);
}
let seekChain = Promise.resolve();
window.seek = (t) => {
  seekChain = seekChain.then(async () => {
    render(Math.max(0, Math.min(DURATION, t)));
  });
  return seekChain;
};
window.CUES = CUES;

async function init() {
  await document.fonts.ready;
  await Promise.all([`400 100px "${CFG.fonts.display}"`, `italic 400 100px "${CFG.fonts.display}"`, `500 20px "${CFG.fonts.body}"`, `700 20px "${CFG.fonts.body}"`].map((f) => document.fonts.load(f).catch(() => {})));
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  // Measure after the fonts load: lines shrink to fit instead of wrapping.
  for (const b of [hook, hookSub, ...problems, nameB, tagB, gapB, endName, endTag, endCta, endUrl].filter(Boolean)) fitFont(b);
  for (const c of caps) {
    fitFont(c.b, WIDE ? W * 0.5 - M * 1.5 : W - 2 * M);
    if (c.sub) fitFont(c.sub, WIDE ? W * 0.5 - M * 1.5 : W - 2 * M);
  }
  planCues();
  await window.seek(0);
  window.ready = true;
}
init();

// ---------------------------------------------------------------------------
// Preview (not used by the renderer): Space plays with the music, arrows step a frame, the slider scrubs.
// ---------------------------------------------------------------------------
if (!RENDER) {
  const pp = $("#pp");
  const scrub = $("#scrub");
  const tc = $("#tc");
  const audio = new Audio(CFG.music.file);
  let playing = false, t0 = 0, start = 0, cur = 0, busy = false;
  const showT = (t) => {
    cur = t;
    scrub.value = String(t / DURATION);
    tc.textContent = `${t.toFixed(2)}s  bar ${Math.floor(t / BAR) + 1}.${Math.floor((t % BAR) / BEAT) + 1}`;
  };
  const go = (t) => {
    showT(t);
    if (busy) return;
    busy = true;
    window.seek(t).then(() => (busy = false));
  };
  const frame = (now) => {
    if (!playing) return;
    const t = start + (now - t0) / 1000;
    if (t >= DURATION) {
      playing = false;
      pp.textContent = "Play";
      audio.pause();
      return go(DURATION);
    }
    go(t);
    requestAnimationFrame(frame);
  };
  pp.onclick = () => {
    playing = !playing;
    pp.textContent = playing ? "Pause" : "Play";
    if (playing) {
      start = cur >= DURATION - 0.01 ? 0 : cur;
      t0 = performance.now();
      audio.currentTime = CFG.music.songStart + start;
      audio.play().catch(() => {});
      requestAnimationFrame(frame);
    } else audio.pause();
  };
  scrub.oninput = () => {
    playing = false;
    audio.pause();
    pp.textContent = "Play";
    go(Number(scrub.value) * DURATION);
  };
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      pp.onclick();
    }
    if (e.code === "ArrowRight") go(Math.min(DURATION, cur + 1 / 30));
    if (e.code === "ArrowLeft") go(Math.max(0, cur - 1 / 30));
  });
}
