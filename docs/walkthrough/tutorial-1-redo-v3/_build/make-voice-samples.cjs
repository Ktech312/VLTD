// Times the Add Item sample footage to each voice (scene changes fall in the pause right after each sentence), renders it, and puts the voice over it.
//   node make-voice-samples.cjs <voicesDir> <outDir>
const fs = require("fs"), path = require("path"), cp = require("child_process");
const [VD, OUT] = process.argv.slice(2);
const SCR = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut";
const FF = require(SCR + "/ff/node_modules/ffmpeg-static");
const LEAD = 1.5, AFTER = 0.35, TAIL = 2.0; // seconds: silence before the voice, delay of a scene change after a sentence ends, hold after the last sentence
fs.mkdirSync(OUT, { recursive: true });
const voices = [["A", "ava", "voice2-A-ava-multilingual-slow"], ["B", "brian", "voice2-B-brian-multilingual-slow"], ["C", "andrew", "voice2-C-andrew-multilingual-slow"]];
const out = {};
for (const [L, name, base] of voices) {
  const f = path.join(VD, base + ".m4a");
  const log = cp.spawnSync(FF, ["-hide_banner", "-i", f, "-af", "silencedetect=noise=-38dB:d=0.5", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const dur = (() => { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(log); return +m[1] * 3600 + +m[2] * 60 + +m[3]; })();
  const gaps = []; const re = /silence_start: ([\d.]+)[\s\S]*?silence_duration: ([\d.]+)/g; let m; while ((m = re.exec(log))) gaps.push({ s: +m[1], d: +m[2] });
  const sent = gaps.filter((g) => g.d >= 0.6); // sentence gaps (shorter ones are commas)
  if (sent.length !== 5) throw new Error(base + ": expected 5 sentence gaps, found " + sent.length);
  const ends = sent.map((g) => g.s).concat([dur]); // end of each of the 6 sentences
  const bounds = ends.slice(0, 5).map((e) => LEAD + e + AFTER); // scene changes
  const total = LEAD + dur + TAIL;
  const durs = []; let prev = 0; for (const b of bounds) { durs.push(+(b - prev).toFixed(2)); prev = b; } durs.push(+(total - prev).toFixed(2));
  console.log(L, name, "voice", dur.toFixed(1), "s | scene lengths", durs.join(", "), "| total", total.toFixed(1));
  const work = path.join(OUT, "_work-" + L);
  cp.execFileSync(process.execPath, [path.join(__dirname, "build-cuts.cjs"), "addsample", work], { stdio: "inherit", env: { ...process.env, ADD_DURS: JSON.stringify(durs) } });
  const final = path.join(OUT, `add-item-voice-sample-${L}-${name}.mp4`);
  cp.execFileSync(FF, ["-y", "-loglevel", "error", "-i", path.join(work, "quick-add-addsample.raw.mp4"), "-i", f, "-filter_complex", `[1:a]adelay=${Math.round(LEAD * 1000)}|${Math.round(LEAD * 1000)},apad=whole_dur=${total.toFixed(2)}[a]`, "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-crf", "21", "-g", "24", "-keyint_min", "24", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", total.toFixed(2), "-movflags", "+faststart", final]);
  fs.copyFileSync(f, path.join(OUT, base + ".m4a"));
  if (L === "A") for (const [a, b] of [["quick-add-addsample-thumbnail.jpg", "add-item-voice-sample-thumbnail.jpg"]]) fs.copyFileSync(path.join(work, a), path.join(OUT, b));
  fs.copyFileSync(path.join(work, "quick-add-addsample.srt"), path.join(OUT, `add-item-voice-sample-${L}.srt`)); fs.copyFileSync(path.join(work, "quick-add-addsample.vtt"), path.join(OUT, `add-item-voice-sample-${L}.vtt`));
  out[L] = { name, voiceSeconds: +dur.toFixed(1), videoSeconds: +total.toFixed(1), sceneSeconds: durs };
  fs.rmSync(work, { recursive: true, force: true });
}
fs.writeFileSync(path.join(OUT, "timing.json"), JSON.stringify(out, null, 1));
