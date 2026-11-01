// Exact list of video scenes whose footage differs visually from the current app, by kind of difference (from the capture-to-scene map and the labelled contact sheets).
const fs = require("fs");
const SP = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/videos";
const use = JSON.parse(fs.readFileSync(SP + "/capture-usage.json", "utf8"));
const p = require("C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/master/project.json");
const all = [...p.desktop, ...p.phone, ...p.shorts.flatMap((s) => s.beats), ...p.promos.flatMap((s) => s.beats)];
const title = {}; all.forEach((b) => (title[b.id] = b.caption || b.title || ""));
const phoneCaps = Object.keys(use).filter((c) => /phone/.test(c.split("/")[0]));
const desktopCaps = Object.keys(use).filter((c) => !/phone/.test(c.split("/")[0]));
const recaptured = ["q-phone/home-bar", "q-phone2/home-chooser", "a-phone/saved"];
const takePhoto = ["a-phone/form", "ad2-phone/photo-area", "a-desktop/form-overview", "ad2-desktop/photo-area", "ad2-desktop/identity-fields", "ad2-desktop/identity-filled", "ad2-desktop/lock-unlocked", "ad2-desktop/lock-locked", "ad2-desktop/category-popculture", "ad2-desktop/category-tcg-rarity", "ad2-desktop/location", "ad2-desktop/value", "ad2-desktop/documents", "ad2-desktop/save-bar", "a-desktop/name-required"];
const kinds = [
  ["Take photo / silver button label: pale text then, dark text now", takePhoto],
  ["Phone header icons: spacing 4 px wider now (width 350 px and up) and floating bug button shown mid-page then, only at page end now", phoneCaps.filter((c) => !recaptured.includes(c))],
  ["Phone header icons: spacing 4 px wider now (the three recaptured screens predate this change)", recaptured],
  ["Control corners: 8 px then, 6 px now (pills, dropdown buttons, selects) - only footage captured before the corner fix", [...desktopCaps, ...phoneCaps.filter((c) => !recaptured.includes(c))]],
];
const scenes = (caps) => [...new Set(caps.flatMap((c) => (use[c] || []).map((x) => x.split(":")[1])))];
const byVideo = (caps) => { const g = {}; caps.forEach((c) => (use[c] || []).forEach((x) => { const [grp, id] = x.split(":"); (g[grp] = g[grp] || new Set()).add(id); })); return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, [...v]])); };
let md = "";
for (const [label, caps] of kinds) {
  const bv = byVideo(caps);
  console.log(`\n== ${label}\n   captures: ${caps.length}; distinct scenes: ${scenes(caps).length}`);
  for (const [g, ids] of Object.entries(bv)) console.log(`   ${g}: ${ids.length} scenes`);
  md += `\n### ${label}\n- captures: ${caps.length}; distinct scenes: ${scenes(caps).length}\n` + Object.entries(bv).map(([g, ids]) => `- ${g} (${ids.length}): ${ids.join(", ")}`).join("\n") + "\n";
}
const anyDiff = new Set(kinds.flatMap(([, c]) => scenes(c)));
console.log("\nscenes with at least one cosmetic difference:", anyDiff.size, "of", new Set(all.map((b) => b.id)).size, "distinct scenes");
const clean = all.filter((b) => b.capture && !anyDiff.has(b.id)).map((b) => b.id);
console.log("scenes with no difference:", clean.length, clean.join(", "));
fs.writeFileSync(SP + "/outdated-scenes.md", md);
