const L = require("./lib.cjs"); const { check } = L;
(async () => { const s = await L.open({ width: 1280, height: 1400 });
  try { await L.seed({ lounge_posts: [{ id: "00000000-0000-4000-8000-000000009001", profile_id: "33333333-3333-4333-8333-333333333333", kind: "post", body: "Only other collector post.", title: "Other only", category: "General", score: 0, comment_count: 0, hidden_at: null, created_at: new Date().toISOString() }] });
    await s.go("/community-board", 9000); await s.dismiss();
    check("page shows the other collector's post", /Only other collector post/.test(await s.text()), 0);
    check("no Remove button on another collector's post", (await s.evaluate(`[...document.querySelectorAll("button")].filter((b) => /^Remove$/.test(b.innerText.trim())).length`)) === 0, 0);
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0); })();
