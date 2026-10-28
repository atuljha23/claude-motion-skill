// Mixes the music with the sound effects and the voice stem (the music ducks under the voices), normalises loudness
// (two-pass loudnorm, default -14 LUFS / -1 dBTP, right for Reels, TikTok, Shorts, YouTube and X) and muxes with a video.
// Usage: node tools/mix.mjs [--variant v] --video out/main/video-30.mp4 [--out out/main/draft.mp4]
//        [--music-db 0] [--sfx-db 0] [--voice-db 3] [--lufs -14] [--duck 4]
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const opt = (name, def) => (args.includes("--" + name) ? args[args.indexOf("--" + name) + 1] : def);
const VARIANT = opt("variant", "");
const OUT = path.join(ROOT, "out", VARIANT || "main");
const SFX = path.join(OUT, "sfx.wav");
const VOICE = path.join(OUT, "voice.wav");
const MIX = path.join(OUT, "mix.wav");
const { film } = JSON.parse(await readFile(path.join(OUT, "cues.json"), "utf8"));
const MUSIC = path.resolve(ROOT, film.music);
const LUFS = opt("lufs", -14);

const fadeAt = film.endHit + 0.04;
const graph = (tail) =>
  `[0:a]atrim=start=${film.songStart.toFixed(4)}:duration=${film.duration.toFixed(4)},asetpts=PTS-STARTPTS,aresample=48000,` +
  `volume=${opt("music-db", 0)}dB,afade=t=in:d=0.12,afade=t=out:st=${fadeAt.toFixed(3)}:d=${(film.duration - fadeAt).toFixed(3)}:curve=exp[m];` +
  `[2:a]volume=${opt("voice-db", 3)}dB,asplit=2[v][vk];[m][vk]sidechaincompress=threshold=0.03:ratio=${opt("duck", 4)}:attack=12:release=380:makeup=1[md];` +
  `[1:a]volume=${opt("sfx-db", 0)}dB[s];[md][s][v]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.84:attack=3:release=60:level=false,${tail}[out]`;
const run = (argv) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-y", ...argv], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.slice(-2000));
  return r.stderr;
};
const lastJson = (s) => JSON.parse(s.slice(s.lastIndexOf("{"), s.lastIndexOf("}") + 1));

const m = lastJson(run(["-i", MUSIC, "-i", SFX, "-i", VOICE, "-filter_complex", graph(`loudnorm=I=${LUFS}:TP=-1:LRA=11:print_format=json`), "-map", "[out]", "-f", "null", "-"]));
const ln =
  `loudnorm=I=${LUFS}:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
  `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json,aresample=48000`;
const r = lastJson(run(["-i", MUSIC, "-i", SFX, "-i", VOICE, "-filter_complex", graph(ln), "-map", "[out]", "-c:a", "pcm_s24le", MIX]));
console.log(`mix: input ${m.input_i} LUFS / ${m.input_tp} dBTP -> ${r.output_i} LUFS / ${r.output_tp} dBTP (${r.normalization_type}) -> ${MIX}`);

const video = opt("video");
if (video) {
  const out = path.resolve(ROOT, opt("out", path.join(OUT, `${film.slug || "film"}${VARIANT ? "-" + VARIANT : ""}.mp4`)));
  run(["-i", path.resolve(ROOT, video), "-i", MIX, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out]);
  console.log(out);
}
