const path = require("path");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const { sleep, dismissBanner, ST } = X;
(async () => {
  const S = await X.S_("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 3", 90000, "list").catch(() => {}); await sleep(3000); await dismissBanner(S);
    const t = `QA RB10 sell ${ST}`;
    console.log("title on page:", await S.evaluate(`document.body.innerText.includes(${JSON.stringify(t)})`));
    console.log("Sell buttons:", await S.evaluate(`[...document.querySelectorAll('button')].filter((b) => /sell/i.test(b.innerText)).length`));
    console.log("button texts sample:", JSON.stringify(await S.evaluate(`[...new Set([...document.querySelectorAll('button')].map((b) => b.innerText.trim().slice(0, 20)).filter(Boolean))].slice(0, 40)`)));
    console.log("view controls:", JSON.stringify(await S.evaluate(`[...document.querySelectorAll('[aria-label],[title]')].map((e) => e.getAttribute('aria-label') || e.getAttribute('title')).filter((x) => /list|grid|view|card|compact|table/i.test(x)).slice(0, 12)`)));
    console.log("page head:", (await S.text()).replace(/\s+/g, " ").slice(0, 400));
  } catch (e) { console.log("ERR", e.message); } finally { await S.close(); process.exit(0); }
})();
