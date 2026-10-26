// Builds the capture set for v2 from the first package's captures (work-v1) and the recaptures made against the repaired app (work):
// ONLY the steps listed as affected take the new capture (screenshot, caption, marks, check result); every other step keeps its original capture unchanged.
//   node merge-work.cjs     then:  TUT_WORK=<scratch>/tut/work-merged node build-video.cjs <outRoot> ...
const fs = require("fs");
const path = require("path");
const SCR = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut";
const OLD = SCR + "/work-v1", NEW = SCR + "/work", OUT = SCR + "/work-merged";
const AFFECTED = {
  "q-desktop": ["verify-names", "verify-cost", "item-opened"],
  "q-phone": ["verify"],
  "a-desktop": ["form-overview", "crop-editor", "photo-added", "item-saved", "item-purchase-panel", "purchase-editor", "purchase-saved", "item-cost-basis", "persisted-after-reload", "zero-vs-blank"],
  "a-phone": ["form", "camera", "keep", "named"],
};
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const report = { replaced: [], kept: [], removed: [] };
for (const scene of fs.readdirSync(OLD)) {
  const mo = path.join(OLD, scene, "manifest.json"); if (!fs.existsSync(mo)) continue;
  const old = JSON.parse(fs.readFileSync(mo, "utf8")); if (!old.steps.length || /^rb79|^dbg/.test(scene)) continue;
  const mn = path.join(NEW, scene, "manifest.json"); const neu = fs.existsSync(mn) ? JSON.parse(fs.readFileSync(mn, "utf8")) : { steps: [] };
  const dir = path.join(OUT, scene); fs.mkdirSync(dir, { recursive: true });
  const steps = [];
  for (const s of old.steps) {
    if (s.id === "zz-error") continue;
    const useNew = (AFFECTED[scene] || []).includes(s.id);
    const src = useNew ? neu.steps.find((x) => x.id === s.id) : s;
    if (useNew && !src) throw new Error(`no recapture for ${scene}/${s.id}`);
    if (useNew && src.verified === false) throw new Error(`the recapture of ${scene}/${s.id} did not verify: ${src.evidence}`);
    const from = path.join(useNew ? NEW : OLD, scene, src.file);
    fs.copyFileSync(from, path.join(dir, `${s.id}.png`));
    steps.push({ ...src, file: `${s.id}.png`, n: s.n });
    (useNew ? report.replaced : report.kept).push(`${scene}/${s.id}`);
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ ...old, steps }, null, 1));
}
// steps in the first package that the repaired app no longer has
report.removed.push("q-desktop/identify-with-ai (an account without AI is shown no AI control; replaced by an explanation card)");
fs.writeFileSync(path.join(SCR, "merge-report.json"), JSON.stringify(report, null, 1));
console.log("replaced:", report.replaced.length, "| kept unchanged:", report.kept.length);
console.log(report.replaced.join("\n"));
