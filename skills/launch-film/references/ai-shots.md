# Optional: AI-generated cinematic shots inside a launch film

Most launch films are pure code. Sometimes a film wants a few filmed-looking shots (a person using the phone on a train, a product on a desk at dusk). Generate those as short clips and drop them into the HTML as image sequences or `<video>` (see method.md, image sequences). Video is billed per second, so everything below exists to get each clip right first time.

## Backends: ask, Codex first
- **Image (first/last frames): Codex is always the first choice.** Ask the user whether they have Codex available (run `which codex` too). Only if they say no, ask whether Higgsfield is available, and use its `generate_image`. If neither, ask; never pick a provider on your own. If Codex quota runs out, wait for it rather than silently switching.
  - Codex call: `codex exec --skip-git-repo-check -s read-only -i ref.png - < prompt.txt`, prompt starting with `Use your image generation tool to create exactly ONE image. Do not run shell commands.` Output in `~/.codex/generated_images/<session id>/`.
- **Video:** Seedance via Higgsfield `generate_video` or the Volcano Ark API (`ARK_API_KEY`, never printed). Cheaper model by default (Seedance 2.0 mini ≈ 1/3 the price of 2.5). Generate at 720p and upscale in post (lanczos + light sharpen) unless the shot is full-frame hero.
- **Quote the cost of every paid generation and wait for the user's yes.** Never top up or buy credits.

## Process per shot
1. **Write first frame / last frame / what happens between** in text. Avoid what AI video gets wrong: people crossing, hands holding small objects, legible text or UI on screens (composite the real UI in code instead), mirrors and reflections, left/right-asymmetric features, a lighting change within the shot, one person doing three actions, top-down shots hiding faces, crowds.
2. **Draw the busier frame first** (usually the last), then edit it into the first frame so camera and composition match. Push-in: the last frame can be a crop+scale of the first. Same size, exact aspect ratio for both.
3. **Frame check** (zoom into each): everything the action uses is already visible in the first frame; no identical poses in a group; room left for the action and headroom; consistent wind/light direction; legible at phone size; no stray objects; overlay first and last frames, anything that shouldn't change must be identical (a cup 5% bigger becomes a growing cup).
4. **Seven-part prompt:**
```
[STYLE] <one line>. Style, colours and design match the first and last frames exactly.
[CAMERA] <X> s total, <shot size>, <angle>, <move, or "no push, no pull, no pan, no cut">.
[COMPOSITION & COLOUR] <where things are; colours; must match the first frame>
[CHARACTERS] <look, clothes, fixed props, stated exactly>
[SECOND BY SECOND] 0–0.2 s: completely still, identical to the first frame. <segments: who does what, where hands are, which way in screen terms>. Final 0.3 s: everything stops; matches the last frame exactly.
[SOUND] Only <sounds with a visible cause>. No one speaks.
[CONSTRAINTS] Only the people and objects of the first frame are ever in shot; faces and bodies unchanged; one continuous shot; no text, subtitles or watermarks.
```
5. **Pre-submit review** by a fresh subagent (prompt, both frames, palette): does every sentence match the images (positions, left/right, counts, colours)? Are the frames identical where they should be? Plausible actions with stated causes? Likely failure points? Must answer PASS. Then quote, then submit.
6. **If a clip is wrong:** trim it → fix it in code → only then re-shoot, after changing the prompt or frames. Keep every take.

## Known failure modes
| Model tends to | Write / do |
|---|---|
| Move a group in unison | Order it ("A first, a second later B"); don't pose them alike |
| Do with hands what wind/physics should do | State the cause + "hands never touch X" |
| Give clouds/objects faces | Describe texture only, never "cartoon cloud" |
| Walk the wrong way | Screen directions: "toward frame left" |
| Misread an ambiguous phrase | Name the exact place; add "the driver's seat stays empty" |
| Change counts | State them: "only one yellow envelope" |
| Ignore negatives | Rephrase positively |
| Make props pop in or teleport | Only first-frame props; describe paths |
| Drop hats/rain/tattoos | Draw them in both frames |
| Miss timing / under-push | Leave slack; retime and push in post |
| Move mouths | "No one speaks"; fix in code |
| Add music anyway (2.5) | Discard clip audio; the film has its own mix anyway |
| Jump to the last frame at the end (2.5) | Hold a clean frame |
| Over-sharp first frame (2.5) | Drop it |
| Drift darker/cooler (2.0 mini) | Grade each clip back to its first frame |

Colour: decode Seedance mp4 as BT.601, lossless intermediates, deliver BT.709. Grade with saturation/brightness only, never hue; protect the accent and skin.
