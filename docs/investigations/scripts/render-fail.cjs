// Can a real render error be provoked on production by bad data in THIS browser's own saved copy (isolated browser, synthetic account)? If so, does the error page show?
process.env.CHROME_PROFILE_ROOT = "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, sleep, man } = require("./journey-lib.cjs");
const MUT = {
  "title is an object": (it) => ({ ...it, title: { a: 1 } }),
  "images_json is a number": (it) => ({ ...it, images: 5, imageFrontUrl: 7, imagesJson: 5 }),
  "price is an object": (it) => ({ ...it, purchasePrice: { x: 1 }, currentValue: [1, 2], purchase_price: {} }),
  "tags is a string / specs is a number": (it) => ({ ...it, tags: "x", specs: 5, notes: 12 }),
  "everything null": (it) => ({ id: it.id, profile_id: it.profile_id, createdAt: null, title: null, universe: null, category: null, status: null }),
};
(async () => {
  const m = man();
  for (const [name, f] of Object.entries(MUT)) {
    const S = await browser("https://vltd.app");
    try {
      await S.go("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 180000, "first"); await sleep(2500);
      await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/vault_items*", requestStage: "Request" }] });
      S.c.on(async (e) => { if (e.method === "Fetch.requestPaused") await S.send("Fetch.failRequest", { requestId: e.params.requestId, errorReason: "Failed" }).catch(() => {}); }); // keep the cloud out of it: only the saved copy is read
      await S.evaluate(`(async () => { const raw = localStorage.getItem('vltd_vault_items_v1'); let json = raw; if (raw.startsWith('z64:')) { const bin = Uint8Array.from(atob(raw.slice(4)), (c) => c.charCodeAt(0)); const ds = new DecompressionStream('deflate'); const w = ds.writable.getWriter(); w.write(bin); w.close(); json = await new Response(ds.readable).text(); } const arr = JSON.parse(json); const mut = ${f.toString()}; const out = arr.map((x, i) => i % 2 === 0 ? mut(x) : x); localStorage.setItem('vltd_vault_items_v1', JSON.stringify(out)); localStorage.removeItem('vltd_vault_items_repaired_v1'); return out.length; })()`);
      await S.go("/vault"); await sleep(9000);
      const t = (await S.text()).replace(/\s+/g, " ");
      const kind = /COULD NOT DISPLAY THIS PAGE/.test(t) ? "ERROR PAGE" : /could not load/i.test(t) ? "could-not-load" : document_has(t) ? "items" : "other";
      function document_has() { return false; }
      const items = await S.evaluate("document.querySelectorAll('a[href^=\"/vault/item/\"]').length");
      console.log(name.padEnd(40), "->", /COULD NOT DISPLAY THIS PAGE/.test(t) ? "error page shown" : items > 0 ? items + " item cards drawn" : "NOTHING DRAWN: " + t.slice(0, 120), "| record:", (await S.evaluate("JSON.parse(sessionStorage.getItem('vltd_load_diag_v1')||'[]').filter(m=>/render|error/.test(m.stage)).map(m=>m.stage+' '+(m.note||'')).join(' ; ')")).slice(0, 160));
    } catch (e) { console.log(name, "ERR", e.message.slice(0, 120)); } finally { await S.close(); }
  }
})();
