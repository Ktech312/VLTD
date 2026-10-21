// RB10-024: the value box on a Vault card (Gallery view), PRODUCTION, synthetic fixture.
//   AUDIT_MANIFEST=<manifest> node rb11-card-value.cjs <label> <before|after>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const L = require(path.join(SD, "audit-lib.cjs"));
const { mclick, byText, dbItem, dbWait, mkItem, sleep, dismissBanner, ST, ENTER, typeIn } = X;
const LABEL = process.argv[2] || "run";
const PHASE = process.argv[3] || "before";
const AFTER = PHASE === "after";
const r = L.R("RB11");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, phase: PHASE, cases: [] };
let S, n = 0;
const refusal = (m) => /can't be negative|numbers only|not a number|enter an amount|enter one amount|decimal|not supported|too large|spaces inside|use a period/i.test(m || "");
async function rec(ok, control, expected, actual) {
  let shot = ""; try { await sleep(300); shot = path.join(L.AUD, await S.jshot(`rb11-card-${LABEL}-${PHASE}-${++n}`)); } catch {}
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: shot });
  if (AFTER) r.check(!!ok, { page: "/vault (Gallery card) | owner, Personal, desktop 1440", control, expected, actual, evidence: shot ? path.relative(L.AUD, shot).replace(/\\/g, "/") : "", impact: "RB10-024", repro: "" });
  else console.log(ok ? "OK-NOW " : "FAILS  ", control, "|", String(actual).slice(0, 220));
}
const card = (title) => `(() => { const a = [...document.querySelectorAll('a')].find((x) => (x.innerText || '').includes(${JSON.stringify(title)})); let e = a; for (let i = 0; i < 8 && e; i++) { e = e.parentElement; if (e && [...e.querySelectorAll('button')].some((b) => /^(\\$[\\d,]|Missing value)/.test(b.innerText.trim()))) return e; } return null; })()`;
const valueBtn = (title) => `[...(${card(title)}).querySelectorAll('button')].find((b) => /^(\\$[\\d,]|Missing value)/.test(b.innerText.trim()))`;
const valueInput = `document.querySelector('input[aria-label="Value"]')`;
const alertTxt = () => S.evaluate("[...document.querySelectorAll('[role=alert]')].filter((a) => a.id !== 'vltd-load-stalled').map((a) => a.textContent.trim()).filter(Boolean).join(' | ')");
async function openList() {
  await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 3", 90000, "vault").catch(() => {}); await sleep(2500); await dismissBanner(S);
  await mclick(S, byText("^Gallery$", "button")); await sleep(2000);
}
const attempt = async (title, text) => { await mclick(S, valueBtn(title)); await sleep(400); await mclick(S, valueInput); await typeIn(S, text, { clear: true }); await ENTER(S); await sleep(2500); };

(async () => {
  S = await X.S_("owner", { width: 1440, height: 900 });
  try {
    const t1 = `QA RB11 card ${ST} a`, t2 = `QA RB11 card ${ST} b`;
    const idA = await mkItem("rb11a", { title: t1, purchase_price: 50, current_value: 120 });
    const idB = await mkItem("rb11b", { title: t2, purchase_price: 50 });
    await openList();
    for (const [bad, why] of [["abc", "letters"], ["1e3", "exponent"], ["-40", "negative"], ["1,5", "comma as decimal"]]) {
      await attempt(t1, bad);
      const d = await dbItem(idA); const m = await alertTxt();
      await rec(Number(d.current_value) === 120 && refusal(m), `Card value '${bad}' (${why})`, "refused with a visible message; the saved value stays $120", `db current_value=${d.current_value}; visible message='${m}'`);
      await openList();
    }
    await attempt(t1, "");
    let d = await dbItem(idA);
    await rec(Number(d.current_value) === 120, "Card value left blank", "no change (blank is not turned into 0)", `db current_value=${d.current_value}`);
    await openList();
    await attempt(t2, "0");
    d = await dbWait(idB, (x) => x.current_value !== null && Number(x.current_value) === 0, 20000);
    await rec(d.ok, "Card value typed 0 on an item with no value yet", "saved as an explicit $0 value (known), not ignored", `db current_value=${d.row.current_value}`);
    await openList();
    await attempt(t1, "$250.50");
    d = await dbWait(idA, (x) => Number(x.current_value) === 250.5, 25000);
    const shownAfterEdit = await S.evaluate(`document.body.innerText.includes('$251') || document.body.innerText.includes('$250')`);
    await rec(d.ok, "Card value '$250.50'", "saved as 250.5", `db current_value=${d.row.current_value}`);
    await openList();
    const reloadShows = await S.evaluate(`(() => { const c = ${card(t1)}; return c ? c.innerText.replace(/\\s+/g, ' ').slice(0, 120) : ''; })()`);
    await rec(/\$25[01]/.test(reloadShows), "Card after reload", "the card shows the saved $250.50 (rounded display)", `card text: ${reloadShows}`);
    await S.close();
    S = await X.S_("owner", { width: 1440, height: 900 });
    await openList();
    const second = await S.evaluate(`(() => { const c = ${card(t1)}; return c ? c.innerText.replace(/\\s+/g, ' ').slice(0, 120) : ''; })()`);
    const secondB = await S.evaluate(`(() => { const c = ${card(t2)}; return c ? c.innerText.replace(/\\s+/g, ' ').slice(0, 120) : ''; })()`);
    await rec(/\$25[01]/.test(second) && /\$0\b/.test(secondB), "Clean second browser", "shows $250.50 on the first card and $0 on the second", `first: ${second} | second: ${secondB}`);
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    fs.writeFileSync(path.join(EV, `rb11-card-${LABEL}-${PHASE}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    try { await S.close(); } catch {}
    process.exit(0);
  }
})();
