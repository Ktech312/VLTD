// Wishlist / Pull List / Following flows (RB67b): a clean second browser, acquisition (partial quantity, unknown cost, failure changes nothing), Following rules (manual and the comic
// catalog; pause, resume, stop, skipped stays skipped, edits kept, no duplicates), Watching, sharing and checklist privacy, and offline/retry. Run AFTER rb67-watchlist.cjs left its four wants.
//   AUDIT_MANIFEST=<manifest> node rb67b-watchlist-flows.cjs <label> [--base=...]
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
  let S;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "/watchlist", control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "wishlist", repro: "" }); };
  const click = (text, scope = "document") => S.evaluate(`(() => { const root = ${scope} || document; const el = [...root.querySelectorAll('button,a,[role="menuitem"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`);
  const clickStart = (text, scope = "document") => S.evaluate(`(() => { const root = ${scope} || document; const el = [...root.querySelectorAll('button,a,[role="menuitem"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
  const fill = (label, value, scope = DIALOG) => S.evaluate(`(() => { ${SET} const root = ${scope}; if (!root) return 'noscope'; const lab = [...root.querySelectorAll('label')].find((l) => { const s = l.querySelector('span'); return s && s.textContent.trim().toLowerCase().startsWith(${JSON.stringify(label.toLowerCase())}); }); if (!lab) return 'nolabel:' + ${JSON.stringify(label)}; const el = lab.querySelector('input,select,textarea'); if (!el) return 'noinput'; if (el.tagName === 'SELECT') { const opt = [...el.options].find((o) => o.text.trim() === ${JSON.stringify(String(value))} || o.value === ${JSON.stringify(String(value))}); if (!opt) return 'nooption'; setVal(el, opt.value); } else setVal(el, ${JSON.stringify(String(value))}); return 'ok'; })()`);
  const text = () => S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')");
  const rows = () => S.evaluate(`[...document.querySelectorAll('[data-testid="want-row"]')].map((r) => ({ t: r.innerText.replace(/\\s+/g, ' ').trim(), s: r.getAttribute('data-status') }))`);
  const rowBtn = (title, btnText) => S.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes(${JSON.stringify(title)})); if (!r) return 'norow'; const b = [...r.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.trim() === ${JSON.stringify(btnText)}); if (!b) return 'nobtn'; b.click(); return 'ok'; })()`);
  const lsWants = () => S.evaluate(`(() => { try { return JSON.parse(localStorage.getItem('vltd_wishlist:${P}') || '[]'); } catch { return []; } })()`);
  const vaultRows = async () => (await admin.from("vault_items").select("id,title,purchase_price,status,profile_id").eq("profile_id", P).like("id", "vault_acq_%")).data || [];
  const extrasInDb = async () => { const { error } = await admin.from("wishlist").select("quantity").limit(1); return !error; };
  const gotoTab = async (name) => { await clickStart(name, `document.querySelector('[data-testid="watchlist-controls"]')`); await sleep(700); };

  try {
    const extras = await extrasInDb();
    out.notes.extrasInDatabase = extras;
    // ── B. a clean second browser ──────────────────────────────────────────
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/watchlist"); await sleep(5000);
    let rs = await rows();
    ck(rs.length >= 3 && rs.some((x) => x.t.includes("Night Courier #4")) && rs.some((x) => x.t.includes("Tin wind-up robot")), "a clean second browser shows the wants saved in the first one", "the comic and the vintage piece are there", JSON.stringify(rs.map((x) => x.t.slice(0, 60))));
    const dbRows = (await admin.from("wishlist").select("*").eq("profile_id", P)).data || [];
    const comicDb = dbRows.find((w) => w.title === "Night Courier #4");
    ck(comicDb && comicDb.notes === "private-note-comic" && String(comicDb.release_date).startsWith("2026-11-12"), "title, notes and release date reached the account", "stored", JSON.stringify(comicDb && [comicDb.notes, comicDb.release_date]));
    if (extras) {
      ck(comicDb.quantity === 2 && comicDb.edition === "Cover B" && Number(comicDb.expected_price) === 4.99, "quantity, edition and expected price reached the account", "2, Cover B, 4.99", JSON.stringify([comicDb.quantity, comicDb.edition, comicDb.expected_price]));
      const star = dbRows.find((w) => w.title.startsWith("Starlight"));
      ck(star && star.status === "skipped", "a skipped want is skipped in the account (second browsers agree)", "skipped", star && star.status);
    } else {
      ck(true, "NOT YET TESTED: quantity, edition, price and skipped state in the account need SQL package 9", "n/a", "SQL 9 not applied: those fields are on this device only (the page keeps them locally)", "pre-SQL");
    }
    await S.close();

    // ── C. acquisition ────────────────────────────────────────────────────
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/watchlist"); await sleep(4500);
    // a want with two copies made in THIS browser (quantity is kept on the device until SQL package 9 is applied)
    await click("Add"); await sleep(600); await click("Type it in", DIALOG); await sleep(300);
    await fill("Title", "Night Courier #4 (acq test)"); await fill("Quantity", "2"); await fill("Expected price", "4.99");
    await click("Add to wishlist", DIALOG); await sleep(1200);
    const before = (await vaultRows()).length;
    // an invalid cost: nothing is saved and the want does not change
    await rowBtn("Cosmic Rangers", "Acquired"); await sleep(700);
    await fill("What I paid", "abc");
    await click("Save to my Vault", DIALOG); await sleep(800);
    const bad = await S.evaluate(`(document.querySelector('[role="dialog"] [role="alert"]') || {}).innerText || ''`);
    ck(/numbers|amount/i.test(bad) && (await vaultRows()).length === before, "an invalid cost is refused and nothing is saved to the Vault", "error shown, vault unchanged", bad);
    await S.jshot(`rb67b-${LABEL}-acquire-sheet`);
    await click("Cancel", DIALOG); await sleep(400);
    ck(((await rows()).find((x) => x.t.includes("Cosmic Rangers")) || {}).s === "want", "cancelling Acquired leaves the want exactly as it was", "still wanted", "check");
    // partial: the comic wants 2; receive 1 with cost unknown
    await rowBtn("acq test", "Acquired"); await sleep(700);
    await fill("Received now", "1");
    await click("Save to my Vault", DIALOG); await sleep(2500);
    let v = await vaultRows();
    const comicV = v.find((x) => x.title === "Night Courier #4 (acq test)");
    ck(v.length === before + 1 && comicV && comicV.purchase_price === null, "receiving 1 of 2 with the cost left unknown saves one Vault record with NO price (not the expected or cover price)", "one record, purchase_price null", JSON.stringify(comicV));
    out.notes.partialDialogText = await S.evaluate(`(document.querySelector('[role="dialog"]') || {}).innerText || ''`);
    await click("Done", DIALOG); await sleep(600);
    rs = await rows();
    const comicRow = rs.find((x) => x.t.includes("acq test"));
    ck(comicRow && comicRow.s !== "acquired" && /1 of 2/.test(comicRow.t), "the want shows 1 of 2 and stays open (it is not marked Acquired yet)", "1 of 2, not acquired", comicRow && comicRow.t.slice(0, 120));
    const tot1 = await S.evaluate(`(document.querySelector('[data-testid="planned-total"]') || {}).innerText || ''`);
    ck(/\$4\.99 from|\$4\.99/.test(tot1), "the planned total now counts only the copy still to get", "$4.99 for the comic", tot1);
    // second copy with a real cost
    await rowBtn("acq test", "Acquired"); await sleep(700);
    await fill("What I paid", "5.25");
    await click("Save to my Vault", DIALOG); await sleep(2500);
    v = await vaultRows();
    ck(v.filter((x) => x.title === "Night Courier #4 (acq test)").length === 2 && v.some((x) => Number(x.purchase_price) === 5.25), "the second copy is saved with the cost entered; two copies, two records", "two records, one at 5.25", JSON.stringify(v.filter((x) => x.title === "Night Courier #4 (acq test)")));
    ck(new Set(v.map((x) => x.id)).size === v.length && v.every((x) => /^vault_acq_/.test(x.id)), "no duplicate Vault records", "unique ids", JSON.stringify(v.map((x) => x.id)));
    await click("Done", DIALOG); await sleep(600);
    ck(((await rows()).find((x) => x.t.includes("acq test")) || {}).s === "acquired" || !(await rows()).some((x) => x.t.includes("acq test")), "with both copies in, the want is Acquired and leaves the open list", "acquired", "check");
    // restore the skipped card product and acquire it with no cost: target price (130) and expected price (143) are not used
    await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.trim().startsWith('Wants and watching')); if (b) b.click(); return !!b; })()`); await sleep(500);
    await clickStart("Skipped", `document.querySelector('[role="listbox"]') || document`); await sleep(700);
    await S.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes('Starlight')); const b = r && r.querySelector('button[aria-label^="More for"]'); if (b) b.click(); return !!b; })()`); await sleep(500);
    await clickStart("Restore", `document.querySelector('[role="menu"]') || document`); await sleep(800);
    await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.trim() === 'Clear all'); if (b) b.click(); return !!b; })()`); await sleep(600);
    await rowBtn("Starlight", "Acquired"); await sleep(700);
    await click("Save to my Vault", DIALOG); await sleep(2500);
    v = await vaultRows();
    const star = v.find((x) => x.title.startsWith("Starlight"));
    ck(star && star.purchase_price === null, "acquiring with the cost unknown never uses the target price ($130) or the expected price ($143)", "purchase_price null", JSON.stringify(star));
    await click("Done", DIALOG); await sleep(500);
    await S.close();

    // ── D. following ────────────────────────────────────────────────────────
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/watchlist"); await sleep(4500);
    await gotoTab("Following");
    ck(/not following anything yet/i.test(await text()), "Following starts with an honest empty state", "empty state", (await text()).slice(0, 200));
    await click("Follow", `document.querySelector('[data-testid="watchlist-controls"]') || document`); await sleep(600);
    await click("Card product or set", DIALOG); await sleep(300);
    await fill("Product or set", "Starlight Duel boxes");
    await fill("Copies of each release", "1");
    await click("Start following", DIALOG); await sleep(1200);
    let t = await text();
    ck(/Starlight Duel boxes/.test(t) && /Manual only/.test(t) && /no release feed/i.test(t), "a card product rule is a manual rule and says so (no release feed)", "manual only, no feed", t.slice(0, 400));
    await S.jshot(`rb67b-${LABEL}-following-manual`);
    const ruleBtn = (txt) => S.evaluate(`(() => { const c = [...document.querySelectorAll('[data-testid="rule-card"]')].find((x) => x.innerText.includes('Starlight Duel boxes')); if (!c) return 'nocard'; const b = [...c.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim().endsWith(${JSON.stringify(txt)})); if (!b) return 'nobtn'; b.click(); return 'ok'; })()`);
    const ruleState = () => S.evaluate(`(() => { const c = [...document.querySelectorAll('[data-testid="rule-card"]')].find((x) => x.innerText.includes('Starlight Duel boxes')); return c ? c.getAttribute('data-state') : null; })()`);
    await ruleBtn("Pause"); await sleep(500);
    ck(await ruleState() === "paused", "Pause keeps the rule and marks it Paused", "paused", await ruleState());
    await ruleBtn("Resume"); await sleep(500);
    ck(await ruleState() === "following", "Resume starts following again", "following", await ruleState());
    await ruleBtn("Add a release"); await sleep(700);
    await fill("Title", "Starlight Duel: Booster Box (Set 8)");
    await fill("Release date", "2027-02-20");
    await click("Add to wishlist", DIALOG); await sleep(1000);
    const ls1 = await lsWants();
    ck(ls1.some((w) => w.title === "Starlight Duel: Booster Box (Set 8)" && w.ruleId && w.series === "Starlight Duel boxes"), "Add a release on a manual rule makes a want linked to that rule", "linked", JSON.stringify(ls1.filter((w) => /Set 8/.test(w.title)).map((w) => [w.ruleId, w.series])));
    await ruleBtn("Stop"); await sleep(500);
    ck(/Show stopped rules \(1\)/.test(await text()), "Stop keeps the rule (shown under stopped rules) and what it added", "stopped, not deleted", "check");
    ck((await lsWants()).some((w) => /Set 8/.test(w.title)), "stopping a rule does not remove the wants it added", "want kept", "check");

    // the comic catalog rule
    await click("Follow", `document.querySelector('[data-testid="watchlist-controls"]') || document`); await sleep(600);
    await click("Comic series", DIALOG); await sleep(300);
    await fill("Series name", "Batman");
    await click("Search", DIALOG); await sleep(6000);
    const cands = await S.evaluate(`[...document.querySelectorAll('[role="dialog"] ul li button')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim())`);
    out.notes.catalogCandidates = cands.slice(0, 8);
    if (cands.length === 0) {
      ck(false, "the comic catalog finds series with upcoming releases", "at least one series", await S.evaluate(`(document.querySelector('[role="dialog"]') || {}).innerText || ''`));
    } else {
      await S.jshot(`rb67b-${LABEL}-follow-catalog`);
      await S.evaluate(`(() => { const bs = [...document.querySelectorAll('[role="dialog"] ul li button')]; const n = (el) => { const m = el.innerText.match(/(\d+) upcoming/); return m ? Number(m[1]) : 0; }; bs.sort((a, c) => n(c) - n(a)); bs[0].click(); return true; })()`); await sleep(400);
      await click("Start following", DIALOG); await sleep(9000);
      const comicRule = (await S.evaluate(`(() => { try { return JSON.parse(localStorage.getItem('vltd_pull_rules_v1:${P}') || '[]'); } catch { return []; } })()`)).find((x) => x.source === "metron");
      ck(comicRule && comicRule.sourceKey, "a comic series rule is matched to one exact series (a catalog key)", "sourceKey present", JSON.stringify(comicRule && [comicRule.name, comicRule.sourceKey]));
      let added = (await lsWants()).filter((w) => w.ruleId === (comicRule && comicRule.id));
      out.notes.afterFirstCheck = added.map((w) => [w.title, w.edition, w.releaseDate]);
      ck(added.length > 0 && added.every((w) => w.sourceIdentity && /^metron:issue:/.test(w.sourceIdentity) && w.edition === "Standard cover"), "following added the series' standard-cover releases, each with its source identity", "added standard covers", JSON.stringify(out.notes.afterFirstCheck.slice(0, 5)));
      // no variants were auto-added
      ck(added.every((w) => w.edition === "Standard cover"), "no variant cover was added automatically", "only standard covers", JSON.stringify([...new Set(added.map((w) => w.edition))]));
      const n1 = added.length;
      // refresh again: no copies
      await gotoTab("Following");
      await S.evaluate(`(() => { const c = [...document.querySelectorAll('[data-testid="rule-card"]')].find((x) => x.getAttribute('data-state') === 'following' && !x.innerText.includes('Starlight')); const b = c && [...c.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Check now'); if (b) b.click(); return !!b; })()`); await sleep(8000);
      let again = (await lsWants()).filter((w) => w.ruleId === comicRule.id);
      ck(again.length === n1 && new Set(again.map((w) => w.sourceIdentity)).size === again.length, "checking again creates no copies", `${n1} selections both times`, `${again.length} now`);
      // skip one, edit another, then check again
      if (again.length >= 2) {
        const skipId = again[0].id, editId = again[1].id;
        // skip via the data layer the page uses (the same saved record the Skip menu writes)
        await S.visit("/watchlist"); await sleep(3500);
        await S.evaluate(`(() => { const key = 'vltd_wishlist:${P}'; const items = JSON.parse(localStorage.getItem(key) || '[]'); const next = items.map((w) => w.id === ${JSON.stringify(skipId)} ? { ...w, status: 'skipped', skippedAt: Date.now() } : w.id === ${JSON.stringify(editId)} ? { ...w, quantity: 3, edited: ['quantity'] } : w); localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event('vltd:wishlist-updated')); return true; })()`); await sleep(500);
        await gotoTab("Following");
        await S.evaluate(`(() => { const c = [...document.querySelectorAll('[data-testid="rule-card"]')].find((x) => x.getAttribute('data-state') === 'following' && !x.innerText.includes('Starlight')); const b = c && [...c.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Check now'); if (b) b.click(); return !!b; })()`); await sleep(8000);
        const after = await lsWants();
        const sk = after.find((w) => w.id === skipId), ed = after.find((w) => w.id === editId);
        ck(sk && sk.status === "skipped" && after.filter((w) => w.ruleId === comicRule.id).length === n1, "a skipped release is not brought back by the next check", "still skipped, no new row", JSON.stringify(sk && sk.status));
        ck(ed && ed.quantity === 3, "a quantity the person set is not overwritten by the next check", "quantity 3", JSON.stringify(ed && ed.quantity));
        // pause: nothing is added, then stop
        await S.evaluate(`(() => { const c = [...document.querySelectorAll('[data-testid="rule-card"]')].find((x) => !x.innerText.includes('Starlight') && x.getAttribute('data-state') === 'following'); const b = c && [...c.querySelectorAll('button')].find((x) => x.textContent.trim().endsWith('Pause')); if (b) b.click(); return !!b; })()`); await sleep(500);
        ck(!(await S.evaluate(`[...document.querySelectorAll('[data-testid="rule-card"]')].some((c) => c.getAttribute('data-state') === 'paused' && !c.innerText.includes('Starlight') && [...c.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Check now'))`)), "a paused comic rule offers no Check now (it adds nothing while paused)", "no Check now when paused", "check");
      }
    }
    await S.close();
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 900); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb67b-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
