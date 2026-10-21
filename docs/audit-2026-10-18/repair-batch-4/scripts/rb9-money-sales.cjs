// Repair batch 4 (RC-17 money inputs, RC-18 sales agreement) on PRODUCTION with the synthetic fixture. No AI call is made, nothing real is bought.
//   AUDIT_MANIFEST=<manifest> node rb9-money-sales.cjs <label> <before|after> [width]
//   before = reproduce on the build that is live now (evidence JSON + screenshots only, no master rows)
//   after  = same cases on the fixed build, written as RB9-nnn rows in rows.jsonl
// Width < 500 runs only the item-page cases in the phone emulation.
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { mclick, byText, byLabel, typeIn, ENTER, TAB, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, P, ST } = X;
const { rectOf, click, typeInto, alertText, pickSelect, chooseViaButton, mkPng, tmp, rowsByTitle, poll, fieldInput, btnExpr } = T;
const L = require(path.join(SD, "audit-lib.cjs"));

const LABEL = process.argv[2] || "run";
const PHASE = process.argv[3] || "before";
const WIDTH = Number(process.argv[4] || 1440);
const MOBILE = WIDTH < 500;
const AFTER = PHASE === "after";
const r = L.R("RB9");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
const out = { label: LABEL, phase: PHASE, width: WIDTH, fixtureOnly: true, cases: [] };
const num = (s) => Number(String(s ?? "").replace(/[^0-9.\-]/g, ""));
const tg = MOBILE ? "m" : "d";
const created = [];
let cur; let shotN = 0;

async function rec({ rows, page, control, expected, ok, actual, S = cur }) {
  let ev = "";
  if (!ok || AFTER) { try { await sleep(250); ev = await S.jshot(`rb9-${LABEL}-${PHASE}-${tg}-${++shotN}`); } catch {} }
  out.cases.push({ rows, page, control, expected, ok: !!ok, actual, evidence: ev });
  if (AFTER) r.check(!!ok, { page: `${page} | ${dev}`, control, expected, actual, evidence: ev, impact: `RB9 (${rows.join(", ")})`, repro: "" });
  else console.log(ok ? "OK-NOW " : "FAILS  ", rows.join(","), "|", control, "|", String(actual).slice(0, 200));
}
const bodyT = async (S) => (await S.text()).replace(/\s+/g, " ");
const msgOf = async (S) => { const a = await alertText(S); const t = await bodyT(S); return (a || (t.match(/(can't be negative|use numbers only|not a number|enter an amount|enter one amount|at most 2 decimal|not supported|too large|must be at least|can't be lower|Nothing was saved|Nothing was marked sold|is not a valid amount)[^.]{0,80}/i) || [""])[0]).slice(0, 160); };
// a refusal message names the problem; a green 'Saved' status is not one
const refusal = (m) => /can't be negative|numbers only|not a number|enter an amount|enter one amount|decimal|not supported|too large|at least|can't be lower|Nothing was|not a valid|spaces inside|use a period|Enter the sale price/i.test(m || "");
const stubPrompts = (S, answers) => S.evaluate(`(() => { window.__pq = ${JSON.stringify(answers)}; window.__prompts = []; window.prompt = (msg, def) => { window.__prompts.push({ msg: String(msg), def: def === undefined ? null : String(def) }); return window.__pq.length ? window.__pq.shift() : null; }; return true; })()`);

async function addPage(S) { await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000, "add form"); await sleep(500); }

(async () => {
  cur = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  let S = cur;
  const PGi = "/vault/item/[id] | owner, Personal";
  try {
    if (!MOBILE) {
      // ================================================== ADD / CAPTURE / BULK (RC-17)
      const addSave = btnExpr("^Save$|^Saving");
      const addCase = async (rows, label, pp, cv, expectSaved, expectPP, expectCV, extraCtl = "") => {
        await addPage(S);
        const title = `QA RB9 add ${label} ${ST}`.slice(0, 60);
        await typeInto(S, "document.getElementById('scan-title')", title);
        if (pp !== null) await typeInto(S, fieldInput("Purchase Price"), pp);
        if (cv !== null) await typeInto(S, fieldInput("Current Value"), cv);
        await click(S, addSave); await sleep(2500);
        const msg = await msgOf(S);
        const found = expectSaved ? await poll(async () => { const x = await rowsByTitle(P, title); return x.length ? x : null; }, 20000, 1500) : (await sleep(5000), await rowsByTitle(P, title));
        const row = (found || [])[0]; if (found) created.push(...found.map((x) => x.id));
        let ok;
        if (!expectSaved) ok = !row && refusal(msg);
        else ok = !!row && (expectPP === null ? row.purchase_price === null : Number(row.purchase_price) === expectPP) && (expectCV === null ? row.current_value === null : Number(row.current_value) === expectCV);
        await rec({ rows, page: "/vault/add", control: `Purchase Price ${JSON.stringify(pp)} / Current Value ${JSON.stringify(cv)}${extraCtl}`, expected: expectSaved ? `saved as ${expectPP === null ? "unknown (null)" : expectPP} / ${expectCV === null ? "unknown (null)" : expectCV}` : "refused with a visible message, nothing saved", ok, actual: row ? `saved: purchase_price=${row.purchase_price}, current_value=${row.current_value}; message='${msg}'` : `not saved; message='${msg}'` });
      };
      await addCase(["ADD-115"], "neg", null, "-40", false);
      await addCase(["ADD-139"], "exp", "1e3", "1e3", false);
      await addCase(["ADD-141"], "comma", "1,5", "1,5", false);
      await addCase(["ADD-142"], "dash", "5-3", "5-3", false);
      await addCase(["ADD-164"], "abc", "abc", "abc", false);
      await addCase(["RC-17 control"], "zero", "0", "0", true, 0, 0, " (explicit zero stays 0)");
      await addCase(["RC-17 control"], "blank", null, null, true, null, null, " (blank stays unknown)");
      await addCase(["RC-17 control"], "fmt", "$1,250.50", "2,000", true, 1250.5, 2000, " (supported currency format)");

      // ---- /capture
      {
        const nameSel = "document.getElementById('capture-item-name')";
        const labelInput = (lab) => `(() => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().toLowerCase().startsWith(${JSON.stringify(lab.toLowerCase())})); return l && l.parentElement.querySelector('input,select,textarea'); })()`;
        const openSection = async (n) => { await click(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('${n}'))`); await sleep(350); };
        const capSave = btnExpr("^(?:.*\\|)?(Save to Vault|Saving…)$");
        const capCase = async (rows, label, pp, cv, expectSaved) => {
          await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000, "capture form"); await sleep(500);
          const title = `QA RB9 cap ${label} ${ST}`;
          await typeInto(S, nameSel, title); await openSection(4);
          if (pp !== null) await typeInto(S, "document.getElementById('capture-purchase-price')", pp);
          if (cv !== null) await typeInto(S, labelInput("Current value"), cv);
          await click(S, capSave);
          const redirected = await S.waitFor("location.pathname === '/vault'", expectSaved ? 40000 : 9000, "redirect").then(() => true).catch(() => false);
          const msg = await msgOf(S);
          const rowsF = await rowsByTitle(P, title); const row = rowsF[0]; created.push(...rowsF.map((x) => x.id));
          const ok = expectSaved ? !!row && Number(row.current_value) === 0 && Number(row.purchase_price) === 0 : !row && !redirected && refusal(msg);
          await rec({ rows, page: "/capture", control: `Purchase price ${JSON.stringify(pp)} / Current value ${JSON.stringify(cv)} then Save to Vault`, expected: expectSaved ? "saved as 0 / 0" : "refused with a visible message, nothing saved", ok, actual: row ? `saved: purchase_price=${row.purchase_price}, current_value=${row.current_value}` : `not saved (redirected=${redirected}); message='${msg}'` });
        };
        await capCase(["ADD-005"], "neg", "5", "-40", false);
        await capCase(["RC-17 extra"], "exp", "1e3", "1e3", false);
        await capCase(["RC-17 control"], "zero", "0", "0", true);
      }

      // ---- /vault/bulk review grid (value -5)
      {
        const imgs = []; for (let i = 0; i < 2; i++) imgs.push(mkPng(tmp(`rb9b${i}.png`), 600 + i * 40, 400 + i * 30, [40 + i * 50, 120, 200 - i * 40]));
        const sel = (i) => `document.querySelectorAll('select')[${i}]`;
        await S.visit("/vault/bulk"); await S.waitFor("document.querySelectorAll('select').length >= 1", 60000, "bulk"); await sleep(1500);
        await chooseViaButton(S, btnExpr("Choose photos|Add more photos"), imgs); await sleep(2500);
        await pickSelect(S, sel(0), "Music"); await sleep(400);
        const cats = await S.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))");
        await pickSelect(S, sel(1), cats[0]); await sleep(400);
        await click(S, btnExpr("fill in by hand")); await sleep(2000);
        const title = `QA RB9 bulk ${ST}`;
        const names = "[...document.querySelectorAll('input')].filter((i) => i.placeholder === 'Untitled Item')";
        const vals = "[...document.querySelectorAll('input[type=number],input[inputmode=decimal]')]";
        await typeInto(S, `(${names})[0]`, title); await typeInto(S, `(${names})[1]`, title + " two");
        await typeInto(S, `(${vals})[0]`, "-5"); await typeInto(S, `(${vals})[1]`, "0");
        await click(S, "[...document.querySelectorAll('button')].find((b) => /^Add all \\d+ to Vault/.test(b.textContent.trim()))");
        const moved = await S.waitFor("location.pathname === '/vault'", 25000, "after add all").then(() => true).catch(() => false);
        const msg = await msgOf(S);
        const rowsF = await rowsByTitle(P, title); created.push(...rowsF.map((x) => x.id));
        const neg = rowsF.find((x) => x.title === title);
        await rec({ rows: ["ADD-404"], page: "/vault/bulk", control: "Current value -5 typed in the review grid, Add all", expected: "refused with a visible message, nothing added (never a negative value saved)", ok: !neg && !moved && refusal(msg), actual: neg ? `saved current_value=${neg.current_value} (moved=${moved})` : `not added (moved=${moved}); message='${msg}'` });
      }
    }

    // ================================================== ITEM PAGE (RC-17 + RC-18)
    const open = async (id) => { await X.openItem(S, id); await dismissBanner(S); await sleep(300); };

    // ---- inline purchase price 'abc' (ITM-070 / ITM-558)
    {
      const id = await mkItem("rb9p" + tg, { title: "QA RB9 price item", purchase_price: 75, current_value: 120 });
      await open(id);
      await mclick(S, `document.querySelector('[title="Click to edit purchase price"]')`); await sleep(350); await typeIn(S, "abc", { clear: true }); await ENTER(S); await sleep(1800);
      const d = await dbItem(id); const t = await bodyT(S); const msg = await msgOf(S);
      await rec({ rows: [MOBILE ? "ITM-558" : "ITM-070"], page: PGi, control: "Purchase price (letters 'abc' typed into a money field)", expected: "refused with a message; the recorded cost stays $75 (never silently $0)", ok: Number(d.purchase_price) === 75 && refusal(msg), actual: `db purchase_price=${d.purchase_price} (was 75); message='${msg}'; panel: ${(t.match(/Purchase price\s*\S+/) || [""])[0]}` });
      for (const [bad, why] of [["1e3", "exponent"], ["1,5", "comma decimal"]]) {
        await open(id);
        await mclick(S, `document.querySelector('[title="Click to edit purchase price"]')`); await sleep(350); await typeIn(S, bad, { clear: true }); await ENTER(S); await sleep(1500);
        const d2 = await dbItem(id);
        await rec({ rows: ["RC-17 extra"], page: PGi, control: `Purchase price '${bad}' (${why})`, expected: "refused; the saved cost is unchanged ($75), never 13 or 15", ok: Number(d2.purchase_price) === 75, actual: `db purchase_price=${d2.purchase_price}; message='${await msgOf(S)}'` });
      }
      await open(id);
      await mclick(S, `document.querySelector('[title="Click to edit purchase price"]')`); await sleep(350); await typeIn(S, "0", { clear: true }); await ENTER(S); await sleep(1800);
      const dz = await dbWait(id, (x) => x.purchase_price !== null && Number(x.purchase_price) === 0, 20000);
      await rec({ rows: ["RC-17 control"], page: PGi, control: "Purchase price typed 0", expected: "saved as an explicit $0 cost (known), not blank", ok: dz.ok, actual: `db purchase_price=${dz.row.purchase_price}` });
    }

    // ---- Pricing card: negative value, explicit $0 value, tile display (ITM-044/529, ITM-043/527)
    {
      const id = await mkItem("rb9v" + tg, { title: "QA RB9 value item", purchase_price: 50 });
      await open(id);
      const dBefore = await dbItem(id);
      const t0 = await bodyT(S);
      await rec({ rows: ["fallback"], page: PGi, control: "Purchase-cost fallback shown for an unvalued item", expected: "MARKET shows the purchase cost ($50, 'At purchase cost') and no valuation field is written (current_value / estimated_value stay blank)", ok: /MARKET\s*\$50/.test(t0) && dBefore.current_value === null && dBefore.estimated_value === null, actual: `${(t0.match(/MARKET.{0,60}/) || [""])[0]}; db current_value=${dBefore.current_value}, estimated_value=${dBefore.estimated_value}` });
      const openP = async () => { await mclick(S, byLabel("^Edit pricing$")); await sleep(500); };
      const setP = async (label, v) => { await mclick(S, `document.querySelector('input[aria-label="${label}"]')`); await typeIn(S, v, { clear: true }); };
      await openP(); await setP("Value", "-40"); await mclick(S, byLabel("^Save pricing$")); await sleep(1800);
      let d = await dbItem(id); let msg = await msgOf(S);
      await rec({ rows: [MOBILE ? "ITM-529" : "ITM-044"], page: PGi, control: "Pricing Value (negative -40)", expected: "refused with a message; no negative value stored", ok: !(Number(d.current_value) < 0) && refusal(msg), actual: `db current_value=${d.current_value}; message='${msg}'` });
      await setP("Value", "1e3"); await mclick(S, byLabel("^Save pricing$")); await sleep(1500);
      d = await dbItem(id);
      await rec({ rows: ["RC-17 extra"], page: PGi, control: "Pricing Value '1e3'", expected: "refused; never saved as 13", ok: d.current_value === null || Number(d.current_value) !== 13, actual: `db current_value=${d.current_value}; message='${await msgOf(S)}'` });
      await open(id); await openP(); await setP("Value", "0"); await mclick(S, byLabel("^Save pricing$")); await sleep(1500);
      d = (await dbWait(id, (x) => x.current_value !== null && Number(x.current_value) === 0, 25000)); const tt = await bodyT(S);
      // the pricing tiles sit behind the card's Details toggle
      await mclick(S, byText("^Details$", "button")); await sleep(700);
      const tile = await S.evaluate(`(() => { const l=[...document.querySelectorAll('div')].find(x=>x.children.length===0 && (x.textContent||'').trim()==='VALUE RANGE'); const e=l && l.parentElement; return e ? e.innerText.replace(/\\s+/g,' ') : ''; })()`);
      await rec({ rows: [MOBILE ? "ITM-527" : "ITM-043"], page: PGi, control: "Pricing card VALUE RANGE shows an explicit $0", expected: "the tile shows $0 where the MARKET panel shows $0 (stored as 0, not blank)", ok: d.ok && /\$0/.test(tile) && !/^VALUE RANGE\s*—/.test(tile) && /MARKET\s*\$0\b/.test(tt), actual: `db current_value=${d.row.current_value}; tile "${tile}"; ${(tt.match(/MARKET.{0,40}/) || [""])[0]}` });
    }

    // ---- asking price on the item page (ITM-227)
    if (!MOBILE) {
      const id = await mkItem("rb9a" + tg, { title: "QA RB9 ask item", purchase_price: 40, current_value: 120, status: "FOR_SALE", asking_price: 99 });
      await open(id);
      const askSel = `document.querySelector('input[aria-label="Asking price"], label input[type=number]')`;
      await mclick(S, askSel); await typeIn(S, "-5", { clear: true }); await TAB(S); await sleep(1800);
      let d = await dbItem(id); const shown = await S.evaluate(`document.querySelector('input[aria-label="Asking price"], label input[type=number]').value`); let msg = await msgOf(S);
      await rec({ rows: ["ITM-227"], page: PGi + " (for sale)", control: "Asking Price (negative -5)", expected: "refused with a message; the saved price is unchanged ($99) and the box does not pretend -5 was saved", ok: Number(d.asking_price) === 99 && refusal(msg), actual: `db asking_price=${d.asking_price}; box shows "${shown}"; message='${msg}'` });
      await open(id);
      await mclick(S, askSel); await typeIn(S, "", { clear: true }); await TAB(S); await sleep(1800);
      d = await dbWait(id, (x) => x.asking_price === null, 20000);
      await rec({ rows: ["RC-17 control"], page: PGi + " (for sale)", control: "Asking Price blank", expected: "blank clears the asking price (null), not $0", ok: d.ok, actual: `db asking_price=${d.row.asking_price}` });
      await open(id);
      await mclick(S, askSel); await typeIn(S, "0", { clear: true }); await TAB(S); await sleep(1800);
      d = await dbWait(id, (x) => x.asking_price !== null && Number(x.asking_price) === 0, 20000);
      await rec({ rows: ["RC-17 control"], page: PGi + " (for sale)", control: "Asking Price typed 0", expected: "an explicit $0 is kept as 0", ok: d.ok, actual: `db asking_price=${d.row.asking_price}` });
    }

    // ---- auction prices (ITM-248/249, ITM-629/630)
    {
      const id = await mkItem("rb9u" + tg, { title: "QA RB9 auction item", purchase_price: 10, current_value: 60, is_public: false });
      await open(id);
      const dlg = `[role=dialog][aria-label="Auction setup"]`;
      const inputs = `document.querySelectorAll('${dlg} input[type=number], ${dlg} input[inputmode=decimal]')`;
      const startSheet = async (a, b, c) => {
        await mclick(S, byText("^Start Auction", "button")); await sleep(800);
        await mclick(S, `${inputs}[0]`); await typeIn(S, a, { clear: true });
        await mclick(S, `${inputs}[1]`); await typeIn(S, b, { clear: true });
        await mclick(S, `${inputs}[2]`); await typeIn(S, c, { clear: true });
        await mclick(S, byText("^Start Auction$", "[role=dialog] button")); await sleep(2200);
      };
      await startSheet("-5", "2", "1");
      let d = await dbItem(id); let msg = await msgOf(S);
      await rec({ rows: [MOBILE ? "ITM-629" : "ITM-248"], page: PGi, control: "Start Auction with a negative starting bid", expected: "refused with a message; no auction started", ok: d.auction_status !== "ACTIVE" && !(Number(d.auction_starting_bid) < 0) && refusal(msg), actual: `db auction_status=${d.auction_status}; starting_bid=${d.auction_starting_bid}; reserve=${d.reserve_price}; buy_it_now=${d.buy_it_now_price}; message='${msg}'` });
      await open(id); await startSheet("5", "100", "50");
      d = await dbItem(id); msg = await msgOf(S);
      await rec({ rows: [MOBILE ? "ITM-630" : "ITM-249"], page: PGi, control: "Start Auction with Buy It Now below the reserve", expected: "refused with a message; no auction started", ok: d.auction_status !== "ACTIVE" && refusal(msg), actual: `db auction_status=${d.auction_status}; reserve=${d.reserve_price}; buy_it_now=${d.buy_it_now_price}; message='${msg}'` });
      await open(id); await startSheet("1e3", "", "");
      d = await dbItem(id);
      await rec({ rows: ["RC-17 extra"], page: PGi, control: "Start Auction with starting bid '1e3'", expected: "refused; never started at $13", ok: d.auction_status !== "ACTIVE", actual: `db auction_status=${d.auction_status}; starting_bid=${d.auction_starting_bid}; message='${await msgOf(S)}'` });
      if (d.auction_status === "ACTIVE") { await open(id); await mclick(S, byText("^Manage Auction", "button")); await sleep(700); await mclick(S, byText("^Cancel Auction$", "[role=dialog] button")); await sleep(2000); }
      if (!MOBILE) {
        await open(id); await startSheet("10", "50", "100");
        d = (await dbWait(id, (x) => x.auction_status === "ACTIVE", 25000));
        await rec({ rows: ["RC-17 control"], page: PGi, control: "Start Auction with valid prices (10 / 50 / 100)", expected: "starts with exactly those prices", ok: d.ok && Number(d.row.auction_starting_bid) === 10 && Number(d.row.reserve_price) === 50 && Number(d.row.buy_it_now_price) === 100, actual: `db auction_status=${d.row.auction_status}; starting_bid=${d.row.auction_starting_bid}; reserve=${d.row.reserve_price}; buy_it_now=${d.row.buy_it_now_price}` });
        await open(id); await mclick(S, byText("^Manage Auction", "button")); await sleep(700); await mclick(S, byText("^Cancel Auction$", "[role=dialog] button")); await sleep(2000);
        await admin.from("vault_items").update({ is_public: false }).eq("id", id);
      }
    }

    // ---- Return to Vault clears the sold platform (ITM-430 / ITM-666)
    {
      const id = await mkItem("rb9r" + tg, { title: "QA RB9 return item", status: "SOLD", sold_price: 200, sold_at: Date.now() - 2 * 86400e3, sold_platform: "eBay", purchase_price: 50, current_value: 90 });
      await S.visit(`/vault/item/${id}?sold=1`); await sleep(2500); await dismissBanner(S);
      S.dialogMode = "accept";
      await mclick(S, byText("^Return to Vault$", "button")); await sleep(3500);
      const d = await dbWait(id, (x) => x.status === "COLLECTION", 30000);
      await sleep(2500);
      const d2 = await dbItem(id);
      await rec({ rows: [MOBILE ? "ITM-666" : "ITM-430"], page: PGi + " (sold)", control: "Return to Vault clears the sold platform too", expected: "status back to COLLECTION with sold_price, sold_at and sold_platform all cleared", ok: d.ok && d2.sold_price === null && d2.sold_at === null && d2.sold_platform === null, actual: `status=${d2.status}; sold_price=${d2.sold_price}; sold_at=${d2.sold_at}; sold_platform=${d2.sold_platform}` });
      S.dialogMode = "dismiss";
    }

    if (!MOBILE) {
      // ================================================== FOR SALE page (ITM-292/294/306/308/364)
      const mk = async (tag, extra) => mkItem(tag, { status: "FOR_SALE", universe: "POP_CULTURE", ...extra });
      const idA = await mk("rb9fa", { title: "QA RB9 FS ask", asking_price: 120, current_value: 120, purchase_price: 30 });
      const idS1 = await mk("rb9fs1", { title: "QA RB9 FS sold abc", asking_price: 90, purchase_price: 30 });
      const idS2 = await mk("rb9fs2", { title: "QA RB9 FS sold neg", asking_price: 90, purchase_price: 30 });
      const idS3 = await mk("rb9fs3", { title: "QA RB9 FS sold 85", asking_price: 90, purchase_price: 30 });
      const idS4 = await mk("rb9fs4", { title: "QA RB9 FS sold zero", asking_price: 90, purchase_price: 30 });
      const idS5 = await mk("rb9fs5", { title: "QA RB9 FS sold nocost", asking_price: 90 });
      await S.visit("/vault/for-sale"); await sleep(2500); await dismissBanner(S);
      const cardOf = (title) => `[...document.querySelectorAll('article')].find(a=>a.innerText.includes(${JSON.stringify(title)}))`;
      const askIn = (title) => `${cardOf(title)}.querySelector('input[aria-label="Asking price"]')`;
      const setBtn = (title) => `${cardOf(title)}.querySelector('button[aria-label="Set asking price"], button[aria-label="Price saved"]')`;
      const cardReady = async (title) => { try { await S.waitFor(`!!(${cardOf(title)})`, 30000, "card " + title); } catch { const tl = await S.evaluate("[...document.querySelectorAll('article')].map(a=>a.innerText.slice(0,28).replace(/\s+/g,' ')).join(' | ')"); const pt = await S.path(); throw new Error("card not found: " + title + " on " + pt + "; cards: " + tl); } };
      const setAsk = async (title, v) => { await cardReady(title); await sleep(500); await mclick(S, askIn(title)); await typeIn(S, v, { clear: true }); await mclick(S, setBtn(title)); await sleep(2200); };
      await setAsk("QA RB9 FS ask", "-5");
      let d = await dbItem(idA); let msg = await msgOf(S);
      await rec({ rows: ["ITM-292"], page: "/vault/for-sale", control: "Asking price (negative -5) then Set", expected: "refused with a message; the saved asking price is unchanged ($120)", ok: Number(d.asking_price) === 120 && refusal(msg), actual: `db asking_price=${d.asking_price}; message='${msg}'` });
      await setAsk("QA RB9 FS ask", "abc");
      d = await dbItem(idA);
      await rec({ rows: ["RC-17 extra"], page: "/vault/for-sale", control: "Asking price 'abc' then Set", expected: "refused; unchanged ($120)", ok: Number(d.asking_price) === 120, actual: `db asking_price=${d.asking_price}; message='${await msgOf(S)}'` });
      await setAsk("QA RB9 FS ask", "");
      d = await dbWait(idA, (x) => x.asking_price === null, 20000);
      await rec({ rows: ["ITM-294"], page: "/vault/for-sale", control: "Asking price (blank) then Set clears it", expected: "blank clears the price (null), never $0", ok: d.ok, actual: `db asking_price=${d.row.asking_price}` });
      const soldBtn = (title) => `[...${cardOf(title)}.querySelectorAll('button')].find(b=>/^Mark sold$/.test(b.innerText.trim()))`;
      const markSold = async (title, answers) => { await cardReady(title); await sleep(800); await stubPrompts(S, answers); await mclick(S, soldBtn(title)); await sleep(3000); };
      await markSold("QA RB9 FS sold abc", ["abc", "eBay"]);
      d = await dbItem(idS1); msg = await msgOf(S);
      await rec({ rows: ["ITM-306"], page: "/vault/for-sale", control: "Mark sold with letters as the sale price ('abc')", expected: "refused with a message; nothing is sold (never recorded at $0)", ok: d.status !== "SOLD" && refusal(msg), actual: `status=${d.status}; sold_price=${d.sold_price}; message='${msg}'` });
      await markSold("QA RB9 FS sold neg", ["-50", "eBay"]);
      d = await dbItem(idS2);
      await rec({ rows: ["ITM-308"], page: "/vault/for-sale", control: "Mark sold with a negative price (-50)", expected: "refused; nothing is sold", ok: d.status !== "SOLD", actual: `status=${d.status}; sold_price=${d.sold_price}; message='${await msgOf(S)}'` });
      await markSold("QA RB9 FS sold 85", ["$85", "Whatnot"]);
      d = await dbWait(idS3, (x) => x.status === "SOLD" && Number(x.sold_price) === 85, 25000);
      await rec({ rows: ["ITM-364"], page: "/vault/for-sale", control: "Mark sold ($85 on Whatnot) keeps the actual sale price", expected: "status SOLD with sold_price 85 and platform Whatnot", ok: d.ok && d.row.sold_platform === "Whatnot", actual: `status=${d.row.status}; sold_price=${d.row.sold_price}; platform=${d.row.sold_platform}` });
      await markSold("QA RB9 FS sold zero", ["0", "In person"]);
      d = await dbWait(idS4, (x) => x.status === "SOLD" && x.sold_price !== null && Number(x.sold_price) === 0, 25000);
      await rec({ rows: ["RC-17 control"], page: "/vault/for-sale", control: "Mark sold typed 0", expected: "an explicit $0 sale is recorded as $0", ok: d.ok, actual: `status=${d.row.status}; sold_price=${d.row.sold_price}` });
      await markSold("QA RB9 FS sold nocost", ["70", "In person"]);
      d = await dbWait(idS5, (x) => x.status === "SOLD" && Number(x.sold_price) === 70, 25000);

      // ================================================== SALES agreement (ITM-354/353/357/364/333)
      // a sold item with a known cost + platform, to compare the same sale on every page
      const idP = await mkItem("rb9pf" + tg, { title: "QA RB9 profit item", status: "SOLD", sold_price: 680, sold_at: Date.now() - 86400e3, sold_platform: "eBay", purchase_price: 35, purchase_tax: 5, purchase_shipping: 2, current_value: 700 });
      const idZ = await mkItem("rb9zc" + tg, { title: "QA RB9 zero cost item", status: "SOLD", sold_price: 40, sold_at: Date.now() - 86400e3, sold_platform: "In person", purchase_price: 0 });
      const base = Date.now();
      const ledger = [
        { id: `qa_sale_${ST}_rb9a`, title: "QA RB9 Ledger Win", universe: "POP_CULTURE", category: "Comics", purchase_price: 20, sale_price: 100, platform: "In person", sold_at: new Date(base - 3 * 86400e3).toISOString() },
        { id: `qa_sale_${ST}_rb9b`, title: "QA RB9 Ledger Loss", universe: "SPORTS", category: "Sports Cards", purchase_price: 80, sale_price: 50, platform: "In person", sold_at: new Date(base - 10 * 86400e3).toISOString() },
        { id: `qa_sale_${ST}_rb9c`, title: "QA RB9 Ledger No Cost", universe: "POP_CULTURE", category: "Comics", purchase_price: null, sale_price: 70, platform: "In person", sold_at: new Date(base - 40 * 86400e3).toISOString() },
        { id: `qa_sale_${ST}_rb9d`, title: "QA RB9 Ledger Zero Cost", universe: "MUSIC", category: "Audio Formats", purchase_price: 0, sale_price: 30, platform: "In person", sold_at: new Date(base - 70 * 86400e3).toISOString() },
      ].map((x) => ({ ...x, profile_id: P, profit: null }));
      const ins = await admin.from("sales").insert(ledger);
      if (ins.error) throw new Error("ledger seed: " + ins.error.message);
      const salesCard = (title) => S.evaluate(`(() => { const e=[...document.querySelectorAll('a')].find(a=>a.innerText.trim()===${JSON.stringify(title)}); const c = e && (e.closest('div.rounded-2xl') || e.closest('article') || e.parentElement.parentElement); return c ? c.innerText.replace(/\\s+/g,' ') : ''; })()`);
      await S.visit("/sales"); await sleep(4500); await dismissBanner(S);
      const noCost = await salesCard("QA RB9 Ledger No Cost"), zeroCost = await salesCard("QA RB9 Ledger Zero Cost");
      await rec({ rows: ["ITM-354"], page: "/sales", control: "Sale card with no purchase price", expected: "profit unknown: not shown as a +$70 gain equal to the sale price", ok: noCost.length > 0 && !/\+\$\d/.test(noCost) && /unknown/i.test(noCost), actual: noCost.slice(0, 200) });
      await rec({ rows: ["ITM-357"], page: "/sales", control: "Sale card with a recorded $0 cost", expected: "shows a cost of $0 (a recorded zero), not a dash that reads as unknown", ok: zeroCost.length > 0 && /\$0\b/.test(zeroCost) && !/Cost\s*—|Bought\s*—/.test(zeroCost), actual: zeroCost.slice(0, 200) });
      // wins / losses / totals must agree with the cards on the same page
      const sum = await S.evaluate(`(() => { const t = document.body.innerText.replace(/\\s+/g,' '); const cards=[...document.querySelectorAll('a.font-semibold')].map(a => { const c=a.closest('div.rounded-2xl')||a.parentElement.parentElement; return c ? c.innerText.replace(/\\s+/g,' ') : ''; }); return { t, cards }; })()`);
      const plus = sum.cards.filter((c) => /\+\$\d/.test(c) && !/unknown/i.test(c)).length;
      const minus = sum.cards.filter((c) => /-\$\d/.test(c) && !/unknown/i.test(c)).length;
      const winsShown = Number((sum.t.match(/WINS\s*(\d+)/i) || [])[1]), lossesShown = Number((sum.t.match(/LOSSES\s*(\d+)/i) || [])[1]);
      await rec({ rows: ["ITM-353"], page: "/sales", control: "Wins / Losses cards", expected: "Wins and Losses equal the cards shown with a gain / a loss; a sale with no recorded cost is neither (so the no-cost ledger sale adds to neither)", ok: winsShown === plus && lossesShown === minus && !/\+\$\d/.test(noCost), actual: `no-cost card gain=${/\+\$\d/.test(noCost)}; Wins ${winsShown} vs ${plus} gain cards; Losses ${lossesShown} vs ${minus} loss cards (${sum.cards.length} cards)` });
      const soldShown = num((sum.t.match(/TOTAL SOLD\s*(\$[\d,]+)/i) || [])[1]);
      const soldSum = sum.cards.reduce((s, c) => s + num((c.match(/Sold\s+(\$[\d,]+)/) || [])[1] || 0), 0);
      await rec({ rows: ["ITM-364"], page: "/sales", control: "Total Sold card equals the Sold amounts on the cards", expected: "revenue total = sum of the cards' Sold amounts (a sale never shows 'Sold —' with the money missing from the total)", ok: soldShown === soldSum && !sum.cards.some((c) => /Sold\s*—/.test(c)), actual: `Total Sold ${soldShown} vs sum of cards ${soldSum}; cards with Sold —: ${sum.cards.filter((c) => /Sold\s*—/.test(c)).length}` });
      const hist = await salesCard("QA RB9 FS sold 85");
      await rec({ rows: ["ITM-364"], page: "/sales", control: "Sales History card for the sale made on For Sale ($85)", expected: "shows Sold $85, cost $30 and a +$55 style profit (not 'Sold —' / -100%)", ok: /Sold\s*\$85\b/.test(hist) && !/-100%/.test(hist), actual: hist.slice(0, 220) });
      const noCostSold = await salesCard("QA RB9 FS sold nocost");
      await rec({ rows: ["ITM-354"], page: "/sales", control: "Sale made from For Sale on an item with no cost", expected: "profit unknown (not +$70, not -100%)", ok: /Sold\s*\$70\b/.test(noCostSold) && /unknown/i.test(noCostSold) && !/\+\$\d/.test(noCostSold) && !/-100%/.test(noCostSold), actual: noCostSold.slice(0, 220) });

      // one sale, four views: item page, Sold card, Sales History card, Home totals
      await S.visit(`/vault/item/${idP}?sold=1`); await sleep(3000);
      const it = await bodyT(S);
      const itemProfit = (it.match(/Profit \/ Loss\s*(\+?-?\$[\d,]+)/) || [])[1];
      const itemCost = (it.match(/Cost \(all-in\)\s*(\$[\d,]+)/) || [])[1];
      const itemFees = (it.match(/Estimated fees\s*(\$[\d,]+)/) || [])[1];
      await S.visit("/vault/sold"); await sleep(3500);
      const soldCard = await S.evaluate(`(() => { const a=[...document.querySelectorAll('article')].find(a=>a.innerText.includes('QA RB9 profit item')); return a ? a.innerText.replace(/\\s+/g,' ') : ''; })()`);
      const soldCardProfit = (soldCard.match(/(\+?-?\$[\d,]+) profit/) || [])[1];
      await S.visit("/sales"); await sleep(4000);
      const salesProfitCard = await salesCard("QA RB9 profit item");
      const salesCardProfit = (salesProfitCard.match(/(\+\$[\d,]+|-\$[\d,]+)/) || [])[1];
      const same = itemProfit && soldCardProfit && salesCardProfit && num(itemProfit) === num(soldCardProfit) && num(soldCardProfit) === num(salesCardProfit);
      await rec({ rows: ["ITM-333"], page: "/vault/item/[id]?sold=1 vs /vault/sold vs /sales", control: "Profit for the same sale on the item page, the Sold card and the Sales History card", expected: "the same profit on all three (revenue 680 - cost 42 - estimated fees)", ok: !!same, actual: `item page ${itemProfit} (cost ${itemCost}, fees ${itemFees}); Sold card ${soldCardProfit}; Sales History ${salesCardProfit}` });
      await S.visit("/vault/sold"); await sleep(3500);
      const soldPageT = await bodyT(S);
      const soldPageProfit = (soldPageT.match(/Profit\s*(\+?-?\$[\d,]+)/i) || soldPageT.match(/(\+?-?\$[\d,]+)\s*(?:realized )?profit/i) || [])[1];
      await S.visit("/"); await sleep(6000);
      const homeT = await bodyT(S);
      const homeProfit = (homeT.match(/Profit\s*([+-]\$[\d,]+)\s*after estimated fees/) || [])[1];
      const homeRev = (homeT.match(/\$[\d,]+ from \d+ sold/) || [homeT.match(/Realized[^$]{0,30}(\$[\d,]+)/) || []][0] || [])[0];
      out.home = { homeProfit, homeRev, soldPageProfit, soldHeader: (soldPageT.match(/.{0,80}realized.{0,80}/i) || [""])[0] };
      await rec({ rows: ["ITM-333"], page: "/ vs /vault/sold", control: "Home sales profit equals the Sold page profit", expected: "same profit figure on Home and on the Sold page (both from the one sale rule)", ok: !!homeProfit && !!soldPageProfit && num(homeProfit.replace("+", "")) === num(soldPageProfit), actual: `Home ${homeProfit}; Sold page ${soldPageProfit}; (${JSON.stringify(out.home)})` });

      // reload and a clean second browser see the same
      await S.close();
      S = cur = await X.S_("owner", { width: WIDTH, height: 900 });
      await S.visit("/sales"); await sleep(6000);
      const c2 = await salesCard("QA RB9 FS sold 85"); const c2n = await salesCard("QA RB9 Ledger No Cost"); const c2p = await salesCard("QA RB9 profit item");
      await rec({ rows: ["ITM-364", "ITM-354", "ITM-333"], page: "/sales (clean second browser)", control: "Sales History in a clean browser", expected: "same figures: $85 sale, no-cost ledger sale profit unknown, the 680 sale profit as in the first browser", ok: /Sold\s*\$85\b/.test(c2) && /unknown/i.test(c2n) && num((c2p.match(/(\+\$[\d,]+|-\$[\d,]+)/) || [])[1]) === num(salesCardProfit), actual: `${c2.slice(0, 90)} | ${c2n.slice(0, 90)} | ${c2p.slice(0, 120)}` });
      await S.visit("/vault/sold"); await sleep(5000);
      const c3 = await S.evaluate(`(() => { const a=[...document.querySelectorAll('article')].find(a=>a.innerText.includes('QA RB9 profit item')); return a ? a.innerText.replace(/\\s+/g,' ') : ''; })()`);
      await rec({ rows: ["ITM-333"], page: "/vault/sold (clean second browser)", control: "Sold card in a clean browser", expected: "same profit as in the first browser", ok: num((c3.match(/(\+?-?\$[\d,]+) profit/) || [])[1]) === num(soldCardProfit), actual: c3.slice(0, 200) });
      await admin.from("sales").delete().in("id", ledger.map((x) => x.id));
    }
  } catch (e) {
    console.error("RUNNER ERROR", e);
    out.error = String(e && e.stack || e).slice(0, 600);
  } finally {
    try { await admin.from("sales").delete().like("id", `qa_sale_${ST}_rb9%`); } catch {}
    for (const id of created) { try { await admin.from("vault_items").delete().eq("id", id).eq("profile_id", P); } catch {} }
    fs.writeFileSync(path.join(EV, `rb9-${LABEL}-${PHASE}-${tg}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    try { await S.close(); } catch {}
    process.exit(0);
  }
})();
