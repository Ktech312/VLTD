// Waits until the live site serves the batch-4 build (looks for the new money message in the /vault/add JS chunks).
const NEEDLE = "spaces inside|period for cents";
const get = async (u) => (await fetch(u, { headers: { "cache-control": "no-cache" } })).text();
(async () => {
  for (let i = 0; i < 80; i++) {
    try {
      const html = await get("https://vltd.app/vault/add?probe=" + Date.now());
      const chunks = [...new Set([...html.matchAll(/\/_next\/static\/[^"' ]+\.js/g)].map((m) => m[0]))];
      for (const c of chunks) { const js = await get("https://vltd.app" + c); if (js.includes(NEEDLE)) { console.log("DEPLOYED in", c, "after", i, "tries"); process.exit(0); } }
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 15000));
  }
  console.log("NOT DEPLOYED after 20 minutes"); process.exit(1);
})();
