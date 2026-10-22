// "Universes displayed" removal on PRODUCTION (RB60): an owner whose profile (and device) still carries an old Universes displayed setting must see the FULL collection
// and totals on Home, the Vault and Insights, with no notice and no Show menu; items are narrowed only by a visible page filter (the Vault chips) and Clear all brings
// everything back; the old device copy is cleared; the Account page no longer offers the setting; nothing is deleted or recategorised. Isolated QA owner.
//   AUDIT_MANIFEST=<manifest> node rb60-universes-removed.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, admin, man } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB60");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], samples: {} };
const OLD_KEY = "vltd_visible_universe_chips";

const HOME = `(() => { const s = document.querySelector('section[aria-label="Collection overview"]'); return s ? s.innerText.replace(/\\s+/g, ' ').trim().slice(0, 700) : null; })()`;
const VAULT_TOP = `(() => { const t = document.body.innerText.replace(/\\s+/g, ' '); const m = t.match(/([\\d,]+) (?:items?|results?)/i); return { count: m ? m[1] : null, head: t.slice(0, 500) }; })()`;
const INSIGHTS = `(() => { const t = (document.querySelector('main') || document.body).innerText.replace(/\\s+/g, ' ').trim(); return t.slice(0, 900); })()`;
const FLAGS = `({ notice: !!document.querySelector('[data-testid="displayed-universes-notice"]'), allHidden: !!document.querySelector('[data-testid="vault-all-hidden"]'), noticeText: /Universes displayed/i.test(document.body.innerText), showMenu: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Show'), oldKey: localStorage.getItem(${JSON.stringify(OLD_KEY)}) })`;

(async () => {
  let S;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page, control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "collection totals", repro: "" }); };
  async function setDisplayed(val) { const { error } = await admin.from("profiles").update({ displayed_universes: val }).eq("id", P); if (error) throw new Error("set displayed_universes: " + error.message); }
  async function snapshot(tag) {
    const o = {};
    await S.visit("/"); await sleep(3500); o.home = await S.evaluate(HOME); o.homeFlags = await S.evaluate(FLAGS);
    await S.visit("/vault"); await sleep(3500); o.vault = await S.evaluate(VAULT_TOP); o.vaultFlags = await S.evaluate(FLAGS);
    await S.visit("/portfolio"); await sleep(3500); o.insights = await S.evaluate(INSIGHTS); o.insightsFlags = await S.evaluate(FLAGS);
    out.samples[tag] = o; return o;
  }
  try {
    const before = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    S = await session("owner", { width: 1440, height: 900 });
    // A. nothing set: the full picture
    await setDisplayed(null);
    await S.visit("/"); await S.evaluate(`localStorage.removeItem(${JSON.stringify(OLD_KEY)}); true`);
    const full = await snapshot("full");
    // B. an old setting on the account AND on the device
    await setDisplayed(["POP_CULTURE"]);
    await S.visit("/"); await S.evaluate(`localStorage.setItem(${JSON.stringify(OLD_KEY)}, JSON.stringify(["POP_CULTURE"])); true`);
    const old = await snapshot("oldSetting");
    const same = (a, b) => a === b;
    ck(same(full.home, old.home) && !!full.home, "Home totals are the same with an old Universes displayed setting", "identical collection overview", `full: ${full.home}\nold: ${old.home}`, "/");
    ck(same(full.vault.count, old.vault.count) && !!full.vault.count, "Vault shows the full count with an old setting", "same count", `full=${full.vault.count} old=${old.vault.count}`, "/vault");
    ck(same(full.insights, old.insights) && !!full.insights, "Insights totals are the same with an old setting", "identical figures", `full: ${full.insights.slice(0, 300)}\nold: ${old.insights.slice(0, 300)}`, "/portfolio");
    ck(!old.homeFlags.notice && !old.vaultFlags.notice && !old.insightsFlags.notice && !old.vaultFlags.allHidden, "no 'hiding items' notice or all-hidden page anywhere", "no notice", JSON.stringify([old.homeFlags, old.vaultFlags, old.insightsFlags].map((f) => [f.notice, f.allHidden])), "/, /vault, /portfolio");
    ck(!old.vaultFlags.showMenu && !old.vaultFlags.noticeText, "the Vault has no Universes displayed 'Show' menu", "no Show menu, no 'Universes displayed' text", JSON.stringify(old.vaultFlags), "/vault");
    ck(old.vaultFlags.oldKey === null, "the old device copy is cleared", "key removed", String(old.vaultFlags.oldKey), "/vault");
    // C. explicit page filter, then Clear all
    await S.visit("/vault"); await sleep(3500);
    const chips = await S.evaluate(`(() => { const row = [...document.querySelectorAll('button')].filter((b) => b.className && /min-h-11/.test(b.className) && b.textContent.trim() && b.textContent.trim() !== "All" && b.textContent.trim() !== "Show"); return row.slice(0, 6).map((b) => b.textContent.trim()); })()`);
    out.samples.chips = chips;
    let filtered = null, cleared = null, clearedOk = false;
    const picked = chips.find((c) => c);
    if (picked) {
      await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(picked)}); b && b.click(); return true; })()`); await sleep(1500);
      filtered = await S.evaluate(VAULT_TOP);
      const hasClear = await S.evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Clear all')`);
      await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Clear all'); b && b.click(); return true; })()`); await sleep(1500);
      cleared = await S.evaluate(VAULT_TOP); clearedOk = hasClear && cleared.count === full.vault.count;
      out.samples.explicit = { picked, filtered: filtered.count, cleared: cleared.count, hasClear };
    }
    ck(!!picked && filtered && Number((filtered.count || "0").replace(/,/g, "")) < Number((full.vault.count || "0").replace(/,/g, "")) && clearedOk, "a visible page filter narrows the list and Clear all brings everything back", "chip narrows; Clear all returns the full count", JSON.stringify(out.samples.explicit || { chips }), "/vault");
    // D. Account: the setting is gone, interests remain
    await S.visit("/account?section=preferences"); await sleep(3000);
    const prefsText = await S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')");
    ck(!/Universes displayed|Show all universes/i.test(prefsText), "Account > Preferences no longer offers Universes displayed", "no such setting", prefsText.slice(0, 300), "/account?section=preferences");
    await S.visit("/account?section=profile"); await sleep(3000);
    const profText = await S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')");
    ck(/Collection interests|What do you collect|interests/i.test(profText), "collection interests are still on the profile", "interests control present", profText.slice(0, 300), "/account?section=profile");
    // E. nothing deleted or recategorised
    const after = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    ck(before === after, "no item was deleted", "same row count", `before=${before} after=${after}`, "database");
    out.itemCount = after;
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 800); }
  finally {
    try { await setDisplayed(null); } catch {}
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb60-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
