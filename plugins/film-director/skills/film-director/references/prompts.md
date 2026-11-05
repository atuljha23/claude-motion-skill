# Prompts

All reviewer prompts go to a **fresh subagent** that receives only the listed materials, never the chat history or your conclusions. A reviewer that knows what you meant fills the gaps in its head; a first-time viewer exposes what isn't actually on the page. Reviewers find faults only and never edit files. Save every verdict to `reviews/`.

---

## Story development (you, with the user)
Inputs: the idea (one line or rough plot), length, song (title/length/BPM) if any, reference film if any.
Develop it into a full story together, asking when unclear, and wait for the user's lock before going shot-by-shot. Default to episodic structure. Then write shot-by-shot meeting the five story rules in SKILL.md §1, starting with the one-sentence message and stating at which second the hook appears.

## § Story review (fresh agent)
> This is the shot-by-shot story of a short film. You are seeing it for the first time. Find problems only; do not edit any file.
> 1. Reading only in shot order, write the story as you understood it.
> 2. At each turn ask: why does this happen? Where did the object come from? Can they reach it? Would this really happen?
> 3. Can the message be said in one sentence? What is it?
> 4. Does the opening grab? Is the most striking image up front?
> 5. Do bystander reactions feel human? Are they staggered?
> 6. Which shots will an AI video model likely get wrong? (people crossing, hands holding small objects, text, mirrors/reflections, left-right asymmetric features, lighting change within a shot, one person doing three actions, top-down shots hiding faces, too many extras)
> For each issue: shot, problem, suggested fix. Mark uncertain ones "possibly". End with PASS or FAIL.

## § Frames plan review (fresh agent, before drawing)
> Per shot: what the first frame shows, what the last frame shows, what happens between. Check against the shot table and the frame checklist below. Shot, problem, fix. PASS or FAIL.

## § Frame check (after drawing; zoom into every image)
Materials: first frame, last frame, character sheet, the shot's row.
1. Everything the action uses is visible in the first frame (if a cup gets picked up, the cup is there), or it will pop into existence.
2. Other people's reactions are pre-staged: a clip is one shot, you can't cut to them, so place them in frame, e.g. one person acting in front, another behind facing camera.
3. In groups, no two people share a pose, or the model moves them in unison.
4. Space is left for the action: where things land or fly is clear; headroom above people.
5. Wind direction is consistent (scarf and sheets blow the same way).
6. View at phone size: distant people still legible?
7. Zoom for stray artefacts: an extra kettle, a weird thin line.
8. Overlay first and last frame: anything that should not change must be identical. A wall colour difference becomes a wall slowly changing colour; a cup 5% bigger becomes a growing cup.
Report image + location + problem; fix only after the user agrees.

## § Seven-part video prompt
```
[STYLE] <one line, e.g. clean modern 2D hand-drawn animation, flat colour fills, crisp lines, no grain or texture>. The style, colours and character design throughout match the first and last frames exactly.
[CAMERA] <X> seconds total, <shot size>, <angle>, <move; if static: "no push, no pull, no pan, no cut">.
[COMPOSITION & COLOUR] <where people and things are in frame, wall and light colours; must match the first frame>
[CHARACTERS] <each person's look, clothes, fixed props, stated exactly>
[SECOND BY SECOND]
0–0.2 s: completely still, identical to the first frame.
<each segment: who does what, how the expression changes, where hands are and what they must not touch, toward which side of the frame>
Final 0.3 s: everyone fully stops; the frame matches the last frame exactly.
[SOUND] Only <sounds with a visible cause>. No one speaks.
[CONSTRAINTS] Only the people and objects of the first frame are ever in shot; faces and bodies stay the same throughout; one continuous shot. Clean image, no text, subtitles or watermarks.
```

## § Pre-submit review (fresh agent; real money is about to be spent)
Materials: prompt file, first frame, last frame, character sheets, shot table, palette rules.
> You are the reviewer: read-only. This shot is about to be submitted for paid video generation. Check item by item, zooming into images:
> 1. Does every sentence of the prompt match both images? (positions, left/right, colours, head count, prop counts, clothes, expressions)
> 2. Are camera position, scale and background identical across the two frames?
> 3. Consistent with character sheets, palette rules and the neighbouring shots?
> 4. Are the actions physically plausible? Is a cause stated for each? Where are the hands?
> 5. Where could the model go wrong? (simultaneous actions, things appearing from nowhere, faces growing on objects, walking the wrong way, ambiguous wording)
> Reply only PASS or FAIL. On FAIL, list each required change.

Real catches this has made: cup size differing 13% between frames, a hat brim present in one frame only, left and right swapped.

## § Final review (fresh agent; only the finished file)
> This is the finished film: <file>. You are watching for the first time; I'm giving you no conclusions.
> 1. Decode everything; take several full-resolution frames per shot, and 3 frames either side of each cut.
> 2. Write the story you understood, then list what you didn't understand.
> 3. Per shot check: repeated actions, prop counts, continuity errors, jumps, colour shifts, face distortion, text problems.
> 4. State clearly what you cannot check (feel of motion, sound).
> Each item: timestamp, frame number, problem, classed as HARD FAULT or MINOR.
