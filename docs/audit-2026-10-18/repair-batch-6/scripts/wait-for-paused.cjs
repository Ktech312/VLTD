// Waits until the live lookup route answers "paused" (the containment deploy is live). The request names no city, so even the old code made no search for it.
const deadline = Date.now() + 14 * 60_000;
(async () => {
  while (Date.now() < deadline) {
    try {
      const res = await fetch("https://vltd.app/api/events/search", { headers: { "user-agent": "Mozilla/5.0" } });
      const body = await res.text();
      if (/paused/i.test(body)) { console.log("LIVE", res.status, body); process.exit(0); }
    } catch {}
    await new Promise((r) => setTimeout(r, 20_000));
  }
  console.log("NOT LIVE in time"); process.exit(1);
})();
