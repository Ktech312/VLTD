const L = require("./lib.cjs"); const { sleep, check } = L; const O = "33333333-3333-4333-8333-333333333333";
const mk = (i, o) => ({ id: "mk_" + i, profile_id: O, title: "Market Item " + i, universe: "SPORTS", category: "Cards", category_label: "Cards", status: "FOR_SALE", is_public: true, created_at: 1790000000000 + i, current_value: null, image_front_url: "/collectibles/sports-slab.png", ...o });
(async () => { const s = await L.open({ width: 1280, height: 1600, signedIn: false });
  try { await L.seed({ vault_items: [mk(1, { asking_price: 100, current_value: 90 }), mk(2, { asking_price: 250.5 }), mk(3, { current_value: 40 }), mk(4, {})], public_profiles: [{ profile_id: O, display_name: "Other Collector" }] });
    await s.go("/market", 9000); await s.dismiss();
    const order = async () => { const t = await s.text(); const out = []; const re = new RegExp("Market Item ([0-9])", "g"); let m; while ((m = re.exec(t))) out.push(m[1]); return out.join(","); };
    console.log("default:", await order());
    for (const [label, expect] of [["Price: Low", "3,1,2,4"], ["Price: High", "2,1,3,4"]]) {
      await s.mclick("Sort listings", false); await sleep(500); const ok = await s.mclick(label, false); await sleep(800); const o = await order(); console.log(label, ok, o);
      check(label + " puts unpriced last", o === expect, o); }
  } finally { await s.close(); } console.log(JSON.stringify(L.results())); process.exit(0); })();
