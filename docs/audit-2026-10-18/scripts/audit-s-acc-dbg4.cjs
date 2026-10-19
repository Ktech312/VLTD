const A = require("./audit-s-acc-lib.cjs");
const { admin, man, R } = A; const r = R("ACC");
(async () => {
  const m = man();
  await admin.from("profiles").update({ displayed_universes: ["MUSIC"] }).eq("id", m.personalId);
  const S = await A.session("owner", { width: 1440, height: 900 });
  try {
    const out = {};
    for (const p of ["/dashboard", "/vault", "/portfolio", "/discover"]) {
      await S.visit(p); await A.sleep(3500);
      out[p] = await S.evaluate(`(() => { const t = document.body.innerText; const u = ['Pop Culture','Sports','TCG','Music'].map((k) => [k, (t.match(new RegExp(k, 'g')) || []).length]); return { universeMentions: u, chips: [...document.querySelectorAll('button,a')].map((b) => b.innerText.trim().replace(/\\s+/g,' ')).filter((x) => /^(Pop Culture|Sports|TCG|Music)/.test(x)).slice(0, 8), cards: document.querySelectorAll('a[href^="/vault/item/"]').length, ls: localStorage.getItem('vltd_visible_universe_chips') }; })()`);
      console.log(p, JSON.stringify(out[p]));
      await S.jshot("acc-dbg-universe" + p.replace(/\W/g, "_"));
    }
    r.fail({ page: "/dashboard, /vault, /portfolio, /discover | owner, Personal, 26 items", control: "Preferences > Universes displayed = Music only (saved) — effect on Home, Vault, Insights, Discover", expected: "the setting says it controls which universes appear in home, vault and discover pages: only Music should remain (or items outside Music should be hidden)", actual: JSON.stringify(out), evidence: "shots/acc-dbg-universe_vault.jpg", impact: "misleading result", repro: "Preferences: turn off Show all universes, pick Music, Save; open Home/Vault/Discover (profile.displayed_universes was set directly in the database to exclude the settings page itself)" });
  } finally { await S.close(); await admin.from("profiles").update({ displayed_universes: null }).eq("id", m.personalId); }
})();
