const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L; const O = "33333333-3333-4333-8333-333333333333";
const mk = (i, o) => ({ id: "mk_" + i, profile_id: O, title: "Market Item " + i, universe: "SPORTS", category: "Cards", category_label: "Cards", status: "FOR_SALE", is_public: true, created_at: 1790000000000 + i, current_value: null, image_front_url: "/collectibles/sports-slab.png", purchase_price: 1234.56, notes: "PRIVATE-NOTE-" + i, storage_location: "SECRET-SHELF", serial_number: "SERIAL-SECRET", ...o });
(async () => { const s = await L.open({ width: 1280, height: 1600, signedIn: false });
  try {
    await L.seed({ vault_items: [
      mk(1, { asking_price: 100, current_value: 90 }), mk(2, { asking_price: 250.5 }), mk(3, { asking_price: null, current_value: 40 }), mk(4, { asking_price: null, current_value: null }),
      mk(5, { status: "COLLECTION" }), mk(6, { is_public: false, asking_price: 5 })],
      public_profiles: [{ profile_id: O, display_name: "Other Collector", avatar_emoji: "key" }] });
    await s.go("/market", 9000); await s.dismiss(); let t = await s.text();
    const cards = ["Market Item 1", "Market Item 2", "Market Item 3", "Market Item 4"];
    check("four public for-sale listings shown", cards.every((c) => t.includes(c)), t.slice(0, 400));
    check("not-for-sale and private items hidden", !t.includes("Market Item 5") && !t.includes("Market Item 6"), 0);
    check("asking price shown for item 1 ($100 asking)", /\$100(\.00)?\s*asking/i.test(t.replace(/\s+/g, " ")), t.replace(/\s+/g, " ").slice(0, 600));
    check("item 3 falls back to value $40 labelled value", /\$40(\.00)?\s*value/i.test(t.replace(/\s+/g, " ")), 0);
    const total = await s.evaluate(`document.querySelector('[data-testid="market-total-asking"]')?.innerText || ""`); console.log("total:", total);
    check("total asking = $351 (350.50 shown in whole dollars; asking prices only)", total.includes("$351"), total);
    check("total says some listings have no asking price", /(2|two)/.test(total) && /no asking|without|not priced|no price/i.test(total), total);
    check("item with no price shows no fake $0", !/\$0(\.00)?\s*(asking|value)/i.test(t.replace(/\s+/g, " ")), 0);
    for (const secret of ["PRIVATE-NOTE", "SECRET-SHELF", "SERIAL-SECRET", "1,234", "1234.56"]) check("no private field on page: " + secret, !t.includes(secret), 0);
    const sel = await sim("/__sim/selects"); const cols = String(sel.vault_items || sel.public_vault_items || ""); console.log("select:", cols.slice(0, 300));
    check("request never asked for private columns", cols && !/purchase_price|notes|storage_location|serial_number|order_number/.test(cols), cols);
    // sort
    await s.evaluate(`1`); const order = () => s.evaluate(`[...document.body.innerText.matchAll(/Market Item \d/g)].map((m) => m[0]).join(",")`);
    console.log("default order:", await order());
    // search
    await s.setField("input[aria-label='Search listings']", "Item 2"); await sleep(700); t = await s.text();
    check("search narrows to Item 2", t.includes("Market Item 2") && !t.includes("Market Item 1"), 0);
    await s.setField("input[aria-label='Search listings']", "zzz-nothing"); await sleep(700); t = await s.text();
    check("search with no match says so", /No listings match/.test(t), 0);
    // old database without asking_price column
    await sim("/__sim/missing-col?names=asking_price"); await s.setField("input[aria-label='Search listings']", ""); await s.go("/market", 8000); t = await s.text();
    check("works when asking_price column is absent (falls back to value)", t.includes("Market Item 1") && /\$90(\.00)?\s*value/i.test(t.replace(/\s+/g, " ")), t.replace(/\s+/g, " ").slice(0, 400));
    await sim("/__sim/missing-col?names=");
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0); })();
