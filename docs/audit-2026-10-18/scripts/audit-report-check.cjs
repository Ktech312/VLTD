const { session, sleep, AUD } = require("./audit-lib.cjs");
(async () => {
  const S = await session("visitor", { width: 1440, height: 900 });
  await S.send("Page.navigate", { url: "file:///" + AUD.replace(/\\/g, "/") + "/report.html" }); await sleep(4000);
  const info = await S.evaluate("({ cards: document.querySelectorAll('.card').length, rc: document.querySelectorAll('#rc details').length, rows: document.querySelectorAll('#t tbody tr').length, count: document.getElementById('count').textContent, pages: document.querySelectorAll('#pt tbody tr').length, routes: document.querySelectorAll('#rt tbody tr').length, api: document.querySelectorAll('#at tbody tr').length, title: document.title })");
  console.log(JSON.stringify(info), "errors:", JSON.stringify(S.consoleErrors.slice(0, 3)));
  await S.evaluate("document.getElementById('fr').value='FAIL'; document.getElementById('fr').dispatchEvent(new Event('input')); true"); await sleep(600);
  console.log("FAIL filter:", await S.evaluate("document.getElementById('count').textContent"));
  await S.send("Page.captureScreenshot", { format: "jpeg", quality: 60 }).then((r) => require("fs").writeFileSync(AUD + "/shots/report-overview.jpg", Buffer.from(r.data, "base64")));
  await S.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
