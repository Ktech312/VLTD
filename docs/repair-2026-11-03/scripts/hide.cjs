// node hide.cjs <itemId> : the owner hides the item from the exhibits it sits in, with the item page's own eye control.
const L = require("./shr-lib.cjs");
(async () => {
  const id = process.argv[2];
  const O = await L.session("owner", { height: 1200 });
  try {
    await O.visit("/vault/item/" + id);
    await O.waitFor(`document.querySelector('[aria-label="Hide this item in your exhibits"]')`, 120000, "eye");
    await O.mclick(O.byLabel("Hide this item in your exhibits"), 1000);
    await O.mclick(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Hide item')`, 5000);
    console.log("state:", await O.evaluate(`!!document.querySelector('[aria-label="Show this item in your exhibits again"]')`));
    await O.shotTo("hide-item");
  } finally { await O.close(); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
