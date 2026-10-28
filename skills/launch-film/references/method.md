# The method: films as a pure function of time

Read this before writing or changing scenes. It is what makes the films frame-exact, beat-exact and re-renderable.

## Contents
1. The one rule
2. Engine pieces (film.js)
3. Timeline and beat map
4. Rendering
5. Review loop (stills, probe sheets, draft)
6. Gotchas learned the hard way

## 1. The one rule
`window.seek(t)` draws time `t` and nothing else. No CSS transitions or animations, no `setTimeout`, no `requestAnimationFrame` loops,
no `Math.random` (use `hash(n)`), no state carried from the previous frame. Every value is computed from `t`. That is why the renderer
can take frames in any order, split them across Chrome processes, and blend sub-frames for motion blur, and why a re-render months later
is identical.

Anything asynchronous (image sequences, canvas drawing, decoded video frames) is queued during `render(t)` and awaited inside the
`seek` promise chain (see the `WANTS` → `drawSeqs()` pattern below). The renderer awaits `seek(t)` plus two animation frames before
each screenshot.

## 2. Engine pieces (in the template's film.js)
- **Springs**: `spring(dt, f, z)` is the closed-form step response; `sp(t, t0, kind)` with presets in `SP`
  (`ui` 3.1 Hz/0.8, `box` 2.0/0.82, `type` 1.75/0.84, `soft` 1.25/0.9, `snap` 4.2/0.74, `pop` 2.6/0.58). Damping below ~0.7
  overshoots (playful); 0.85+ feels calm (warm, cinematic). A value with several targets is the sum of one spring per change.
- **Tracks**: `track(t, moves)` interpolates keyframed objects (`{t, d, e, v}`) for devices and cameras. Moves must not overlap.
- **Words**: `textBlock(parent, lines, size, top)` splits copy into masked word spans; `*accent words*` get the accent colour and a
  drifting sheen. `words(spans, t, tIn, tOut, {mode})` animates them: `rise` (out of masks), `slam`, `pop`, `fade`. `fitFont` shrinks
  a block after fonts load so lines never wrap.
- **show / css**: `css()` only writes changed styles (cheap per frame); `show(el, opacity)` also toggles visibility.
- **Devices**: a CSS-3D phone (extruded slab layers, bezel gradient, island, glass sweep), a flat phone, or a browser window. A two-phone
  shot (iOS + Android) is two `makePhone` calls with their own status bar, camera cut-out and tab bar.
- **Image sequences** (a mascot, a 3D render, a product turntable): transparent WebP frames drawn into canvases. Pattern:
  ```js
  function seq(canvas, name, clipTime) { WANTS.push({ canvas, name, i: frameIndex(clipTime) }); }   // during render(t)
  async function drawSeqs() { const ws = WANTS; WANTS = []; const ims = await Promise.all(ws.map(load)); /* drawImage each */ }
  window.seek = (t) => (chain = chain.then(async () => { render(t); await drawSeqs(); }));
  ```
  Cut sequences at their source resolution, matted with the product's own tool when it has one.
- **Preview controls**: opening `film.html` gives play (with the music from `songStart`), scrub, and frame stepping.

## 3. Timeline and beat map
- Everything is placed with `bt(bar, beat)`: `(bar-1)*BAR + (beat-1)*BEAT`. Bars are 4 beats. Film bar 1 beat 1 is t = 0.
- `CONFIG.music.songStart` is where in the song film t = 0 sits. Choose it so the song's biggest lift (the drop) lands on the scene
  that should hit hardest (feature wall, logo). `beat.mjs --land songBar:filmBar` computes it.
- One thing happens on every beat: a word, a tap, a tile, a cut. Nothing sits still for more than about a second; the end card drifts.
- Frame 0 is the poster: the hook must already be readable at t = 0 (feeds show it before anyone presses play, and it is the thumbnail).
- Write `BEATMAP.md` as you go: bars, seconds, what happens on which beats, and the music section under it. It is the review document
  and the rebuild guide.

## 4. Rendering (tools/render.mjs)
- Headless Chrome over the DevTools protocol with a built-in static server: no npm packages. Needs Node 22+, ffmpeg and Chrome.
- `stills --at 0,9.9 --name a,b` · `probe` (one labelled frame per beat, tiled) · `cues` (writes cues.json) · `draft` (30 fps, no blur)
  · `full --sub 4 --jobs 4` (60 fps, 4 sub-frames over a 180° shutter blended with `tmix` = real motion blur). `--variant` picks a look.
- Output is BT.709 TV-range H.264 + faststart. A 40 s 9:16 film renders in about 1.5 min draft and 8 min full on an M-series Mac with
  4 jobs. Run the full render in the background and do review work meanwhile.
- WebGL or heavy canvas: add `--gpu`. Driving a live web app instead of a rebuilt one: point the renderer at its dev server and expose
  a film hook (a `?film` flag that stops the app's own clocks and exposes a camera/time API).

## 5. Review loop
1. Stills of 5–9 key moments → look at them (Read the PNGs) → fix → show the user before any long render.
2. `probe` contact sheets at phone width: one frame per beat, labelled `bar.beat`. Look for cramped, overlapping or unreadable frames,
   elements peeking in from off-screen, and anything frozen.
3. `cues` → `sfx` → `draft` → `mix` → watch the draft. Only then `full`.
4. Verify the final file: `ffprobe` (size, fps, duration, audio), `ebur128` loudness (≈ -14 LUFS, true peak ≤ -1 dBTP), and a strip of
   frames pulled from the encoded video at fast moments (motion blur can smear text).

## 6. Gotchas
- Measure text after `document.fonts.ready` and explicit `document.fonts.load()` calls; place underlines and marks from measured widths.
- No `will-change` on anything inside a scaled/3D parent: text renders blurry. Fixed-px stage at deviceScaleFactor 1 stays sharp.
- Hidden devices must be far enough off-screen that their rim or shadow doesn't peek in (and set `visibility:hidden` when off-stage).
- Elements leaving a scene must be gone before the next scene's elements arrive in the same space (end cards especially).
- Text that changes inside a morphing container needs its own mask and timing.
- Captions out of the platform's UI zones (see formats.md); never put key text in the bottom ~420 px of a 9:16 frame.
- Long strings (other languages, long product names): fit the line, never wrap; check every language in the probe sheets.
- Dates, counts and numbers on example screens must agree with each other, and screens with example data say so ("Example data").
- Voice clips have lead-in silence: offset them so the first word lands on the beat (`voiceLead`).
- Tempo tools can disagree by half a BPM: trust the kick-fitted grid only when its rms is under ~12 ms, otherwise probe by ear.
