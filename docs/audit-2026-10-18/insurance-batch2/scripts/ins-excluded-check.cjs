// "Excluded by you": exclude one fixture item on this device and check that EVERY document drops it, says why, and changes the totals the same way.
//   AUDIT_MANIFEST=<manifest> node ins-excluded-check.cjs <label>
const { session, sleep, man, fs, AUD } = require("./audit-lib.cjs");
const { spawnSync } = require("child_process");
const LABEL = process.argv[2] || "excluded";
const DIR = AUD + "/insurance-batch2/" + LABEL; fs.mkdirSync(DIR, { recursive: true });
(async () => {
  const m = man(); const st = m.stamp;
  const exId = `qa_ins_${st}_allin`; // cost $115, estimate $150
  const S = await session("owner", { width: 1440, height: 900 });
  await S.evaluate(`localStorage.setItem("vltd-theme", "deep-vault"); localStorage.setItem("vltd_insurance_excluded_item_ids_v1", ${JSON.stringify(JSON.stringify([exId]))}); true`);
  const docs = [
    { name: "inventory", path: "/insurance", wait: `document.querySelectorAll("tbody tr").length > 3` },
    { name: "packet-screen", path: "/insurance/packet", wait: `document.querySelectorAll("tbody tr").length > 3` },
    { name: "packet-print-p1", path: "/insurance/packet/print?page=0&images=0", wait: `document.querySelectorAll("tbody tr").length > 3` },
    { name: "report", path: "/reports/insurance", wait: `document.body.innerText.length > 400` },
    { name: "schedule", path: "/portfolio/insurance", wait: `document.body.innerText.length > 300` },
  ];
  const out = [];
  for (const d of docs) {
    await S.visit(d.path); await S.waitFor(d.wait, 120000, d.name).catch(() => {}); await sleep(4000);
    await S.send("Emulation.setEmulatedMedia", { media: "print" }); await sleep(500);
    const pdf = await S.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
    const p = `${DIR}/excluded-${d.name}.pdf`; fs.writeFileSync(p, Buffer.from(pdf.data, "base64"));
    const txt = spawnSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8" }).stdout || ""; fs.writeFileSync(p.replace(/\.pdf$/, ".txt"), txt);
    await S.send("Emulation.setEmulatedMedia", { media: "" });
    const rec = {
      doc: d.name,
      excludedItemAbsent: !/QA INS cost with tax shipping fees/.test(txt) || d.name === "inventory", // the inventory keeps it listed (unchecked) so it can be re-included
      excludedLine: (txt.match(/(\d+) excluded by you on this device/) || [])[0] || null,
      totalCost: (txt.match(/Total cost \(all-in\):?\s*\$([\d,]+)|Total cost \$([\d,]+)|TOTAL COST \(ALL-IN\)\s*\$([\d,]+)/i) || []).slice(1).find(Boolean) || null,
      estimate: (txt.match(/Estimated value:?\s*\$([\d,]+)|ESTIMATED VALUE\s*\$([\d,]+)/i) || []).slice(1).find(Boolean) || null,
      notCountedLine: (txt.match(/Not counted:[^\n]*/) || [])[0] || null,
    };
    out.push(rec); console.log(JSON.stringify(rec));
  }
  fs.writeFileSync(`${DIR}/excluded-summary.json`, JSON.stringify(out, null, 1));
  // leave the browser state clean
  await S.evaluate(`localStorage.removeItem("vltd_insurance_excluded_item_ids_v1"); true`);
  await S.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
