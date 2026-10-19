// is the new code live? looks for a string from it in the page's JavaScript files
(async () => {
  const needle = process.argv[2];
  const html = await (await fetch("https://vltd.app" + (process.argv[3] || "/vault/sold") + "", { cache: "no-store" })).text();
  const urls = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9_.\-]+\.js/g)].map((m) => m[0]))];
  for (const u of urls) { const t = await (await fetch("https://vltd.app" + u, { cache: "no-store" })).text(); if (t.includes(needle)) { console.log("DEPLOYED in", u); return; } }
  console.log("old (" + urls.length + " files)");
})().catch((e) => console.log("err " + e.message));
