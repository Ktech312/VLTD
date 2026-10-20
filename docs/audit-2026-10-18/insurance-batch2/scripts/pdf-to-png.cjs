// Renders pages of a generated PDF to PNG by opening it in headless Chrome's own PDF viewer (screenshot of what a reader sees).
//   node pdf-to-png.cjs <pdf> <outPrefix> [pages=1]
const { session, sleep, fs } = require("./audit-lib.cjs");
(async () => {
  const [pdf, prefix, pages] = [process.argv[2], process.argv[3], Number(process.argv[4] || 1)];
  const S = await session("visitor", { width: 1100, height: 1400 });
  for (let p = 1; p <= pages; p++) {
    await S.send("Page.navigate", { url: "file:///" + pdf.replace(/\\/g, "/") + `#page=${p}&zoom=page-fit&toolbar=0&navpanes=0` });
    await sleep(3500);
    const shot = await S.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(`${prefix}-p${p}.png`, Buffer.from(shot.data, "base64"));
  }
  await S.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
