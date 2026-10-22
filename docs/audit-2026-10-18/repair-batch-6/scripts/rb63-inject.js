// Injected into the page before anything else by rb63-final-evening-expiry.cjs: moves the page's clock to the instant in sessionStorage.__rb63_now and tops up the events answers with the rows in sessionStorage.__rb63_rows (browser only).
(() => {
  try {
    const fake = Number(sessionStorage.getItem('__rb63_now') || 0); window.__rb63probe = 'seen:' + fake; if (!fake) return;
    const RD = Date; const t0 = RD.now(); const nowFake = () => fake + (RD.now() - t0);
    class FD extends RD { constructor(...a) { if (a.length === 0) super(nowFake()); else super(...a); } static now() { return nowFake(); } }
    window.Date = FD;
    // the stored sign-in says when it expires; seen from the moved clock it would look expired and the app would sign out, so its expiry is pushed far out (the token itself is untouched)
    try { for (const k of Object.keys(localStorage)) if (/^sb-.*-auth-token$/.test(k)) { const v = JSON.parse(localStorage.getItem(k)); if (v && v.expires_at) { v.expires_at = 4102444800; localStorage.setItem(k, JSON.stringify(v)); } } } catch (e) {}
    const extra = JSON.parse(sessionStorage.getItem('__rb63_rows') || '[]'); const of = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const res = await of(...args); const u = String((args[0] && args[0].url) || args[0]);
      if (!/\/rest\/v1\/collector_events/.test(u) || !res.ok || ((args[1] && args[1].method) || 'GET') !== 'GET') return res;
      const m = u.match(/offset=(\d+)/); if (m && Number(m[1]) > 0) return res;
      try { const rows = await res.clone().json(); if (!Array.isArray(rows)) return res; const have = new Set(rows.map((x) => x.id)); const add = extra.filter((x) => !have.has(x.id));
        return new Response(JSON.stringify(rows.concat(add)), { status: 200, headers: { 'content-type': 'application/json' } }); } catch (e) { return res; }
    };
  } catch (e) {}
})();
