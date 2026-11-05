# Direction and review (lessons from AI film directing)

Adapted from Eian's workflow for AI short films (x.com/eianlu/article/2118317430665613741). That article's core rule applies to launch films too: **each stage costs more to fix than the one before, so catch errors as early as possible.** For this skill the stages are: words (free) → stills (seconds) → draft render (a minute) → full 60 fps render (minutes) → any paid generation (money).

## 1. Story check before any scene code
Write the direction (thesis, hook, features, payoff, end card) as a beat list, then check it:
- **One sentence.** Write what the film says in one line before anything else. If you can't, the direction isn't done.
- **Hook in the first seconds.** The strongest image is up front, readable on frame 0. Say which second it lands on.
- **Reality check every claim and every on-screen action.** Is the feature live today? Would the UI actually behave like that? Could a person really tap there?
- **Human reactions** (if the film shows people or reactions, e.g. notifications, chat replies, faces): stagger them. Several things reacting in the same frame looks fake. Problem → product solves it → reaction.

## 2. Shot design rules (apply to every scene)
- **Change the angle/scale each beat.** Alternate full-device, close-up on one UI element, over-the-shoulder of the phone, type-only. Never several beats in a row at the same scale.
- **The frame is never dead.** Each beat names what moves: camera push, focus pull, a light sweep, something entering or exiting frame, a small UI gesture. At least one per beat. Keep deliberate still moments for contrast; constant motion is as bad as none.
- **Motivated camera.** Three workhorse moves: follow an object (a card flying into place), slow push-in to a detail, start tight and pull back to reveal.
- **Every frame is a still you'd keep.** Put the subject's focal point (a face, the key UI element, the headline's first word) near 38% or 62% of the width, not dead centre, unless the vibe is strictly symmetrical (keynote hero shots).
- **Palette is designed up front** as a per-scene colour table, from brand tokens. Validate it in greyscale: render the stills, convert (`ffmpeg -i s.png -vf hue=s=0 g.png`), and if the subject merges with the background, fix the values.

## 3. Fresh-eyes reviewer agents
The agent that built the film knows what it meant and fills the gaps. A fresh subagent that sees only the artifact behaves like a first-time viewer. Use one at three gates; it finds faults only and never edits files. Save verdicts in `<film>/reviews/`.

**Direction review** (before scaffolding; give it only the beat list):
> This is the beat list of a product launch film. You are seeing it for the first time; find problems only, don't edit files.
> 1. Write the film as you understood it. 2. State its message in one sentence. 3. Does the hook land in the first 2 seconds?
> 4. Any claim or on-screen action that seems untrue or implausible? 5. Any beat where nothing moves, or the same shot size repeats?
> Each issue: beat, problem, suggested fix. Mark uncertain ones "possibly". End with PASS or FAIL.

**Stills review** (before the full render; give it the stills + probe sheets + palette table): checks composition (38/62), readability at phone size, things peeking in, stray artefacts, palette consistency, greyscale separation. PASS or FAIL.

**Final review** (give it only the encoded file):
> This is a finished launch film. You are watching it for the first time; I'm giving you no conclusions.
> Decode it; take frames per beat and 3 frames either side of every cut. Write what you understood the product does, then what was unclear. Check: repeated beats, jumps, colour shifts, unreadable or cut-off text, motion-blur-smeared text, anything off-screen peeking in. State what you can't check (feel of motion, sound).
> Each item: timestamp, frame, problem, HARD FAULT or MINOR.

## 4. Working rules
- New versions get new filenames (`out/<slug>_v2.mp4`); don't overwrite earlier renders or delete takes.
- Say explicitly what you haven't watched in motion or heard.
- Fix in code before re-generating anything paid.
- After delivery, add a short retro to `BEATMAP.md` (what worked, what broke, the fix) so the next film starts from it.
