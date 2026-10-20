// The Vault "Insurance PDF" export: drive the real dialog, capture the document the app builds, and print THAT to an actual PDF.
//   AUDIT_MANIFEST=<manifest> node ins-vault-pdf.cjs <label> [theme=deep-vault]
const { session, sleep, man, fs, AUD } = require("./audit-lib.cjs");
const { spawnSync } = require("child_process");
const LABEL = process.argv[2] || "run";
const THEME = process.argv[3] || "deep-vault";
const DIR = AUD + "/insurance-batch2/" + LABEL; fs.mkdirSync(DIR, { recursive: true });
const clickText = (t, tag = "button,[role=menuitem],a") => `(() => { const el = [...document.querySelectorAll(${JSON.stringify(tag)})].find((e) => (e.innerText || "").trim().toLowerCase().startsWith(${JSON.stringify(t.toLowerCase())})); if (!el) return "none"; el.click(); return "ok"; })()`;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  await S.evaluate(`localStorage.setItem("vltd-theme", ${JSON.stringify(THEME)}); true`);
  await S.visit("/vault");
  await S.waitFor(`[...document.querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "Tools")`, 120000, "tools").catch(() => {});
  await sleep(3000);
  const out = { label: LABEL, theme: THEME };
  out.openTools = await S.evaluate(clickText("Tools")); await sleep(600);
  out.openInsurance = await S.evaluate(clickText("Insurance PDF")); await sleep(1200);
  out.dialogText = await S.evaluate(`(document.querySelector("[data-testid=pdf-not-counted]") || {}).innerText || ""`);
  out.dialogHeader = await S.evaluate(`(() => { const d = [...document.querySelectorAll("div")].find((e) => (e.innerText || "").startsWith("Export Insurance Documentation") && e.children.length < 4); return d ? d.innerText.slice(0, 400) : ""; })()`);
  // capture the iframe document the app writes (it is removed 2 s after printing)
  await S.evaluate(`window.__pdfHtml = null; new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.tagName === "IFRAME") { const grab = () => { try { window.__pdfHtml = n.contentDocument.documentElement.outerHTML; } catch (e) {} }; setTimeout(grab, 600); setTimeout(grab, 1500); } }).observe(document.body, { childList: true }); true`);
  out.generate = await S.evaluate(clickText("Generate PDF")); await sleep(3500);
  const html = await S.evaluate(`window.__pdfHtml`);
  if (!html) { out.error = "no document captured"; console.log(JSON.stringify(out)); await S.close(); process.exit(1); }
  const htmlPath = `${DIR}/${THEME}-vault-pdf.html`; fs.writeFileSync(htmlPath, "<!DOCTYPE html>" + html);
  await S.send("Page.navigate", { url: "data:text/html;base64," + Buffer.from("<!DOCTYPE html>" + html).toString("base64") }); await sleep(2500);
  await S.send("Emulation.setEmulatedMedia", { media: "print" });
  const pdf = await S.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  const pdfPath = `${DIR}/${THEME}-vault-pdf.pdf`; fs.writeFileSync(pdfPath, Buffer.from(pdf.data, "base64"));
  const txt = spawnSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" }).stdout || "";
  fs.writeFileSync(pdfPath.replace(/\.pdf$/, ".txt"), txt);
  out.pdf = pdfPath.replace(AUD + "/", ""); out.pdfPages = (txt.match(/\f/g) || []).length; out.pdfRows = (txt.match(/QA (Album|INS|Sold)/g) || []).length;
  out.coverLines = txt.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 14);
  out.hasSold = /QA Sold/.test(txt);
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(`${DIR}/${THEME}-vault-pdf-summary.json`, JSON.stringify(out, null, 1));
  await S.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
