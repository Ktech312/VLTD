// Where did the builder page name/description go? Looks for the typed text in the gallery's row and sibling tables.
const SD = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/audit-2026-10-18/scripts";
const J = require(SD + "/journey-lib.cjs");
const { admin } = J;
const [gid, needle] = [process.argv[2], process.argv[3]];
(async () => {
  const g = await admin.from("galleries").select("*").eq("id", gid).maybeSingle();
  const row = g.data || {};
  console.log("galleries columns with the text:", Object.keys(row).filter((k) => JSON.stringify(row[k] ?? "").includes(needle)));
  for (const t of ["gallery_sections", "gallery_items", "gallery_pages", "gallery_rooms", "gallery_exhibits", "gallery_layouts"]) {
    const r = await admin.from(t).select("*").eq("gallery_id", gid);
    console.log(t, r.error ? "ERR " + r.error.message.slice(0, 80) : `${(r.data || []).length} rows; match: ${JSON.stringify(r.data || []).includes(needle)}`);
  }
  console.log("columns:", Object.keys(row).join(", "));
  const sec = row.sections ?? row.settings ?? row.theme_settings;
  if (sec) console.log("sections-ish value:", JSON.stringify(sec).slice(0, 400));
})();
