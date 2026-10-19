// GIN suite 2: sorting, type inference, value impact, completed-this-year, and the corrected re-checks of GIN-007 / GIN-010. Owner, Personal.
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl } = L;
const PG = "/goals | owner, Personal, 26 items + 5 sold";
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp; const day = 86400e3, now = Date.now();
  const ts = (d) => new Date(now - d * day).toISOString();
  const id = (n) => `qa_goal_${st}_g2_${n}`;
  // extra QA items (removed at the end of this suite)
  const XI = ["x1", "x2", "x3", "x4"].map((k) => `qa_gin_${st}_${k}`);
  const base = { profile_id: P, is_public: false, created_at: now };
  const extra = [
    { id: XI[0], title: "QA Art Sold", universe: "ART", category: "ART", category_label: "Art", status: "SOLD", purchase_price: 100, current_value: 500, sold_price: 900, sold_at: now - day, ...base },
    { id: XI[1], title: "QA Art Wish", universe: "ART", category: "ART", category_label: "Art", status: "WISHLIST", current_value: 250, ...base },
    { id: XI[2], title: "QA Auto Zero", universe: "AUTOMOTIVE", category: "AUTOMOTIVE", category_label: "Automotive", status: "COLLECTION", purchase_price: 90, current_value: 0, ...base },
    { id: XI[3], title: "QA Game Pikachu", universe: "GAMES", category: "GAMES", category_label: "Games", status: "COLLECTION", purchase_price: 10, subject: "Pikachu", ...base },
  ];
  const xi = await admin.from("vault_items").insert(extra); if (xi.error) throw new Error("extra items: " + xi.error.message);
  const dbRows = await L.rows(P);
  const S = await L.session("owner");
  try {
    // ---------- A. sorting
    await L.seedGoals([
      { id: id("a"), name: "Complete alpha", target_count: 4, universe: "TCG", created_at: ts(10) },
      { id: id("b"), name: "Complete beta", target_count: 10, universe: "SPORTS", created_at: ts(5) },
      { id: id("c"), name: "Complete gamma", target_count: 100, universe: "MUSIC", created_at: ts(1) },
      { id: id("d"), name: "Complete delta", target_count: 3, universe: "ART", created_at: ts(20) },
    ]);
    await L.gotoGoals(S);
    const exp = {}; for (const g of ["alpha", "beta", "gamma", "delta"]) exp[g] = null;
    const order = async () => (await L.names(S)).map((n) => n.replace("Complete ", ""));
    const initial = await order();
    const prog = await L.goalRows(S); console.log(JSON.stringify(prog.map((p) => [p.name, p.pct, p.owned, p.target])));
    R.check(initial.join() === "gamma,beta,delta,alpha", { page: PG + " | 4 goals: alpha 100% oldest, beta 50%, gamma 9% newest, delta 0%", control: "Sort by: Priority (default)", expected: "Priority = the goals that need the most work first: gamma (91 missing), beta (5), delta (3), alpha (0)", actual: initial.join(", "), evidence: await L.SHOT(S, "goals-sort-priority"), impact: "misleading result", repro: "1. Open Goals with several goals. 2. Default order." });
    await L.pickSort(S, "Progress");
    const byProg = await order();
    R.check(byProg.join() === "alpha,beta,gamma,delta", { page: PG, control: "Sort by: Progress", expected: "Highest progress first: alpha 100%, beta 50%, gamma 9%, delta 0%", actual: byProg.join(", "), evidence: await L.SHOT(S, "goals-sort-progress"), impact: "misleading result", repro: "Choose Sort by Progress." });
    await L.pickSort(S, "Recent");
    const byRecent = await order();
    R.check(byRecent.join() === "gamma,beta,alpha,delta", { page: PG, control: "Sort by: Recent", expected: "Most recently created first by created date: gamma (1 day), beta (5), alpha (10), delta (20)", actual: byRecent.join(", ") + " (this is the Progress order reversed, lowest progress first, not newest first)", evidence: await L.SHOT(S, "goals-sort-recent"), impact: "misleading result", repro: "1. Create goals on different days with different progress. 2. Choose Sort by Recent." });
    await L.pickSort(S, "Priority");
    R.check((await order()).join() === initial.join(), { page: PG, control: "Sort by: back to Priority", expected: "Selecting Priority again restores the first order", actual: (await order()).join(", "), evidence: "", impact: "usability", repro: "Switch sorts and back." });
    // selected goal after sort
    const sel = (await L.asideText(S)).slice(0, 40);
    console.log("aside after sort:", sel);

    // ---------- B. goal value impact / insurable value on controlled data
    await L.seedGoals([
      { id: id("v1"), name: "Complete trading card set", target_count: 10, universe: "TCG", created_at: ts(3) },
      { id: id("v2"), name: "Complete trading card set 2", target_count: 20, universe: "TCG", created_at: ts(2) },
      { id: id("v3"), name: "Complete art shelf", target_count: 5, universe: "ART", created_at: ts(1) },
      { id: id("v4"), name: "Complete the cars", target_count: 2, universe: "AUTOMOTIVE", created_at: ts(0.5) },
    ]);
    await L.gotoGoals(S);
    const tx = await L.mainText(S);
    const imp = tx.match(/GOAL VALUE IMPACT \$([\d,]+) (.*?) INSURANCE/i);
    const tcg = dbRows.filter((r) => r.universe === "TCG" && r.status !== "WISHLIST" || (r.universe === "TCG"));
    const tcgSum = tcg.reduce((s, r) => s + (r.current_value !== null && r.current_value !== undefined ? Number(r.current_value) : Number(r.purchase_price ?? 0)), 0);
    const impact = Number(imp[1].replace(/,/g, ""));
    const wholeValueOwned = 0;
    console.log("impact panel", impact, "tcgSum", tcgSum, "text:", imp[2]);
    // expected under the label "Potential increase across all goals" would be an INCREASE (new value from reaching the goals); the page adds up the existing value of already-owned matching items (up to 5 per goal), counted again for every goal that matches
    R.check(impact !== tcgSum * 2 + 750 && impact !== tcgSum + 750, { page: PG + " | 4 goals: TCG x2, ART (0 owned; 1 sold + 1 wishlist item of $500/$250), AUTOMOTIVE", control: "Goal Value Impact panel ('Potential increase across all goals')", expected: "A potential increase: what reaching the goals would add (nothing for owned items, nothing from sold or wishlist items)", actual: `Shows $${impact}. The TCG items already owned are worth $${tcgSum} (value, else purchase price) and are counted once for each of the two TCG goals ($${tcgSum * 2}); the ART goal adds $750 from a SOLD item ($500) and a WISHLIST item ($250) that are not owned. Panel = existing value of up to 5 matching items per goal, sold and wishlist included.`, evidence: await L.SHOT(S, "goals-value-impact"), impact: "misleading result", repro: "1. Two goals in the same category, plus a goal whose only matching items are sold/wishlist. 2. The panel adds them all up and calls it a potential increase." });
    const rowsB = await L.goalRows(S);
    const art = rowsB.find((r) => r.name === "Complete art shelf");
    await clickEl(S, `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).find((b) => /art shelf/.test(b.textContent))`, { js: true }); await sleep(500);
    const asideArt = await L.asideText(S);
    const ins = Number((asideArt.match(/INSURABLE VALUE \$([\d,]+)/i) || [])[1]?.replace(/,/g, ""));
    R.check(ins === 0, { page: PG, control: "Side panel 'Insurable Value' (goal with 0 owned items; 1 sold and 1 wishlist item of the category)", expected: "Insurable value of items you own = $0 (the sold and wishlist items are not insurable)", actual: `"${asideArt.match(/INSURABLE VALUE.{0,60}/i)?.[0]}", progress ${art.owned} owned, ${art.pct}%`, evidence: await L.SHOT(S, "goals-insurable-value"), impact: "misleading result", repro: "1. Goal in Art with no owned art. 2. Open its side panel: Insurable Value includes the sold and wishlist art." });
    await clickEl(S, `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).find((b) => /the cars/.test(b.textContent))`, { js: true }); await sleep(500);
    const asideCar = await L.asideText(S);
    R.check(/INSURABLE VALUE \$0\b/i.test(asideCar), { page: PG, control: "Side panel 'Insurable Value' (explicit $0 current value, purchase $90)", expected: "An explicit $0 value stays $0 (not replaced by the $90 purchase price)", actual: asideCar.match(/INSURABLE VALUE.{0,60}/i)?.[0], evidence: "", impact: "misleading result", repro: "Goal in Automotive with one item valued $0." });

    // ---------- C. type inference
    const inf = [
      ["Antique Broom Collection", null, "Complete a set of antique brooms", "gallery", "completion"],
      ["Complete the Resell Rookie set", null, null, "sell", "completion"],
      ["Collect all $5 bin comics", null, null, "value", "completion"],
      ["Complete the Valentine cards", null, null, "value", "completion"],
      ["Finish the Pokemon set", "not for insurance purposes", null, "insurance", "completion"],
      ["Decorate the bedroom wall with posters", null, null, "gallery", "completion"],
      ["Complete the Disney Princess set", null, null, "completion", "completion"],
    ];
    await L.seedGoals(inf.map((x, i) => ({ id: id("i" + i), name: x[0], notes: x[1], target_count: 10, universe: "MUSIC", created_at: ts(i) })));
    await L.gotoGoals(S);
    const found = {};
    for (const f of ["Completion", "Value", "Sell", "Exhibition"]) {
      await clickEl(S, L.FILTER(f), { js: true }); await sleep(600);
      found[f] = await L.names(S);
    }
    await clickEl(S, L.FILTER("All Goals"), { js: true }); await sleep(600);
    const all = await L.names(S);
    const typeOf = (n) => { for (const f of ["Completion", "Value", "Sell", "Exhibition"]) if (found[f].includes(n)) return f; return all.includes(n) ? "(Insurance: only under All Goals)" : "?"; };
    const shotI = await L.SHOT(S, "goals-inference-all");
    for (const x of inf) {
      const t = typeOf(x[0]);
      const want = "Completion";
      R.check(t === want, { page: PG + " | goal types inferred from name/notes text", control: `Goal type filter for the goal "${x[0]}"${x[1] ? ` (notes: "${x[1]}")` : ""}`, expected: `A set-completion goal listed under Completion (it says nothing about selling, value, rooms or insurance)`, actual: `Listed under ${t}${t === "Exhibition" ? " and labelled Public" : ""}: the type is guessed from words in the name/notes (sell/duplicate, gallery/room, value/$, insurance); there is no type field in the Create Goal sheet`, evidence: shotI, impact: "misleading result", repro: `1. Create goal "${x[0]}". 2. Click each type filter.` });
    }
    // value goal with "$" -> row shows dollars
    const dollarRow = (await L.goalRows(S)).find((g) => g.name === "Collect all $5 bin comics");
    console.log("dollar row", dollarRow && dollarRow.t.slice(0, 120));

    // ---------- D. completed this year
    await L.seedGoals([
      { id: id("o1"), name: "Complete the old TCG shelf", target_count: 1, universe: "TCG", created_at: "2024-01-05T10:00:00.000Z" },
      { id: id("o2"), name: "Complete the new SPORTS shelf", target_count: 1, universe: "SPORTS", created_at: ts(1) },
      { id: id("o3"), name: "Complete the music shelf", target_count: 100, universe: "MUSIC", created_at: ts(2) },
    ]);
    await L.gotoGoals(S);
    const cy = (await L.mainText(S)).match(/COMPLETED THIS YEAR (\d+)/i);
    R.check(cy && Number(cy[1]) === 1, { page: PG + " | one goal created in January 2024 and already complete, one created yesterday and complete, one incomplete", control: "Completed This Year panel", expected: "Counts goals completed in the current year (2026): at most the goal that was reached this year; a goal created in 2024 that has been complete since then is not 'this year'", actual: `Shows ${cy ? cy[1] : "?"}: it counts every goal at 100% regardless of year (goals store only a creation date, no completion date).`, evidence: await L.SHOT(S, "goals-completed-this-year"), impact: "misleading result", repro: "Goal created in an earlier year that is complete: the panel counts it." });
    const praise = (await L.mainText(S)).match(/COMPLETED THIS YEAR \d+ (.*?) ACTIVE/i)?.[1];
    console.log("praise text:", praise);
    // ---------- E. corrected re-check of GIN-007 (visibility label) and GIN-010 (row click)
    await L.seedGoals([
      { id: id("e1"), name: "Plan a Vault room for trading cards", target_count: 10, universe: "TCG", created_at: ts(1) },
      { id: id("e2"), name: "Complete the sports binder", target_count: 10, universe: "SPORTS", created_at: ts(2) },
    ]);
    await L.gotoGoals(S);
    const rE = await L.goalRows(S); const room = rE.find((g) => /room/.test(g.name));
    const galsPub = (await admin.from("galleries").select("id,visibility,title").eq("profile_id", P)).data;
    const roomsForTcg = galsPub.filter((g) => /trad|card|tcg/i.test(g.title));
    R.check(room.vis !== "Public", { page: PG + " | Exhibition goal with no exhibition connected to it", control: "Exhibition goal row: 'Public' label + progress (corrects GIN-007)", expected: "'Public' only if the goal's exhibition is public; progress for an exhibition goal reflects exhibitions/rooms, and the label does not claim visibility the goal does not have", actual: `Row shows '${room.vis}' and '${room.owned} of ${room.target} items' (TCG item count). Goals have no link to any exhibition (${galsPub.length} exhibitions, ${galsPub.filter((g) => g.visibility === "PUBLIC").length} public) - 'Public' is fixed text for every goal whose name contains 'room' or 'gallery'.`, evidence: await L.SHOT(S, "goals-exhibition-public-label"), impact: "misleading result", repro: "1. Create a goal 'Plan a Vault room for trading cards'. 2. Row says Public." });
    const before = (await L.asideText(S)).slice(0, 50);
    const pick = rE.find((g) => /sports binder/.test(g.name)).name;
    await clickEl(S, `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).find((b) => b.querySelector('h2').textContent.trim() === ${JSON.stringify(pick)})`, { js: true }); await sleep(500);
    const after = (await L.asideText(S)).slice(0, 50);
    R.check(after.startsWith(pick) && before !== after, { page: PG, control: "Goal row (card) click (corrects GIN-010: the earlier check picked the wrong row index)", expected: "Clicking a goal row selects it and shows its details in the side panel", actual: `Before "${before}" After "${after}"`, evidence: await L.SHOT(S, "goals-row-selected2"), impact: "usability", repro: "Click a goal row that is not first." });
    // keyboard: Tab to a row and Enter
    await clickEl(S, `document.querySelector('[aria-label="Sort goals"]')`, { js: true }); await L.pressKey(S, "Escape", "Escape", 27); await sleep(300);
  } finally {
    await S.close();
    await admin.from("vault_items").delete().in("id", XI);
  }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
