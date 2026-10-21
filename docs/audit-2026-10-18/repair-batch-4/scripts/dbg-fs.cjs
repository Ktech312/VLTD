const path = require("path");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const { sleep, dismissBanner, mclick } = X;
const titles = (S) => S.evaluate("[...document.querySelectorAll('article')].map(a=>a.innerText.slice(0,24).replace(/\\s+/g,' '))");
(async () => {
  const S = await X.S_("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/for-sale"); await sleep(5000); await dismissBanner(S);
    console.log("start", JSON.stringify(await titles(S)));
    for (const [title, ans] of [["QA RB9 FS sold abc", ["abc", "eBay"]], ["QA RB9 FS sold neg", ["-50", "eBay"]]]) {
      await S.evaluate(`(() => { window.__pq = ${JSON.stringify(ans)}; window.prompt = () => window.__pq.shift(); return true; })()`);
      await mclick(S, `[...[...document.querySelectorAll('article')].find(a=>a.innerText.includes(${JSON.stringify(title)})).querySelectorAll('button')].find(b=>/^Mark sold$/.test(b.innerText.trim()))`);
      for (const ms of [500, 2500, 6000]) { await sleep(ms); console.log(title, ms, JSON.stringify(await titles(S))); }
    }
  } catch (e) { console.log("ERR", e.message); } finally { await S.close(); process.exit(0); }
})();
