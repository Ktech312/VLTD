// ADD audit: what a person is told over the first 90 s after a refused cloud save (/capture and /vault/add), and what happens when the connection returns by itself.
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, rec, rowsByTitle, removeByPrefix, click, typeInto, text, alertText, block } = T;
const PREFIX = "AUD ADD ";
const toast = (S) => S.evaluate("(() => { const t = document.body.innerText; const m = t.match(/(Saving to your account|Saved to your account|[^\\n]*(couldn.t|could not|not saved|failed|retry|will retry|offline)[^\\n]*)/ig); return m ? [...new Set(m)].slice(0, 4).join(' || ') : ''; })()");
(async () => {
  const P = man().personalId;
  await removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  const timeline = [];
  try {
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000);
    const t = PREFIX + "Refused " + Date.now().toString(36);
    await typeInto(S, "document.getElementById('capture-item-name')", t);
    await block(S, true);
    const t0 = Date.now();
    await click(S, T.btnExpr("^Save to Vault$"));
    for (let i = 0; i < 9; i++) { await sleep(10000); timeline.push([Math.round((Date.now() - t0) / 1000), await S.path(), await toast(S)]); }
    const rowsRefused = await rowsByTitle(P, t);
    console.log(JSON.stringify(timeline));
    await S.jshot("add-interrupt-90s");
    const everWarned = timeline.some(([, , m]) => /couldn.t|could not|not saved|failed|retry|offline/i.test(m));
    await rec(S, everWarned && rowsRefused.length === 0, { page: "/capture then /vault | owner, database requests refused", control: "Save to Vault while the database refuses the save (90 s watch)", expected: "Within a short time the page tells the person the item has NOT reached their account (and that it is kept on this device and will retry)", actual: `database rows=${rowsRefused.length}; messages seen over 90 s: ${JSON.stringify(timeline.map((x) => x[2]).filter((v, i, a) => a.indexOf(v) === i))}`, impact: "data loss", repro: "Block requests to vault_items, /capture, name, Save, watch the Vault page for 90 s" });
    // then connection returns on its own
    await block(S, false);
    const got = await T.poll(async () => { const r = await rowsByTitle(P, t); return r.length ? r : null; }, 120000, 5000);
    await rec(S, !!got && got.length === 1, { page: "/vault | owner", control: "Connection returns by itself after a refused save", expected: "The kept item reaches the account on its own, once", actual: got ? `row appeared (${got.length})` : "no row appeared within 120 s without pressing anything", impact: "data loss", repro: "After the 90 s watch, unblock; wait 2 min without touching the page" });
    if (got) await T.removeItems(got);
  } catch (e) { console.error("ERR", e); try { await S.jshot("add-interrupt-error"); } catch {} }
  finally { try { await block(S, false); } catch {} await S.close(); await removeByPrefix(PREFIX); for (const p of T.mine()) console.log("leftover", (await rowsByTitle(p, PREFIX)).length); }
})();
