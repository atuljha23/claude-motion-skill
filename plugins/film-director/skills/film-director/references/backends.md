# Backends

Pick one image backend and one video backend at kickoff. Check each works before stage 3. Model names and prices drift; verify against the provider (and the actual bill) before quoting.

## Image (painter): Codex first, always

Order of preference, decided by asking the user at kickoff (see SKILL.md):
1. **Codex** (always preferred when the user has it)
2. **Higgsfield**, only after the user says they don't have Codex and confirms Higgsfield is available
3. Neither: ask the user; never choose a provider yourself

### 1. Codex CLI (preferred)
Install if missing: `npm i -g @openai/codex`, then the user runs `! codex login`.
```
codex exec --skip-git-repo-check -s read-only -i reference.png - < prompt.txt
```
Start every prompt with: `Use your image generation tool to create exactly ONE image. Do not run shell commands.`
Output lands in `~/.codex/generated_images/<session id from the log>/`. Copy it into the project with a versioned name.

Local edits: Codex re-renders the whole image even for a small fix, so paste only the corrected region back onto the original (PIL).
Don't fire many images at once; Codex image quota is tight. When it runs out, wait for it to refresh.

If you are Codex yourself, use your own image tool.

### 2. Higgsfield MCP (fallback only)
- `generate_image` for style frames, sheets, first/last frames. Pass the previous frame / character sheet as a reference image for edits and consistency.
- If unsure which model suits a style, `models_explore(action:'recommend')` first.
- Quote the credit cost before generating (`balance` / quote fields).

## Video (animator)

### Option A: Higgsfield MCP
`generate_video` with first frame + last frame. Check available Seedance (or Kling/Veo) models with `models_explore`. Quote credits first, wait with `jobs_wait`.

### Option B: Volcano Engine Ark API (Seedance direct, as in the article)
- `POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks`, then poll the task.
- Key in env var `ARK_API_KEY`. Never print it.
- Look up the request body format in the Ark docs (first_frame / last_frame image content, duration, resolution).
- Models at time of writing: `doubao-seedance-2-5-260628` (720p ~¥1.5/s), `doubao-seedance-2-0-mini-260615` (720p ~¥0.5/s).
- Write a small Python script `tools/seedance.py` in the project that submits, polls, downloads to `clips/shotNN_vK.mp4`, and logs cost to `spend.log`.

## Always
- ffmpeg + Python for every post step.
- Cost quote = seconds × rate per clip, plus the running total vs. budget.
- Insufficient balance → stop, rough-cut what exists. Never top up.
