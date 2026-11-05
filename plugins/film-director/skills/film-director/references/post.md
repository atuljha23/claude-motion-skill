# Post-production (all in code, ffmpeg + Python)

1. **Transitions:** specify per cut (which shot to which, what object wipes or carries across). Motion blur via 8–16 sub-frames, half-frame (180°) shutter.
2. **Grade by story section.** Only saturation and brightness; never shift hue. Protect accent colours, keep skin tones. No grain, glow or vignette unless the user asks.
3. **Colour space:** decode Seedance mp4s as BT.601; use lossless intermediates (e.g. FFV1 or PNG sequence); tag deliverables BT.709.
4. **Upscale:** 720p → 1080p with lanczos plus light sharpening. No whole-clip frame interpolation.
5. **Beat sync:** measure beats on the original song file only, never on an edited file. Cut on bars.
6. **Drift fixes:** per-clip grade-back to its first frame (2.0 mini), hold a clean frame over a final jump (2.5), drop an over-sharp first frame, crop-zoom for extra push-in, mask/freeze mouths that move.
7. **Audio:** use native SFX only after listening (2.0 mini's are often usable); otherwise lay SFX/music in post. Say plainly that you can't hear it; the user must listen.

After assembly: extract 3 frames either side of every cut and inspect them.
Deliver: `out/<name>_1080p.mp4` (BT.709), plus a 9:16 or other cut if asked.
