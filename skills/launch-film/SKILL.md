---
name: launch-film
description: Make a polished, beat-synced launch or promo video for an app, website, product or feature (Apple-keynote style or another vibe) as code - an HTML page where every frame is a pure function of time, rendered frame by frame in headless Chrome to a 60 fps MP4 with motion blur, cut to the beats of a measured music track, with synthesised UI sounds in the song's key, optional voice clips with ducking, and loudness-normalised audio. Includes vibe presets (keynote, warm, playful, kinetic, product UI, cinematic, lo-fi cozy, developer), a BPM-based music finder that measures free tracks and cuts previews, and a reference-video analyser (cut rhythm, tempo, palette, contact sheets). Use this whenever someone wants a launch video, promo, teaser, trailer, app preview for social, Reels/TikTok/Shorts ad, product announcement video, feature reel, or "a video like Apple's" for something they built, or wants to redo or re-cut such a video, even if they don't say "skill" or "film".
compatibility: Node 22+, ffmpeg/ffprobe, Google Chrome or Chromium. Network for fonts, music and badges (optional yt-dlp for reference URLs). macOS or Linux.
---

# Launch film

Films are code: one HTML page whose `window.seek(t)` draws time `t`, a beat map in bars, and tools that render, sound and mix it.
The result feels like a product film from a big launch, stays true to the product, and re-renders identically whenever the copy changes.

Scripts live in `scripts/` (run with `node`), the film template in `assets/template/`, presets in `assets/vibes.json`.
Read the reference files when the step says so; they hold the details and the lessons from earlier films.

## Workflow

### 1. Brief (one round of questions)
Check `node --version` (22+), `ffmpeg -version` and Chrome first; say what's missing and how to install it.
Learn the product before asking: read its repo (README, store listing, i18n strings, theme tokens, screens), website or screenshots.
Then ask, with sensible defaults so the user can just accept:
- **Shape and length**: 9:16 ~40 s (default), 4:5, 1:1, 16:9 (`references/formats.md`).
- **Vibe**: offer the presets that fit this product (`references/vibes.md`; recommend one and say why), or "match a reference video",
  or the user's own words. Pick from the audience and feeling, not from what's flashiest: a language-learning app's owner rejected
  an EDM keynote track that fit the visuals but not the product.
- **Music**: a BPM they want, their own track, or "find me some" (the vibe's BPM range).
- **Sound**: music only / + UI sounds / + voice clips (product audio, recorded lines, or TTS; paid TTS needs a cost quote first).
- **End card**: URL, store badges (only where the listing is live), call to action.
- Anything that must not appear, languages, and when/where it will be posted.

### 2. Direction
- **Reference video?** Run `node scripts/ref_video.mjs <file|url> --out <film>/ref`, read the first frame and every contact sheet,
  complete the style card, and map it to the nearest vibe plus overrides (`references/reference-video.md`).
- Otherwise take the vibe's direction from `references/vibes.md`; brand colours and fonts override the vibe's.
- Write down: thesis line, hook (readable on frame 0), 2–4 features to show, the payoff, the end card. Every claim true today
  (`references/product.md`).

### 3. Music
- User's track: `node scripts/beat.mjs track.mp3`.
- Otherwise: `node scripts/music_search.mjs --bpm <N> --vibe <vibe> --len <seconds> --out <film>/music` (`references/music.md`).
- Show 4–6 previews the user can play (an Artifact page with embedded `<audio>` players if the Artifact tool is available, else paths),
  each with BPM, feel, where it lifts and why it fits. Say that you chose on paper and can't hear them. Recommend one; wait for a pick.

### 4. Scaffold and build
```
node scripts/new_film.mjs <folder> --name "Name" --vibe <vibe> --format 9:16 --music <track> [--land songBar:filmBar] \
     [--url example.com] [--badges appstore,googleplay] [--logo logo.svg] [--accent "#hex"]
```
This copies the engine and example scenes, downloads the vibe's fonts, measures the music, lands its biggest lift on the feature wall,
fetches official badges and writes `film.config.js` (settings, timeline in bars, placeholder copy) and `BEATMAP.md`.
Then make it the product's film: real copy in `film.config.js`, real screens rebuilt in code (or screenshots first), scenes added or
reshaped in `film.js`, the timeline fitted to the song's lifts. Read `references/method.md` before writing scenes: no transitions,
timers or randomness; one event per beat; frame 0 is the poster.

### 5. Show before the long render
Render 5–9 key stills (`node tools/render.mjs stills --at ... --name ...`), look at them yourself, fix, then show the user the stills
and the beat map (an Artifact page with the stills and, if useful, two or three look variants side by side). Run `probe` contact sheets
and fix anything cramped, overlapping, peeking in or frozen. Get a go-ahead on direction before the full render.

### 6. Sound, draft, final
```
node tools/render.mjs cues && node tools/sfx.mjs
node tools/render.mjs draft && node tools/mix.mjs --video out/main/video-30.mp4 --out out/main/draft.mp4
node tools/render.mjs full --sub 4 --jobs 4 && node tools/mix.mjs --video out/main/video-60.mp4 --out out/<slug>.mp4
```
Run the full render in the background (minutes) and keep working. Verify the final: ffprobe (size, 60 fps, duration, audio),
`ebur128` (≈ -14 LUFS, peak ≤ -1 dBTP), and a strip of frames from the encoded file at fast moments.

### 7. Deliver
Give the file path, length, format and loudness; the music credit and licence; anything to wait for before posting (store not live
in a region, a feature not shipped on one platform); how to re-render another look (`--variant`) or shape. Keep `BEATMAP.md` current
(beat map, rebuild commands, honesty notes with sources) so the next session or person can change it. If the user can't hear-check
in the session, ask them to listen to the mix, especially voice level.

## Principles that made earlier films work
- Something happens on every beat; the biggest musical moment lands on the strongest visual (feature wall, logo).
- The real product on screen, rebuilt from its own tokens and strings; never stock UI.
- One accent colour, big type, generous space, never a frozen frame.
- Sounds are synthesised in the song's key and levelled against the music under each one; voices duck the music.
- Show stills before rendering; measure before claiming (tempo, loudness, frame checks); say plainly what you couldn't check.
