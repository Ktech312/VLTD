// Do the external links the app offers still lead somewhere? (HEAD, then GET on 405; 10 s timeout; read-only requests to third-party public pages)
const { AUD, fs, sleep } = require("./audit-lib.cjs");
const ext = JSON.parse(fs.readFileSync(AUD + "/links-external.json", "utf8"));
(async () => {
  const out = [];
  for (const e of ext) {
    let status = 0, note = "";
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
      let r = await fetch(e.url, { method: "HEAD", redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (VLTD link audit)" } });
      if (r.status === 405 || r.status === 501) r = await fetch(e.url, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (VLTD link audit)" } });
      clearTimeout(t); status = r.status; note = r.url !== e.url ? "-> " + r.url.slice(0, 80) : "";
    } catch (err) { status = -1; note = String(err.name || err).slice(0, 40); }
    out.push({ ...e, status, note }); await sleep(250);
  }
  fs.writeFileSync(AUD + "/links-external-status.json", JSON.stringify(out, null, 1));
  const c = {}; out.forEach((o) => { const k = o.status >= 200 && o.status < 300 ? "2xx" : o.status >= 300 && o.status < 400 ? "3xx" : o.status === -1 ? "error" : String(o.status); c[k] = (c[k] || 0) + 1; });
  console.log(c);
  out.filter((o) => o.status === 404 || o.status === 410 || o.status >= 500 || o.status === -1).forEach((o) => console.log(o.status, o.url.slice(0, 100), "|", o.labels[0], "| from", o.from[0], o.note));
})();
