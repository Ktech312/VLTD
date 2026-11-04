// node itemclick.cjs <visitor|viewer> <caseKey> : open the shared link, click the first item, report what opens
const L = require("./shr-lib.cjs");
(async () => {
  const [kind, key] = process.argv.slice(2);
  const c = JSON.parse(L.fs.readFileSync(L.EVID + "/cases.json", "utf8"))[key];
  const S = await L.session(kind, { height: 1200 });
  try {
    await S.visit("/museum/share/" + c.link.split("/").pop());
    await S.mclick(`[...document.querySelectorAll('div,button,a,article')].filter(e => (e.textContent||'').trim().startsWith('QA Album 1') && e.getBoundingClientRect().height > 100).sort((a,b)=>a.textContent.length-b.textContent.length)[0]`, 3500);
    console.log("path:", await S.path());
    const t = (await S.text()).replace(/\s+/g, " ");
    console.log("after click:", t.slice(0, 700));
    await S.shotTo(`itemclick-${kind}-${key}`);
    console.log("net:", S.net.filter((r) => !/seasonal|favorite|record_exhibition/.test(r.url)).map((r) => r.status + " " + r.url.slice(0, 120)).join("\n"));
  } finally { await S.close(); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
