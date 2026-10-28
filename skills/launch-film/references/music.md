# Music, sound and voice

## Choosing the tempo
- The user may give a BPM, a feeling, a reference, or nothing. With nothing, use the vibe's range (vibes.md).
- Tempo sets the edit: at 120 BPM a beat is 0.5 s and a bar 2 s, so a 40 s film is 20 bars. At 90 BPM, 40 s is 15 bars: fewer, calmer
  events. Below ~95 BPM, cut on every second beat in busy scenes; above ~135, put text on every second beat so it stays readable.
- Half and double time are both fine: a 62 BPM ballad carries a 124 BPM edit grid. `music_search.mjs` marks these.

## Finding tracks: `scripts/music_search.mjs`
```
node music_search.mjs --bpm 100 --vibe warm --len 40 --out music          # vibe's Mixkit pages, ±6 BPM
node music_search.mjs --bpm 124 --sources electronic,tag/uplifting --pages 2 --tol 4
node music_search.mjs --bpm 90 --file ~/Music/ours.mp3 --file ~/Music/alt.wav   # measure the user's own tracks
```
It lists tracks from Mixkit's genre, mood and instrument pages, downloads them (cached in `~/.cache/launch-film/mixkit`), measures
tempo, kick-fitted grid, key and lifts, keeps those near the target, ranks them (tempo, a lift inside the film, a clean grid, enough
length) and cuts previews the length of the film. It takes about 3–6 s per track; `--max` caps the downloads (default 40).

**Then let the user listen.** The tools measure tempo and structure, not mood, and Claude cannot hear. Present 4–6 previews with
players (an Artifact page with base64 `<audio>` works well; otherwise give the file paths) plus one line each on feel and why it fits,
and say plainly that the picks are made on paper. Recommend one and name the runner-up. Never commit to a track the user hasn't heard.

## Sources and licences (say which applies when presenting)
- **Mixkit** (default): free, commercial use in videos allowed, no credit required (https://mixkit.co/license/#musicFree). Credit anyway
  in BEATMAP.md. Don't sell or redistribute the track on its own.
- **Pixabay Music**: free under the Pixabay Content License; some tracks are registered with Content ID, so YouTube may flag them.
- **YouTube Audio Library**: free for YouTube; check each track's attribution rule.
- **Uppbeat, Artlist, Epidemic Sound, Musicbed**: subscription licences; the user downloads under their own account.
- **Trending/commercial songs**: not for ads or brand accounts (TikTok business accounts must use the Commercial Music Library).
  A personal post can add a platform sound in-app after export instead of baking it in.
- Only use files the user has rights to. When unsure, ask.

## Placing the song: `scripts/beat.mjs`
```
node beat.mjs track.mp3                 # tempo, grid (kick fit), key, per-bar energy chart, lifts and drop-outs
node beat.mjs track.mp3 --land 16:14    # song bar 16 (the drop) lands on film bar 14 → prints songStart
```
- Read the bar chart: quiet intro bars, the build, the drop (biggest jump), breakdowns (drop-outs). Land the drop on the scene that
  should hit hardest; a drop-out just before it is a gift (put a single line there and let the music vanish).
- Check the grid: "kick fit rms" under ~12 ms is solid. Above that, or with "from onsets", probe the beat by rendering a `probe` sheet
  and playing the draft; nudge `songStart` by a few ms if hits feel early or late.
- Make sure the song runs at least to the end hit (the scaffold warns if not). The mix fades the music out after the end hit.

## Sound effects: tools/sfx.mjs
- All synthesised (sines, filtered noise, envelopes), seeded, no samples: taps, ticks, pops, nodes, chimes, success, whoosh, swish,
  sheets, risers, thumps, impacts, shimmer, boing, paper, keys, end sting. Tonal ones use the song's pentatonic scale (from
  `CONFIG.music.key`), so they never clash.
- Each cue is levelled against the music under it (`LEVEL[type] = [measure offset, window, dB relative to music]`), because the music
  swings ~25 dB between breakdown and drop. Fixed gains vanish in the drop and shout in the breakdown.
- Cues come from `planCues()` in film.js: `cue(t, type, gain, note)`. Place them from the same `T`/`bt()` values as the visuals.
- New sound: add a function to `S` and a `LEVEL` entry. Keep them short and quiet; the music is the bed.

## Voice
- Real voice clips (the product's own audio, a recorded line, TTS) go in `assets/voice/`, placed with `voice(t, "file")` so the first
  word lands on `t` (set `CONFIG.voiceLead` to the clips' silent lead-in; measure it with `silencedetect`).
- They render to a separate stem; `mix.mjs` lifts it (`--voice-db`, default +3) and ducks the music under it with a sidechain
  compressor (`--duck`, ratio 4). Aim for voices 6–8 dB above the ducked music.
- Paid TTS (ElevenLabs etc.) costs money: show the script and the credit estimate and get a yes first. Lines in a language the user
  doesn't speak need a native speaker's review before they ship.

## Mix: tools/mix.mjs
Music trimmed at `songStart`, short fade-in, fade-out after the end hit, plus sfx and the ducked voice, limited, then two-pass loudnorm
to -14 LUFS integrated, -1 dBTP (right for Reels, TikTok, Shorts, YouTube, X). Verify with
`ffmpeg -i out.mp4 -af ebur128=peak=true -f null -`.
