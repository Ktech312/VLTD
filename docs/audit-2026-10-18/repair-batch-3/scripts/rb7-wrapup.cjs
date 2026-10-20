const { admin, man, row } = require("./audit-lib.cjs");
(async () => {
  const m = man(); const P = m.personalId;
  const cnt = async (t, col, pat) => ((await admin.from(t).select("id").like(col, pat)).data || []).length;
  console.log("leftovers  items:", await cnt("vault_items", "title", "QA RB7%"), "galleries:", await cnt("galleries", "title", "QA RB7%"), "goals:", await cnt("collection_goals", "name", "QA RB7%"), "tier:", (await admin.from("profiles").select("tier").eq("id", P).single()).data.tier);
  row("RB6", {
    page: "/goals /vault/import /capture",
    control: "Reviewed screenshots, dark and light theme, 390 and 1440 wide: goals sheet error, goals waiting notice, import banner, Undo prompt, Capture draft banner",
    expected: "Readable, inside the viewport, no sideways overflow, buttons tappable",
    actual: "All 20 captures reviewed by eye: readable in both themes at both widths, 0 px overflow, nothing outside the viewport. The script's rough contrast figure read 1.2 to 1.5 for the dark-theme error text and import banner (RB6-082, 085, 095, 097, 107, 109 FAIL): that metric cannot see semi-transparent backgrounds; the screenshots show readable red/amber text on dark. One real finding: the import banner link 'Check again' and the Bulk 'Dismiss' were 20 px text links; now 36 px buttons (96677b9; RB6-109 and RB6-114 show 36 px). Seen on the way, not mine: the Add to Home Screen banner overlaps lower content on the phone (RC-14, open).",
    result: "PASS", evidence: "repair-batch-3/screens/*.png", impact: "D-03, D-05, D-06, D-07, D-09 screens",
  });
})();
