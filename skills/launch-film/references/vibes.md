# Vibes

A vibe is a complete direction: tempo range, music, type pairing, palette approach, motion grammar, devices, sound palette and a
structure. The data (palettes, fonts, springs, Mixkit sources) is in `assets/vibes.json`; this file is the reasoning. Pick the vibe
from the **audience and the feeling the product should leave**, not from what looks impressive: a language-learning app on an EDM
keynote track felt wrong to its owner, even though the film was otherwise right.

When the user names a reference instead ("like the iPhone 17 film", a link, a file), analyse it (reference-video.md), then pick the
closest vibe and override what the reference does differently. Brand colours and fonts always override the vibe's.

| Vibe | Feels | BPM | Music | Good for |
|---|---|---|---|---|
| keynote | confident, premium | 115–128 | electronic / indie pop with build, gap, drop | launches, new versions, hardware-feeling apps |
| warm | kind, encouraging | 85–112 | acoustic folk, ukulele, piano, fiddle | learning, health, family, community |
| playful | bright, funny | 118–140 | funk, upbeat pop, ukulele + claps | consumer, social, games, creator tools |
| kinetic | loud, urgent | 124–150 | hip hop, house, driving drums | announcements, manifestos, paid-social hooks |
| product | clear, trustworthy | 100–124 | minimal electronic, light corporate | SaaS, dashboards, fintech, civic tools |
| cinematic | emotional, slow | 70–96 | orchestral, piano, ambient score | hardware, travel, luxury, brand stories |
| cozy | calm, intimate | 70–92 | lo-fi hip hop, chillhop, soft jazz | productivity, journaling, study, reading |
| developer | precise, nerdy | 110–132 | synthwave, electronica, minimal techno | CLIs, APIs, SDKs, open source |

## keynote (Apple-style launch)
- **Look**: near-black or Apple white ground; ONE accent; huge display type (serif italic for accent words works well), body in a clean
  grotesk. Lots of empty space; the product is the only colour.
- **Motion**: words rise out of masks on a `type` spring, 0.06 s stagger; devices turn in 3D (ry ±8–24°, rx 3–8°) with a glass sweep
  each time they settle; a slow camera push on every shot; the background glow pulses on the drop.
- **Structure**: hook on frame 0 → a question or two → name reveal on the first lift → 2–4 features, each one device action timed to
  beats → music drops out on a single line ("From X to Y") → **feature wall (bento) lands one tile per beat on the drop** → "Free" /
  pricing line → hero shot of all devices → end card (mark, name, tagline, store badges, URL) → end hit.
- **Sound**: whoosh on moves, shimmer on glass sweeps, thump on word slams, riser into the drop, impact on it, pops per tile, a low end sting.
- **Avoid**: emoji, stock UI kits, crossfades between screens, bouncy overshoot, more than one accent, gradients on UI.

## warm (learning, health, family)
- **Look**: morning-light ground (pale sky, sage, linen — not the cream-and-terracotta default), deep ink, one honey/sunny accent;
  a soft serif display (Fraunces) with a friendly sans; rounded cards; a mascot or real people if the product has them.
- **Motion**: `soft` springs (z 0.9), smaller rise distances, slower staggers; flat devices that glide rather than spin; things
  settle rather than slam. Cut on every beat in the features, every 2 beats elsewhere.
- **Structure**: open on a human moment or question ("What's for dinner?"), show the product helping in two or three small wins,
  celebrate one success state, a gentle lift into the feature wall, end with an invitation ("Free to start").
- **Sound**: marimba/bell nodes in key, soft pops, a chime on success, page swishes. No impacts or risers bigger than the music.
- **Music**: acoustic, unhurried, hopeful; a lift where the band comes in instead of an EDM drop.

## playful
- **Look**: saturated sunny or night-candy palette; chunky expressive display (Bricolage Grotesque 700–800); stickers, tilted cards,
  hand-drawn arrows; icons not emoji.
- **Motion**: `pop` springs (z ≈ 0.58: overshoot), rotation on entry (±6°), squash and stretch on landings, things bump each other.
- **Sound**: boing, pop, ta-da chime, claps; tonal sounds in key.

## kinetic
- **Look**: two colours plus one hot accent; condensed display (Anton) filling the frame; hard cuts, no devices or very brief ones.
- **Motion**: one word or short phrase per beat, `slam` (scale from 1.9× to 1 on a snap spring), whole-frame colour flips on bar starts,
  occasional 2-frame holds. Readable with the sound off.
- **Sound**: thumps on every word, ticks on the off-beats, riser and impact on the drop.

## product (calm SaaS / product UI)
- **Look**: app's own tokens; off-white ground, 1 px lines, one accent; screens rebuilt in code; a soft cursor/tap drives every change.
- **Motion**: screen-studio camera: zoom (in log space) to what matters, then pull back; `ui` springs; navigation pushes, sheets spring
  up; numbers count up. Every caption readable muted.
- **Sound**: soft taps, ticks, sheet swishes, a success chime, notification sound when one arrives.

## cinematic
- **Look**: deep dusk or linen; elegant serif (Cormorant) with generous tracking for small caps; letterbox bars optional.
- **Motion**: long slow drifts (`soft`), light sweeping across the product, fades and focus pulls instead of slams; cut every 2 beats
  (or every beat of a half-time feel). Hold shots 2–4 s but keep them moving.
- **Sound**: shimmer, swells, one big impact at most; let the score carry it.

## cozy
- **Look**: muted dusk purple or paper; a soft display serif; grain or paper texture (CSS noise from `hash`, deterministic);
  hand-made underlines and doodles; warm accent like a desk lamp.
- **Motion**: slow fades and small rises, slight wobble on hand-drawn marks, typing that's human-speed.
- **Sound**: soft keys, page turns, gentle node notes.

## developer
- **Look**: terminal-dark or GitHub-light; IBM Plex Sans + Plex Mono; code with real syntax colours; diffs; a browser or terminal
  window as the device.
- **Motion**: commands type in on 16th notes, output lands on the beat, highlights sweep lines, `snap` springs.
- **Sound**: key clicks per character (quiet), ticks, a success chime when tests pass.

## Making a custom vibe
Add an entry to `assets/vibes.json` (copy the closest one) with: `bpm`, `music`, `mixkit` sources (genre pages like `folk`,
`electronic`; `mood/calm`, `mood/happy`, `mood/energetic`, `mood/fun`; `instrument/piano`, `instrument/ukulele`, `instrument/synth`,
`instrument/acoustic-guitar`; `tag/uplifting`, `tag/hopeful`, `tag/cinematic`, `tag/corporate`, `tag/technology`, `tag/trailer`),
Google `fonts`, two `looks`, `motion` (`spring`, `stagger`, `rise`, `rot`, `devices`: 3d|flat|browser|none, `transition`:
rise|slam|pop|fade) and the `sfx` it leans on. A brand kit is the same thing with the brand's colours and fonts.
