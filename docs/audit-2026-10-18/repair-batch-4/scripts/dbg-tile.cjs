const path = require("path");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const { sleep, dismissBanner, ST, byLabel } = X;
(async () => {
  const S = await X.S_("owner", { width: 1440, height: 900 });
  try {
    await X.openItem(S, `qa_vz_${ST}_itm_rb9vd`); await dismissBanner(S); await sleep(2500);
    console.log("path", await S.path(), "| has Edit pricing:", await S.evaluate(`!!(${byLabel("^Edit pricing$")})`));
    const t = (await S.text()).replace(/\s+/g, " ");
    const i = t.search(/VALUE RANGE/i); console.log("idx", i, t.slice(Math.max(0, i - 80), i + 200));
    console.log(JSON.stringify(await S.evaluate(`(() => { const e = [...document.querySelectorAll('*')].filter(x => x.children.length === 0 && /^value range$/i.test((x.textContent||'').trim())); return e.map(x => ({ tag: x.tagName, parent: (x.parentElement.innerText||'').replace(/\s+/g,' ').slice(0,100) })); })()`)));
  } catch (e) { console.log("ERR", e.message); } finally { await S.close(); process.exit(0); }
})();
