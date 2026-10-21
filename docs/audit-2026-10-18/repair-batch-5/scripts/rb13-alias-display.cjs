// RC-05 family: does a public page still show the real collector for an exhibition that uses an alias? PRODUCTION, QA content only.
//   AUDIT_MANIFEST=<manifest> node rb13-alias-display.cjs <label> <before|after>
// Seeds: a synthetic public profile row for the fixture profile ("QA Real Collector Name"), one PUBLIC alias exhibition and one PUBLIC
// plain exhibition (high view counts so Discover lists them first). Removed at the end.
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const L = require(path.join(SD, "audit-lib.cjs"));
const { sleep, admin, P, ST } = X;
const LABEL = process.argv[2] || "run";
const PHASE = process.argv[3] || "before";
const AFTER = PHASE === "after";
const r = L.R("RB13");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, phase: PHASE, cases: [] };
const REAL = "QA Real Collector Name", ALIAS = "QA Alias Curator";
let S, n = 0;
async function rec(ok, control, expected, actual, page) {
  let shot = ""; try { await sleep(300); shot = path.join(L.AUD, await S.jshot(`rb13-${LABEL}-${PHASE}-${++n}`)); } catch {}
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: shot });
  if (AFTER) r.check(!!ok, { page: `${page} | signed-out visitor, desktop 1440`, control, expected, actual, evidence: shot ? path.relative(L.AUD, shot).replace(/\\/g, "/") : "", impact: "RC-05", repro: "" });
  else console.log(ok ? "OK-NOW " : "FAILS  ", control, "|", String(actual).slice(0, 300));
}
const cardText = (title) => S.evaluate(`(() => { const e = [...document.querySelectorAll('*')].find((x) => x.children.length === 0 && (x.textContent || '').trim() === ${JSON.stringify(title)}); let c = e; for (let i = 0; i < 8 && c; i++) { c = c.parentElement; if (c && /\\bby\\b/.test(c.innerText || '') && (c.innerText || '').length < 600) return c.innerText.replace(/\\s+/g, ' '); } return e ? 'title found, no "by" line near it' : ''; })()`);

(async () => {
  const ids = [];
  let hadPublic = null, hadProfileFlags = null;
  try {
    // the fixture's own public items, so the public profile page has something to list the exhibitions under
    const items = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("is_public", true).like("id", "qa_vz_%").limit(5)).data.map((x) => x.id);
    hadPublic = (await admin.from("public_profiles").select("*").eq("profile_id", P).maybeSingle()).data;
    hadProfileFlags = (await admin.from("profiles").select("is_public,onboarding_completed").eq("id", P).maybeSingle()).data;
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", P);
    await admin.from("public_profiles").upsert({ profile_id: P, display_name: REAL, bio: "synthetic QA profile" });
    const mk = (k, extra) => { const id = require("crypto").randomUUID(); ids.push(id); const sec = { id: "s" + k, title: "Exhibit 1", description: "", itemIds: items, slotLayout: [...items, null] }; return { id, profile_id: P, title: `QA RB13 ${k} ${ST}`, description: "synthetic", visibility: "PUBLIC", state: "ACTIVE", cover_image: "/collectibles/comic-slab.png", layout: { itemIds: items, themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [sec] }, exhibition_layout: { itemIds: items, sections: [sec] }, public_token: `qarb13${ST}${k}`, analytics_views: 9999000, alias_enabled: false, ...extra }; };
    const aliasRow = mk("alias", { alias_enabled: true, alias_name: ALIAS }), plainRow = mk("plain", {});
    const ins = await admin.from("galleries").insert([aliasRow, plainRow]); if (ins.error) throw new Error("seed: " + ins.error.message);
    S = await X.S_("visitor", { width: 1440, height: 900 });
    // ---------- Discover
    await S.visit("/discover"); await S.waitFor(`document.body.innerText.includes('QA RB13')`, 60000, "discover").catch(() => {}); await sleep(3000);
    const aliasCard = await cardText(`QA RB13 alias ${ST}`), plainCard = await cardText(`QA RB13 plain ${ST}`);
    await rec(aliasCard && aliasCard.includes(ALIAS) && !aliasCard.includes(REAL), "Discover: the curator line of an exhibition that uses an alias", `shows the alias "${ALIAS}", never the real collector "${REAL}"`, `alias exhibition card: ${aliasCard.slice(0, 200)}`, "/discover");
    await rec(plainCard && plainCard.includes(REAL), "Discover: an exhibition WITHOUT an alias still shows the real collector (nothing else changed)", `shows "${REAL}"`, `plain exhibition card: ${plainCard.slice(0, 200)}`, "/discover");
    // ---------- the collector's public profile page
    await S.visit(`/v/${P}`); await S.waitFor(`document.body.innerText.includes('${REAL}')`, 60000, "profile page").catch(() => {}); await sleep(4000);
    const pageText = (await S.text()).replace(/\s+/g, " ");
    await rec(pageText.includes(`QA RB13 plain ${ST}`) && !pageText.includes(`QA RB13 alias ${ST}`), "Real collector's public profile page: the exhibition list", "lists the exhibition without an alias and does NOT list the one that uses an alias (that would link it to the real name)", `page loaded for the real name=${pageText.includes(REAL)}; plain listed=${pageText.includes(`QA RB13 plain ${ST}`)}; alias exhibition listed=${pageText.includes(`QA RB13 alias ${ST}`)}`, "/v/[profileId]");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (ids.length) await admin.from("galleries").delete().in("id", ids); } catch {}
    try { if (hadPublic) await admin.from("public_profiles").upsert(hadPublic); else await admin.from("public_profiles").delete().eq("profile_id", P); } catch {}
    try { if (hadProfileFlags) await admin.from("profiles").update(hadProfileFlags).eq("id", P); } catch {}
    fs.writeFileSync(path.join(EV, `rb13-alias-${LABEL}-${PHASE}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    try { await S.close(); } catch {}
    process.exit(0);
  }
})();
