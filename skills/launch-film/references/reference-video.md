# Using a reference video

The user may share a file, a link, or just a name ("like Apple's iPhone launch", "like Linear's changelog videos"). The goal is to
borrow **rhythm, structure and visual grammar**, never the footage, music, copy, logos or characters.

## 1. Get the file
- Local file: use it directly.
- URL: `scripts/ref_video.mjs <url>` downloads with `yt-dlp` if it's installed (`brew install yt-dlp` / `pipx install yt-dlp`).
  If it isn't, ask the user to install it or to save the video and give the path. Downloading for private analysis is the user's call;
  never publish or re-use the downloaded media.
- Only a name: describe what that style is known for from your own knowledge, mark it as from memory, and map it to a vibe. Offer
  to analyse a real file if they can share one.

## 2. Measure it
```
node scripts/ref_video.mjs reference.mp4 --out ref
```
Writes `ref/style-card.md` + `.json`, `ref/first-frame.png` and `ref/sheet-NN.png`:
- **Format**: size, ratio, fps, length.
- **Editing rhythm**: hard cuts and shot lengths (live-action and cut-based edits); **change events** (bursts of on-screen motion,
  which is where a motion-graphics film keeps its rhythm); a pace sparkline; the music's BPM and key; where events sit inside the beat
  (an 8-slice histogram, compared with chance). Treat the on-beat numbers as a hint: detection runs ~50–100 ms behind the visual onset,
  and smooth spring motion blurs it. Tempo, shot lengths and the pace curve are reliable.
- **Look**: overall luminance (dark/light), ground, ink, main palette, and accent hues (colourful areas too small for the palette).
- **Frames**: one frame per shot (or 24 evenly spaced when there are few cuts) tiled into sheets. The card lists which frame is when.

## 3. Look at it
Read `first-frame.png` and every sheet. Then fill in the card's last section yourself:
type (serif/sans, weight, size relative to frame, how words enter), layout (centred, left, full-bleed product), devices and how they
move, transitions (cuts, pushes, morphs, masks), colour use, graphic devices, the hook in the first second, the end card, sound design
you can infer, and **what not to copy** (their product, their characters, their exact phrases, trademarked looks).

## 4. Turn it into a direction
- Pick the closest vibe and list the overrides: tempo (match the reference's BPM range unless the user picked one), cut rate (the
  reference's median shot length or events per second), palette approach, type pairing (find a free Google Font with a similar feel),
  motion grammar (spring and transition), structure (map their sections to bars).
- Show the user the style card summary, 2–3 frames from the reference next to what you'll do differently, and the beat map before
  building.

## Apple product films, from memory (no file needed)
Big type on near-black or white; one idea per shot; words appear in rhythm with the music; products turn slowly in 3D with light
sweeping across glass; macro close-ups; a bento grid of features near the end; the music builds to a drop where the product hero lands;
the end card is the product name, a short line, and where to get it. Calm confidence: little text, lots of space, no bounce.
This is the `keynote` vibe.
