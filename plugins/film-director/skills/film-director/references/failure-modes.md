# Video-model failure modes and what works

Check every seven-part prompt against this table.

| The model tends to... | Write it like this |
|---|---|
| Make a group do the same action at once | Order it: "Dad first... a second or two later Grandma... the little girl last". Also don't pose them identically in the first frame |
| Have a person do what the wind should (postman flips open his bag by hand) | State the cause, and add "his hands never touch the bag at any point" |
| Give clouds, moons, plants eyes and mouths | Never say "cartoon cloud". Say "fluffy grey-white cumulus, only cotton-like texture and shading"; describe only how it moves |
| Walk people the wrong way | Use screen directions: "walks toward the left of frame, past the shop door on the left" |
| Read an ambiguous phrase the wrong way ("old man behind the window" → a person appears in the car) | Be specific: "in the window of the stone house, top left", plus "the driver's seat stays empty throughout" |
| Change object counts | State counts: "only one yellow envelope; afterwards his arms hold only white envelopes" |
| Ignore negatives ("the spout doesn't pour" → it pours) | Rephrase positively: "only the people of the first frame are ever in shot" |
| Infer a prop's use (kettles always pour) | Keep that prop out of shots with action |
| Make things appear from nowhere | Use only what's in the first frame |
| Make objects fly off or teleport | Describe the path: "slides back off the back of his head, he catches it, puts it back on" |
| Lose rain, hats, tattoos mid-shot | Draw them in both first and last frames |
| Render lightning too realistically | "a white flash inside the cloud", then trim the start |
| Get messy with many actions | One or two main actions per shot |
| Miss the stated timing | Timings are approximate; leave slack, fix with cuts and speed ramps in post |
| Push in less than written | Add more push in post with code |
| Move mouths on their own | Write "no one speaks"; if it still happens, fix in code |
| Add music despite "no music" (Seedance 2.5) | Discard the clip's audio, add sound in post |
| Jump to the last frame in the final few frames (Seedance 2.5) | Pick a clean frame and hold it to the end |
| Make the very first frame over-sharp (Seedance 2.5) | Drop that frame |
| Drift darker and cooler over the clip (Seedance 2.0 mini) | Grade each clip back to its own first frame |
| Mishandle intricate scenes on the cheap model | Use the premium model only where truly needed |

Before re-shooting: can it be trimmed? Can code fix it? If re-shooting, change the prompt or frames first; an unchanged resubmit will likely fail the same way.
