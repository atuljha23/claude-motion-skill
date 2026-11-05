# Shot design rules

1. **New angle every shot.** Eye-level frontal at most twice per film. Use high, low, from behind, over-the-shoulder, shooting through something.
2. **The frame is never dead.** Most shots have a person or thing entering or exiting frame. If the character stays put (sitting), move something else: a drifting sheet of paper, a passer-by behind. Locked-off camera shots need the most movement inside the frame (walk from far to near).
3. **Vary shot size.** Wide, medium, close-up alternating; never several of the same in a row.
4. **Name what moves.** Camera, focus pull, light change, something crossing the lens, a small gesture (a trembling hand). At least one per shot; if you can't name one, the shot isn't designed yet. But don't move everything: stillness gives contrast.
5. **Motivated camera.** Three workhorse moves: follow an object/person (a letter flies, camera follows); slow push-in to a close-up; start close and pull back.
6. **Every frame is a still you'd keep.** Eyes or head on ~38% or ~62% of width (golden-ratio lines), not centred.
7. **Palette is designed, not left to the model.** Decide it before the first image, as a per-scene colour table. Validate in greyscale: if figure and background merge, adjust values.

Each shot row must state: film time (bars if scored), generation seconds (ceil + ~0.5 s spare), shot size, angle, camera move, who walks where (screen left/right), which expression drives it, what moves, how it hands off to the next shot.

With a reference film: extract frames (`ffmpeg -i ref.mp4 -vf fps=4 ref/%04d.png`), measure camera height/angle, subject size in frame, entry/exit positions and cut rhythm, then imitate.
