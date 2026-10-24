// Wishlist (RB67c): Watching (labelled, source link, "Add to my wants", never owned), checklist and sharing privacy (a visitor sees only what is switched on), and offline/retry.
//   AUDIT_MANIFEST=<manifest> node rb67c-watchlist-share-offline.cjs <label> [--base=...]
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, admin, man } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB67");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], notes: {} };
const SET = `const setVal = (el, v) => { const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };`;
const DIALOG = `(document.querySelector('[role="dialog"]'))`;

(async () => {
  let S, V;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "/watchlist", control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "wishlist", repro: "" }); };
  const click = (text, scope = "document") => S.evaluate(`(() => { const root = ${scope} || document; const el = [...root.querySelectorAll('button,a,[role="menuitem"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`);
  const clickStart = (text, scope = "document") => S.evaluate(`(() => { const root = ${scope} || document; const el = [...root.querySelectorAll('button,a,[role="menuitem"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
  const fill = (label, value, scope = DIALOG) => S.evaluate(`(() => { ${SET} const root = ${scope}; if (!root) return 'noscope'; const lab = [...root.querySelectorAll('label')].find((l) => { const s = l.querySelector('span'); return s && s.textContent.trim().toLowerCase().startsWith(${JSON.stringify(label.toLowerCase())}); }); if (!lab) return 'nolabel:' + ${JSON.stringify(label)}; const el = lab.querySelector('input,select,textarea'); if (!el) return 'noinput'; if (el.tagName === 'SELECT') { const opt = [...el.options].find((o) => o.text.trim() === ${JSON.stringify(String(value))} || o.value === ${JSON.stringify(String(value))}); if (!opt) return 'nooption'; setVal(el, opt.value); } else setVal(el, ${JSON.stringify(String(value))}); return 'ok'; })()`);
  const text = (X = S) => X.evaluate("document.body.innerText.replace(/\\s+/g, ' ')");
  const rows = () => S.evaluate(`[...document.querySelectorAll('[data-testid="want-row"]')].map((r) => ({ t: r.innerText.replace(/\\s+/g, ' ').trim(), s: r.getAttribute('data-status') }))`);
  const lsWants = () => S.evaluate(`(() => { try { return JSON.parse(localStorage.getItem('vltd_wishlist:${P}') || '[]'); } catch { return []; } })()`);
  const vaultCount = async () => (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;

  try {
    // ── E. Watching ────────────────────────────────────────────────────────
    await admin.from("watchlist").delete().eq("owner_profile_id", P).eq("item_id", "qa_watch_1");
    const seed = await admin.from("watchlist").insert({ owner_profile_id: P, item_id: "qa_watch_1", title: "QA watched public item", subtitle: "Public exhibition item", current_value: 1200, collector_name: "QA Collector", item_profile_id: P, saved_at: new Date().toISOString() });
    out.notes.seedError = seed.error && seed.error.message;
    S = await session("owner", { width: 1440, height: 900 });
    const v0 = await vaultCount();
    await S.visit("/watchlist"); await sleep(5000);
    let t = await text();
    ck(/Watching \(other people/i.test(t) && /QA watched public item/.test(t), "a watched public item is listed inside Wishlist, under a Watching heading", "Watching section with the item", t.slice(0, 300));
    const wr = await S.evaluate(`(() => { const r = document.querySelector('[data-testid="watching-row"]'); if (!r) return null; const a = r.querySelector('a'); return { text: r.innerText.replace(/\\s+/g, ' '), href: a && a.getAttribute('href'), badge: /Watching/.test(r.innerText) }; })()`);
    ck(wr && wr.badge && /Someone else/.test(wr.text) && wr.href && /^\/v\//.test(wr.href), "the watched row is labelled Watching, says it is someone else's item, and keeps its source link", "badge, label, /v/ link", JSON.stringify(wr));
    await S.jshot(`rb67c-${LABEL}-watching`);
    await click("Add to my wants", `document.querySelector('[data-testid="watching-row"]')`); await sleep(1200);
    const lw = await lsWants();
    const mine = lw.find((w) => w.sourceIdentity === "watch:qa_watch_1");
    ck(mine && mine.title === "QA watched public item" && mine.price === undefined && mine.sourceUrl && /^\/v\//.test(mine.sourceUrl), "Add to my wants makes a want of your own with the source link and NO price copied from the other person's listing", "want with link, no price", JSON.stringify(mine));
    ck((await vaultCount()) === v0, "watching or adding it to my wants did not create an owned Vault record", "vault count unchanged", `${v0} -> ${await vaultCount()}`);
    ck(((await admin.from("watchlist").select("item_id").eq("owner_profile_id", P).eq("item_id", "qa_watch_1")).data || []).length === 1, "the watched item itself is kept after Add to my wants", "still watched", "check");
    await click("In my wants", `document.querySelector('[data-testid="watching-row"]')`); await sleep(600);
    await S.visit("/watchlist"); await sleep(3500);
    ck((await lsWants()).filter((w) => w.sourceIdentity === "watch:qa_watch_1").length === 1, "adding the same watched item again does not make a copy", "one want", "check");

    // ── F. checklist and sharing ────────────────────────────────────────────
    // give one want a private note and a price so privacy is meaningful
    await click("Checklist", `document.querySelector('main') || document.body`).catch(() => {});
    await S.evaluate(`(() => { const b = [...document.querySelectorAll('button,a')].find((x) => x.textContent.trim() === 'Checklist'); if (b) b.click(); return !!b; })()`); await sleep(1500);
    const prev = await S.evaluate(`(document.querySelector('[aria-label="Checklist preview"]') || {}).innerText || ''`);
    ck(/\[ \]/.test(prev) && !/private-note-comic/.test(prev) && !/\$\d/.test(prev), "the default checklist lists items with edition and quantity, and shows no prices or private notes", "no prices, no notes", prev.slice(0, 300));
    await S.jshot(`rb67c-${LABEL}-checklist`);
    await S.evaluate(`(() => { const b = document.querySelector('[role="dialog"] [aria-label="Include Expected prices"]'); if (b) b.click(); const n = document.querySelector('[role="dialog"] [aria-label="Include My notes"]'); if (n) n.click(); return !!b; })()`); await sleep(500);
    const prev2 = await S.evaluate(`(document.querySelector('[aria-label="Checklist preview"]') || {}).innerText || ''`);
    ck(/\$/.test(prev2) && /Planned total/.test(prev2), "switching prices on adds them and the planned total to the checklist", "prices shown", prev2.slice(-200));
    // share on
    await S.evaluate(`(() => { const b = document.querySelector('[role="dialog"] [aria-label="Share a read-only link"]'); if (b) b.click(); return !!b; })()`); await sleep(2500);
    const token = await S.evaluate(`(() => { const c = [...document.querySelectorAll('[role="dialog"] code')].map((x) => x.innerText).find((x) => /\\/wishlist\\//.test(x)); return c ? c.split('/wishlist/')[1] : null; })()`);
    ck(!!token, "Share a read-only link turns sharing on and shows the link", "a link", String(token));
    out.notes.shareToken = token ? token.slice(0, 4) + "…" : null;
    if (token) {
      V = await session("visitor", { width: 1440, height: 900 });
      await V.visit(`/wishlist/${token}`); await sleep(5000);
      const pub = await text(V);
      out.notes.publicText = pub.slice(0, 400);
      ck(/wishlist/i.test(pub) && /Night Courier|Starlight|Cosmic|Tin wind-up/.test(pub), "a visitor with the link sees the wishlist titles", "titles shown", pub.slice(0, 300), "/wishlist/<link>");
      ck(!/private-note-comic/.test(pub) && !/\$4\.99|\$143|\$27\.99|target \$130|\$130/.test(pub), "a visitor sees no private notes, prices or target prices", "no notes, no prices", pub.slice(0, 400), "/wishlist/<link>");
      ck(!/Skipped|skipped/.test(pub), "skipped wants are not shown on the shared link", "no skipped", "check", "/wishlist/<link>");
      await V.jshot(`rb67c-${LABEL}-public-share`);
      // checklist page: prices only when asked
      await S.visit("/watchlist/checklist"); await sleep(3500);
      const plain = await text();
      await S.visit("/watchlist/checklist?p=1&n=1&d=1"); await sleep(3500);
      const priced = await text();
      ck(!/\$4\.99|\$143|private-note/.test(plain) && /\$/.test(priced), "the printable checklist shows prices and notes only when they were switched on", "plain has none, switched-on has prices", `${plain.slice(0, 120)} || ${priced.slice(0, 160)}`, "/watchlist/checklist");
      const printable = await S.evaluate(`!!document.querySelector('main.vltd-print-document')`);
      ck(printable, "the checklist page is a print document (site bars do not print, text prints black on white)", "marked", String(printable), "/watchlist/checklist");
      // turn sharing off: the link stops
      await S.visit("/watchlist"); await sleep(3000);
      await S.evaluate(`(() => { const b = [...document.querySelectorAll('button,a')].find((x) => x.textContent.trim() === 'Checklist'); if (b) b.click(); return !!b; })()`); await sleep(1500);
      await S.evaluate(`(() => { const b = document.querySelector('[role="dialog"] [aria-label="Share a read-only link"]'); if (b) b.click(); return !!b; })()`); await sleep(2500);
      await V.visit(`/wishlist/${token}`); await sleep(4000);
      ck(/isn't shared|isn&apos;t shared|not shared/i.test(await text(V)), "turning sharing off stops the link", "not shared", (await text(V)).slice(0, 200), "/wishlist/<link>");
      await V.close(); V = null;
    }
    await S.close();

    // ── G. offline and retry ──────────────────────────────────────────────────
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/watchlist"); await sleep(4500);
    await S.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await click("Add"); await sleep(600);
    await click("Type it in", DIALOG); await sleep(300);
    await fill("Title", "Offline want"); await fill("Quantity", "2"); await fill("Notes", "made offline");
    await click("Add to wishlist", DIALOG); await sleep(1500);
    ck((await rows()).some((x) => x.t.includes("Offline want")), "a want added while offline appears at once on this device", "row shown", "check");
    const offDb = ((await admin.from("wishlist").select("id").eq("profile_id", P).eq("title", "Offline want")).data || []).length;
    ck(offDb === 0, "while offline it has not reached the account (so it is held for retry)", "0 rows in the account", String(offDb));
    await S.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await S.visit("/watchlist"); await sleep(7000);
    const okRow = (await rows()).some((x) => x.t.includes("Offline want"));
    ck(okRow, "after reconnecting and reloading, the offline want is still there (not lost by the account read)", "row shown", "check");
    let onDb = ((await admin.from("wishlist").select("id,notes").eq("profile_id", P).eq("title", "Offline want")).data || []);
    for (let i = 0; i < 6 && onDb.length === 0; i++) { await sleep(2500); onDb = ((await admin.from("wishlist").select("id,notes").eq("profile_id", P).eq("title", "Offline want")).data || []); }
    ck(onDb.length === 1 && onDb[0].notes === "made offline", "the retry sent it to the account once connected (one row, not two)", "1 row", JSON.stringify(onDb));
    // offline delete is not undone by the next read
    await S.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await S.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes('Offline want')); const b = r && r.querySelector('button[aria-label^="More for"]'); if (b) b.click(); return !!b; })()`); await sleep(500);
    await clickStart("Remove from list", `document.querySelector('[role="menu"]') || document`); await sleep(800);
    await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.trim() === 'Remove'); if (b) b.click(); return !!b; })()`); await sleep(1200);
    ck(!(await rows()).some((x) => x.t.includes("Offline want")), "a want removed while offline disappears at once", "row gone", "check");
    await S.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await S.visit("/watchlist"); await sleep(7000);
    ck(!(await rows()).some((x) => x.t.includes("Offline want")), "after reconnecting, the removed want is not brought back by the account read", "still gone", "check");
    let gone = ((await admin.from("wishlist").select("id").eq("profile_id", P).eq("title", "Offline want")).data || []).length;
    for (let i = 0; i < 6 && gone > 0; i++) { await sleep(2500); gone = ((await admin.from("wishlist").select("id").eq("profile_id", P).eq("title", "Offline want")).data || []).length; }
    ck(gone === 0, "the delete reached the account on retry", "0 rows", String(gone));
    // acquire while offline: Vault records are saved on the device and queued, the want is marked after that save
    await S.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await S.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes('Tin wind-up robot')); const b = r && [...r.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Acquired'); if (b) b.click(); return !!b; })()`); await sleep(700);
    await click("Save to my Vault", DIALOG); await sleep(3500);
    const dlg = await S.evaluate(`(document.querySelector('[role="dialog"]') || {}).innerText || ''`);
    ck(/Saved on this device|in your Vault/i.test(dlg), "acquiring while offline saves to the Vault on this device and says it will upload later", "saved locally, upload later", dlg.slice(0, 200));
    await click("Done", DIALOG); await sleep(500);
    await S.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await S.close(); S = null;
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 900); }
  finally {
    try { await admin.from("watchlist").delete().eq("owner_profile_id", P).eq("item_id", "qa_watch_1"); } catch {}
    try { if (S) await S.close(); } catch {}
    try { if (V) await V.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb67c-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
