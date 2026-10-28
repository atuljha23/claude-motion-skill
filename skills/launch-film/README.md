# launch-film

A Claude skill for making beat-synced launch and promo videos for apps, sites and products, written as code and rendered
frame-exact to MP4.

## Install
Copy this folder to `~/.claude/skills/launch-film` (personal) or `.claude/skills/launch-film` in a repo (shared with that team),
or install the packaged `launch-film.skill`. Needs Node 22+, ffmpeg and Google Chrome (or Chromium).

## Use
Ask Claude for a launch video ("make a 40 s Reels launch video for my app, Apple style", "a warm promo for our learning app at about
95 BPM", "make it feel like this reference: ~/Downloads/ref.mp4").

## What's inside
- `SKILL.md`: the workflow Claude follows.
- `scripts/beat.mjs`: tempo, kick-fitted beat grid, key, per-bar energy and lifts of a track; where to start it so the drop lands.
- `scripts/music_search.mjs`: finds free Mixkit tracks near a BPM for a vibe, measures them and cuts previews.
- `scripts/ref_video.mjs`: measures a reference video (cuts, change events, tempo, palette) and makes contact sheets.
- `scripts/new_film.mjs`: scaffolds a film folder (engine, scenes, tools, fonts, music, badges, config, beat map).
- `assets/template/`: the film engine, example scenes, and the render / sound / mix tools copied into each film.
- `assets/vibes.json`: vibe presets (keynote, warm, playful, kinetic, product, cinematic, cozy, developer). Add your own or a brand kit.
- `references/`: method, vibes, music, reference videos, formats, showing the product honestly.

## Licences
Music found by `music_search.mjs` comes from Mixkit under its Free Music Licence; check the licence for your use. Store badges are
Apple's and Google's official artwork and follow their guidelines. Fonts come from Google Fonts (open licences).
