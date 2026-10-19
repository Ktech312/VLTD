const L = require("./audit-s-gin-lib.cjs"); const fs = require("fs");
(async () => { const S = await L.session("owner", { width: 390, height: 844, mobile: true }); try { await L.gotoGoals(S);
 await S.evaluate(`(() => { const h = [...document.querySelectorAll('main h2')].find(x=>/Active Goals/i.test(x.textContent)); h.scrollIntoView({block:'start'}); return true; })()`);
 await L.sleep(800);
 const r = await S.send("Page.captureScreenshot", { format: "jpeg", quality: 70 }); fs.writeFileSync(L.AUD + "/shots/gin-goals-phone-rows.jpg", Buffer.from(r.data, "base64"));
 } finally { await S.close(); } })();
