// node probe-deploy.cjs <path> <needle>  -> waits until the live JS for that page contains the needle (a string from the new build)
const [, , pagePath = "/vault", needle = ""] = process.argv;
const get = async (u) => (await fetch(u, { headers: { "cache-control": "no-cache" } })).text();
(async () => {
  for (let i = 0; i < 80; i++) {
    try {
      const html = await get("https://vltd.app" + pagePath + (pagePath.includes("?") ? "&" : "?") + "probe=" + Date.now());
      const chunks = [...new Set([...html.matchAll(/\/_next\/static\/[^"' ]+\.js/g)].map((m) => m[0]))];
      for (const c of chunks) { const js = await get("https://vltd.app" + c); if (js.includes(needle)) { console.log("DEPLOYED in", c, "after", i, "tries"); process.exit(0); } }
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 15000));
  }
  console.log("NOT DEPLOYED after 20 minutes"); process.exit(1);
})();
