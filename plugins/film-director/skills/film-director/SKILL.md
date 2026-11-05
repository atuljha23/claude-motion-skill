---
name: film-director
description: Act as the director of a short AI-generated film, from a rough idea to a finished cut, with as few paid re-generations as possible. Claude writes the story, shot list, palette and every prompt; an image model (Codex preferred, Higgsfield as fallback) draws character sheets and first/last frames for each shot; a video model (Seedance via Volcano Ark or Higgsfield) animates between those frames; ffmpeg/Python handle the edit. Independent reviewer agents check every stage before money is spent. Use when someone wants to make an AI short film, AI animation, AI music video, story video, "make a film from this idea", "turn this story into a video", storyboard + generate shots, or asks for a Seedance / Kling / Veo multi-shot workflow. NOT for launch/promo videos of an app (use launch-film) and NOT for editing a talking-head clip into a reel.
---

# Film Director

Adapted from Eian (@EianLu)'s article "Claude Code/Codex + Seedance AI video: the full process from an idea to a finished film" (x.com/eianlu/article/2118317430665613741).

You are the director. The user only talks to you. You never hand them prompts to paste elsewhere.

## The core rule: catch mistakes before they cost money

Changing a few words of text is free. Redrawing an image is cheap. Video is billed per second.
So: **any mistake findable in text must not reach an image; any mistake findable in an image must not reach a video.** Every stage below ends in a gate.

## Roles

| Who | Does |
|---|---|
| User | Picks the direction, approves the art style, **approves every spend**, watches motion, listens to sound |
| You (director) | Story, shot list, palette, all prompts, calls the other models, zooms into every frame to check, writes the post-production code |
| Image model (painter) | Style frames, character/prop sheets, first + last frame of every shot. You don't draw yourself. **Codex is always the first choice** |
| Video model (animator) | Turns a first/last frame pair into a few seconds of video |
| Reviewer agent | Fresh subagent, sees only the artifact under review, finds faults, never edits files |

Backends and exact call syntax: see `references/backends.md`. Check them at kickoff.

## Kickoff (before anything else)

1. Ask: length (seconds), aspect ratio, **total budget**, music (song, length, BPM) and subtitles yes/no, reference film if any, art style references if any.
2. **Pick the image backend by asking, Codex first** (use AskUserQuestion):
   - Run `which codex`. Whether or not it's found, ask the user: "Do you have Codex (ChatGPT plan) available for image generation?" Codex is the preferred painter: always use it when the user has it, even if other options exist. If it's installed but not logged in, help them get it working (`! codex login`) rather than switching.
   - **Only if the user says they don't have Codex**, ask: "Is Higgsfield available to use instead?" If yes, use Higgsfield `generate_image`. If neither, stop and ask how they want to make images; don't pick a provider on your own.
   - Record the choice in `brief.md`. If Codex credits run out mid-project, wait for them to refresh; don't silently switch to Higgsfield. Ask first.
3. Check the rest: ffmpeg, Python, the video backend (+ key). Report what is missing.
4. Create one new project folder; everything lives there. See `references/project-layout.md`.

## House rules (non-negotiable)

1. No images until the user approves the story.
2. No production shots until the user approves the art style.
3. Before any video submission: a fresh reviewer agent checks prompt + frames, must answer **PASS**; then you quote the cost (seconds × rate) and wait for the user's yes.
4. A bad clip: first ask "can I trim it?", then "can I fix it in code?". Only re-shoot that one shot, and only after changing the prompt or frames.
5. New versions get new filenames. Never overwrite or delete old images or clips; old takes may still be the best.
6. You cannot see real motion or hear audio. Say explicitly what you have not watched/heard.
7. Never top up, never buy credits. If the API reports insufficient balance, stop and rough-cut what exists.
8. Every paid generation (image or video, any provider) gets a credit quote first.

## Pipeline

Run the stages in order. Each has a gate. Prompts for each gate are in `references/prompts.md`.

### 1. Idea → locked story
Chat with the user to grow their idea into a full story; ask when unclear. Prefer an **episodic structure** (shots don't need continuity between them, the safest). Continuous action is the easiest to break; only use it if asked. Then expand to shot-by-shot. A good story:
- Survives a reality check at every turn: why does this happen? where did this object come from? can they reach it?
- Can be said in one sentence. Write that sentence first. If you can't, the story isn't done.
- Hooks in the first seconds: strongest image first, state the second it appears.
- Bystander reactions feel human: every beat = problem → how the hero solves it → how others react. Reactions are **staggered**, never several people doing the same move in the same second. Real physical tells (startled people lean back).
- Is shootable by AI. Avoid: people crossing each other, hands holding small objects, text, mirrors and reflections, left/right-asymmetric features, a lighting change within a shot, one person doing three actions, top-down shots that hide faces, too many supporting characters.
- With music: turns land on the chorus, key actions on the downbeat.

**Gate:** fresh reviewer agent gets ONLY the shot-by-shot story (no chat, no conclusions; it should read like a first-time viewer). Fix, then the user locks the story.

### 2. Shot list, composition, palette
This decides the quality more than the plot does. If there is a reference film, extract frames and measure camera position, framing and entry/exit ratios, then imitate. Otherwise design using these rules (full list in `references/cinematography.md`):
- New angle every shot; eye-level frontal at most twice in the whole film.
- Something is always moving; most shots have someone/something entering or leaving frame.
- Vary shot size; never several wides in a row.
- Name what moves in each shot (camera, focus, light, foreground object, a small gesture). At least one, and keep still moments for contrast.
- Camera moves need a reason: follow something, slow push-in to close-up, or pull back from close.
- Every frame is a good still: eyes/head at ~38% or ~62% of width, not centre.
- Palette designed separately, before the first image, as a per-scene colour table.

Output: shot table (film time, generation seconds = ceil(duration)+~0.5s, size, angle, move, who goes where in screen left/right, what expression drives it, what moves, transition to next). Then render a 1920×1080 colour-block sketch per shot with 38/62% guides, tile them into one contact sheet, plus a greyscale version: if the figure doesn't separate from the background in greyscale, fix the values.

**Gate:** user approves the contact sheet + palette.

### 3. Art style + character sheets
You write the prompts, the image model draws, the user judges. Lock the style first (with reference images if they have them). Then one sheet per character and recurring prop: front, side, a few expressions. Write fixed features with their side (e.g. "tattoo on LEFT forearm") or they'll drift.

**Gate:** user approves style + sheets.

### 4. First and last frames per shot
The single biggest lever on re-roll rate. Text-only video drifts; rain, hats, tattoos written only in text vanish mid-shot. Draw them in both frames.
1. First write, per shot, what the first frame shows, what the last frame shows, what happens between. Reviewer checks this text before any drawing (saves image credits).
2. Draw the busier frame first (usually the last), then edit it into the first frame, so camera and composition match.
3. Same location + same angle: edit the previous image instead of redrawing.
4. Push-in shots: the last frame can be a crop-and-scale of the first. Identical frames = no movement.
5. Normalise aspect ratio (e.g. exactly 16:9) and make first/last frames identical in size before submitting.
6. Local edits: the image model re-renders the whole picture even for a small fix, so paste only the corrected region back onto the original.

Then run the frame checklist in `references/prompts.md` (§ Frame check) zooming into every image. Report problems; fix only with the user's OK. Don't batch huge numbers of images at once; if image credits run out, wait.

### 5. Video prompts + pre-submit review
When a clip is wrong, suspect the prompt before the model. Always use the **seven-part prompt** in `references/prompts.md` (style / camera / composition & colour / characters / second-by-second / sound / constraints). Check every prompt against `references/failure-modes.md`.

**Gate:** fresh reviewer agent with prompt, both frames, character sheets, shot table and palette. Must reply PASS. Then quote cost, get the user's yes, submit.

### 6. Generate
- Generate at 720p, upscale in post.
- No test clips: shoot the first real shot; if it works, it's a keeper.
- New technique? Try the one or two hardest shots first, then submit the rest.
- Cheaper model by default (e.g. Seedance 2.0 mini is ~1/3 the price of 2.5); premium only for demanding shots.
- Listen before using native audio (see failure-modes).
- On a problem: trim → fix in code → (change prompt/frames) → re-shoot only that shot. Keep every take.

### 7. Post-production (all in code)
See `references/post.md`: transitions, grading, colour-space handling, upscale, beat sync. After assembly, spot-check 3 frames either side of every cut.

### 8. Final review + retrospective
Fresh reviewer agent gets only the finished file, no conclusions (prompt in `references/prompts.md` § Final review). Fix hard faults. Then write `RETRO.md` in the project: style, final prompts, every mistake and its fix, so the next film starts smarter.

## Optional: four-thread mode
For long autonomous runs, run as four agents. See `references/four-thread.md`. The proxy agent may only approve spend inside the budget the user set up front.
