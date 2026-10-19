// EXH suite 2: /museum/new (creation, validation, cancel, access choices), delete of a spare QA exhibition, Business profile creation.
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, byLabelRe, typeInto, key, gdb, gItemIds, waitText } = X;
const R = rows();
const m = man();
const PG = "/museum/new | owner, Personal";
const count = async (pid = m.personalId) => (await admin.from("galleries").select("id,title").eq("profile_id", pid)).data;
const field = (label) => `(() => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim().startsWith(${JSON.stringify(label)})); return l ? (l.parentElement.querySelector('input,textarea,select')) : null; })()`;
const createBtn = `[...document.querySelectorAll('button,a')].find(b => b.textContent.trim() === 'Create Exhibition' && b.tagName === 'BUTTON')`;
const setSel = (labelText, val) => `(() => { const s = ${field(labelText)}; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s, ${JSON.stringify(val)}); s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`;

async function createVia(S, { title, description = "", pill = null, theme = null, display = null, adult = false }) {
  await S.visit("/museum/new"); await sleep(1500);
  await mclick(S, field("Exhibition Title"), { wait: 200 });
  await S.send("Input.insertText", { text: title });
  if (description) { await mclick(S, field("Description"), { wait: 200 }); await S.send("Input.insertText", { text: description }); }
  if (pill) await mclick(S, `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(pill)})`, { wait: 300 });
  if (theme) await S.evaluate(setSel("Theme Pack", theme));
  if (display) await S.evaluate(setSel("Display Mode", display));
  if (adult) await mclick(S, `document.querySelector('input[type=checkbox]')`, { wait: 300 });
  await mclick(S, createBtn, { wait: 4500 });
  return S.path();
}

(async () => {
  const personalTitles0 = (await count()).map((g) => g.title).sort();
  const n0 = personalTitles0.length;
  let S = await session("owner");
  const created = {};
  try {
    const SKIP = process.argv.includes("--skip-val"); // validation rows already recorded by a run that crashed after them
    if (!SKIP) { // ---- validation + cancel (cold browser: direct URL)
    await S.visit("/museum/new"); await sleep(2500);
    const txt0 = (await S.text()).replace(/\s+/g, " ");
    const dis0 = await S.evaluate(`(() => { const b = ${createBtn}; return b ? b.disabled || b.getAttribute('aria-disabled') === 'true' : null; })()`);
    const shotNew = await S.jshot("exh-new-initial-1440");
    R.check(dis0 === true, { page: PG, control: "'Create Exhibition' with an empty title", expected: "Cannot create without a title", actual: "disabled=" + dis0, impact: "misleading result", repro: "Open /museum/new" });
    const explained = /title.*(required|needed)|enter a title|add a title|name your exhibition/i.test(txt0);
    R.check(explained, { page: PG, control: "'Create Exhibition' disabled state explanation", expected: "The page says why Create is greyed out (a title is needed)", actual: explained ? "explained" : "Button is disabled with no message; the only hint is the placeholder 'e.g. Hall of Grails' in the title field", evidence: shotNew, impact: "usability", repro: "Open /museum/new and look at the Create button" });
    const stats = (txt0.match(/CURRENT EXHIBITIONS\s*(\d+)/) || [])[1];
    R.check(Number(stats) === n0, { page: PG + " | clean browser, direct URL", control: "'CURRENT EXHIBITIONS' count tile", expected: `${n0} (the profile has ${n0} exhibitions)`, actual: String(stats) + (Number(stats) !== n0 ? " - the count comes from the browser's own cache, which is empty until the Exhibitions page has loaded once" : ""), evidence: Number(stats) !== n0 ? shotNew : "", impact: "misleading result", repro: "Clean browser, open /museum/new directly" });
    await mclick(S, field("Exhibition Title"), { wait: 200 });
    await S.send("Input.insertText", { text: "     " });
    const dis1 = await S.evaluate(`${createBtn}.disabled`);
    R.check(dis1 === true, { page: PG, control: "'Create Exhibition' with a whitespace-only title", expected: "Still disabled", actual: "disabled=" + dis1, impact: "data loss", repro: "Type spaces in the title" });
    await mclick(S, byLabel("Cancel"), { wait: 3000 });
    R.check((await S.path()) === "/museum" && (await count()).length === n0, { page: PG, control: "'Cancel'", expected: "Returns to /museum and nothing is created", actual: `${await S.path()}; exhibitions ${n0} -> ${(await count()).length}`, impact: "data loss", repro: "Type a title, click Cancel" });
    await S.visit("/museum/new"); await sleep(1500);
    await mclick(S, field("Exhibition Title"), { wait: 200 }); await S.send("Input.insertText", { text: "QA Throwaway" });
    await mclick(S, byLabelRe("Back to Exhibitions"), { wait: 3000 });
    R.check((await S.path()) === "/museum" && (await count()).length === n0, { page: PG, control: "'Back to Exhibitions' with a title typed", expected: "Leaves without creating anything", actual: `${await S.path()}; ${(await count()).length} exhibitions`, impact: "data loss", repro: "Type a title, click Back to Exhibitions" });
    } // end validation block
    await S.visit("/museum/new"); await sleep(1500);
    await mclick(S, byLabel("Home"), { wait: 3000 });
    R.check((await S.path()) === "/dashboard", { page: PG, control: "'Home' pill", expected: "Opens /dashboard", actual: await S.path(), impact: "usability", repro: "Click Home" });

    // ---- cold-browser creation must not disturb the other exhibitions
    let p = await createVia(S, { title: "QA Spare A", description: "audit spare A" });
    await sleep(4000);
    let after = await count();
    const a = after.find((g) => g.title === "QA Spare A");
    created.A = a && a.id;
    R.check(!!a && /^\/museum\/[0-9a-f-]{36}$/.test(p) && p.endsWith(a.id) && personalTitles0.every((t) => after.some((g) => g.title === t)), { page: PG + " | clean browser", control: "'Create Exhibition' (title + description, defaults)", expected: "One new exhibition opens in the builder and every existing exhibition is still there", actual: `path ${p}; now ${after.length} exhibitions (was ${n0}); existing all present: ${personalTitles0.every((t) => after.some((g) => g.title === t))}`, impact: "data loss", repro: "Clean browser, /museum/new, type title, Create" });
    const gA = a ? await gdb(a.id) : null;
    R.check(!!gA && gA.visibility === "LOCKED" && gA.state === "ACTIVE" && gA.description === "audit spare A" && (gA.layout.themePack === "classic") && gA.layout.displayMode === "grid", { page: PG, control: "Defaults saved on create", expected: "Private (LOCKED), Active, description kept, Classic theme, Grid", actual: gA ? `${gA.visibility}/${gA.state}; desc="${gA.description}"; theme ${gA.layout.themePack}; mode ${gA.layout.displayMode}` : "missing", impact: "data loss", repro: "Create with defaults" });
    // ---- the access pills
    await S.visit("/museum/new"); await sleep(1500);
    const descs = {};
    for (const pill of ["Private", "Public Exhibit", "Guest View", "Registered Users"]) {
      await mclick(S, `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(pill)})`, { wait: 300 });
      descs[pill] = await S.evaluate(`(() => { const d = [...document.querySelectorAll('div')].find(x => /^(Private Exhibition|Public Exhibition|Guest View|Registered Users) - /.test(x.textContent.trim()) && x.children.length === 0); return d ? d.textContent.trim().slice(0, 70) : null; })()`);
    }
    R.check(/^Private Exhibition/.test(descs["Private"]) && /^Public Exhibition/.test(descs["Public Exhibit"]) && /^Guest View/.test(descs["Guest View"]) && /^Registered Users/.test(descs["Registered Users"]), { page: PG, control: "Access pills (Private / Public Exhibit / Guest View / Registered Users)", expected: "Each pill changes the explanation under it to its own meaning", actual: JSON.stringify(descs), impact: "usability", repro: "Click each pill" });
    // B: Guest View + shelf + midnight + 18+
    p = await createVia(S, { title: "QA Spare B", pill: "Guest View", theme: "midnight", display: "shelf", adult: true });
    await sleep(3500);
    const b = (await count()).find((g) => g.title === "QA Spare B"); created.B = b && b.id; const gB = b ? await gdb(b.id) : null;
    R.check(!!gB && gB.visibility === "INVITE" && gB.layout.guestViewMode !== "guest" && gB.layout.themePack === "midnight" && gB.layout.displayMode === "shelf" && gB.layout.adultOnly === true, { page: PG, control: "Create with Guest View + Midnight + Shelf + 18+", expected: "INVITE (Guest View, not registered-only), midnight, shelf, adult-only saved", actual: gB ? `${gB.visibility}; guestViewMode=${gB.layout.guestViewMode}; ${gB.layout.themePack}; ${gB.layout.displayMode}; adult=${gB.layout.adultOnly}` : "missing", impact: "data loss", repro: "New: pick Guest View, Midnight, Shelf, tick 18+, Create" });
    p = await createVia(S, { title: "QA Spare C", pill: "Registered Users" });
    await sleep(3500);
    const c = (await count()).find((g) => g.title === "QA Spare C"); created.C = c && c.id; const gC = c ? await gdb(c.id) : null;
    R.check(!!gC && gC.visibility === "INVITE" && gC.layout.guestViewMode === "guest", { page: PG, control: "Create with Registered Users", expected: "INVITE with guestViewMode 'guest'", actual: gC ? `${gC.visibility}; guestViewMode=${gC.layout.guestViewMode}` : "missing", impact: "data loss", repro: "New: pick Registered Users, Create" });
    p = await createVia(S, { title: "QA Spare D", pill: "Public Exhibit" });
    await sleep(3500);
    const d = (await count()).find((g) => g.title === "QA Spare D"); created.D = d && d.id; const gD = d ? await gdb(d.id) : null;
    R.check(!!gD && gD.visibility === "PUBLIC" && gD.state === "ACTIVE", { page: PG, control: "Create with Public Exhibit", expected: "PUBLIC / ACTIVE", actual: gD ? `${gD.visibility}/${gD.state}` : "missing", impact: "data loss", repro: "New: pick Public Exhibit, Create" });
    // the new empty exhibition on the list
    await S.visit("/vault"); await sleep(5000);
    await S.visit("/museum"); await sleep(4000);
    const cards = await X.cardText(S);
    const cardA = cards.find((x) => x.includes("QA Spare A")) || "";
    R.check(/\b0 items\b/.test(cardA) && /\$0\b/.test(cardA) && cards.length === n0 + 4, { page: "/museum | owner after creating 4 spares", control: "New empty exhibition card", expected: "Appears with '0 items' and $0; list shows " + (n0 + 4) + " exhibitions", actual: `${cards.length} cards; ${cardA.replace(/^\+\s*/, "")}`, impact: "misleading result", repro: "Create, open /museum" });
    // ---- double click Create
    await S.visit("/museum/new"); await sleep(1500);
    await mclick(S, field("Exhibition Title"), { wait: 200 }); await S.send("Input.insertText", { text: "QA Double Click" });
    const rr = await X.rectOf(S, createBtn);
    for (let i = 0; i < 2; i++) { await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rr.x, y: rr.y, button: "left", clickCount: i + 1, buttons: 1 }); await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rr.x, y: rr.y, button: "left", clickCount: i + 1, buttons: 0 }); }
    await sleep(5000);
    const dbl = (await count()).filter((g) => g.title === "QA Double Click");
    created.dbl = dbl.map((g) => g.id);
    R.check(dbl.length === 1, { page: PG, control: "'Create Exhibition' double-click", expected: "One exhibition created", actual: dbl.length + " created", impact: "data loss", repro: "Type a title, double-click Create" });
    // ---- long title
    const longTitle = "L".repeat(140);
    p = await createVia(S, { title: longTitle });
    await sleep(3500);
    const lg = (await count()).find((g) => g.title && g.title.startsWith("LLLL")); created.long = lg && lg.id;
    R.check(!!lg && lg.title.length <= 80, { page: PG, control: "Title longer than the builder's 80-character limit", expected: "Same 80-character limit as the editor (title is cut or refused)", actual: lg ? `saved title length ${lg.title.length} (the exhibition editor caps its title field at 80)` : "not created", impact: "cosmetic", repro: "Type 140 characters, Create" });
    // ---- delete a spare from the list: only that row goes
    const itemsBefore = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId)).data.length;
    const listBefore = (await count()).map((g) => g.title).sort();
    await S.visit("/vault"); await sleep(4000); await S.visit("/museum"); await sleep(3500);
    await mclick(S, byLabel("Show details for QA Spare C"), { wait: 500 });
    await mclick(S, `[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Delete')`, { wait: 600 });
    await mclick(S, byLabelRe("Yes Delete FOREVER"), { wait: 5000 });
    const listAfter = (await count()).map((g) => g.title).sort();
    const itemsAfter = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId)).data.length;
    const gone = listBefore.filter((t) => !listAfter.includes(t));
    const cardsAfter = await X.cardText(S);
    R.check(gone.length === 1 && gone[0] === "QA Spare C" && itemsAfter === itemsBefore && !cardsAfter.some((x) => x.includes("QA Spare C")) && (await admin.from("gallery_items").select("id").eq("gallery_id", created.C)).data.length === 0, { page: "/museum | owner", control: "Delete dialog 'Yes Delete FOREVER' (QA Spare C)", expected: "Only 'QA Spare C' is deleted; every other exhibition and all Vault items stay; card disappears", actual: `removed: ${JSON.stringify(gone)}; vault items ${itemsBefore} -> ${itemsAfter}; card gone ${!cardsAfter.some((x) => x.includes("QA Spare C"))}`, evidence: "", impact: "data loss", repro: "Select a spare, Delete, Yes Delete FOREVER" });
    delete created.C;
    // ---- Business profile creation stays on Business
    const B = await session("business");
    try {
      const bn0 = (await count(m.businessId)).length;
      await createVia(B, { title: "QA Biz Spare" });
      await sleep(4000);
      const bg = (await count(m.businessId)).find((g) => g.title === "QA Biz Spare");
      created.biz = bg && bg.id;
      const personalLeak = (await count()).some((g) => g.title === "QA Biz Spare");
      R.check(!!bg && !personalLeak && bn0 === 0, { page: PG.replace("Personal", "Business"), control: "'Create Exhibition' on the Business profile", expected: "Exhibition belongs to the Business profile only", actual: `business rows ${bn0} -> ${(await count(m.businessId)).length}; appears on Personal: ${personalLeak}`, impact: "privacy/data loss", repro: "Switch to Business, create" });
      await B.visit("/museum"); await sleep(4500);
      const bcards = await X.cardText(B);
      R.check(bcards.length === 1 && /QA Biz Spare/.test(bcards[0]), { page: "/museum | owner, Business", control: "Business list after creation", expected: "Only the Business exhibition", actual: bcards.join(" | "), evidence: await B.jshot("exh-list-business-one-1440"), impact: "privacy/data loss", repro: "Open /museum on Business" });
    } finally { await B.close(); }
    require("fs").writeFileSync(__dirname + "/exh-created.json", JSON.stringify(created));
    console.log("created ids", JSON.stringify(created));
  } finally { await S.close(); }
  console.log("DONE new suite");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
