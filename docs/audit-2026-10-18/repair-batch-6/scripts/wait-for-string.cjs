// Waits until the live site serves a script chunk of the given page that contains the given text (a deploy has gone live).
//   node wait-for-string.cjs <path> "<text>" [maxMinutes]
const [, , pagePath, needle, mins] = process.argv;
const deadline = Date.now() + (Number(mins) || 12) * 60_000;
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };
(async () => {
  while (Date.now() < deadline) {
    try {
      const html = await (await fetch(`https://vltd.app${pagePath}`, { headers: UA })).text();
      const chunks = [...new Set([...html.matchAll(/\/_next\/static\/[^"')\s]+\.js/g)].map((m) => m[0]))];
      for (const c of chunks) {
        const body = await (await fetch(`https://vltd.app${c}`, { headers: UA })).text();
        if (body.includes(needle)) { console.log("LIVE", c); process.exit(0); }
      }
    } catch (e) { /* try again */ }
    await new Promise((r) => setTimeout(r, 20_000));
  }
  console.log("NOT LIVE within the time limit");
  process.exit(1);
})();
