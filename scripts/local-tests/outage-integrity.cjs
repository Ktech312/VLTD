// Loading / outage integrity. (1) a successful but EMPTY answer still shows the normal empty state (never "could not load"); (2) a failed read never erases work that is only on this device
// (an item saved while writes were refused stays visible through an outage and reaches the account exactly once afterwards); (3) a failed read never shows another account's cached records to
// the account that is signed in now (second account, same browser, outage and normal).
const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L;
const EMPTY = /(your exhibitions are waiting|no exhibitions yet|no items|nothing here yet|your vault is empty|add your first|haven.t added|no favorites yet|no bookmarks|your halls are empty|no sales yet)/i;
const ERR = /(couldn.t load|could not load|can.t reach|couldn.t reach|try again|retry|not reach|unavailable)/i;
const norm = (t) => t.split(NL).map((x) => x.trim()).filter(Boolean).join(" | ");
(async () => {
  await sim("/__sim/reset"); const second = await L.registerSecond();
  const firstItems = (await L.dump("vault_items")).filter((r) => r.profile_id === L.P); const firstTitles = firstItems.map((r) => r.title).filter(Boolean).slice(0, 8);
  const firstExhibits = (await L.dump("galleries")).filter((g) => g.profile_id === L.P).map((g) => g.title).filter(Boolean);
  // 1. empty but reachable (second account has nothing)
  let s = await L.open({ width: 1280, height: 1000, as: second });
  try { const bad = []; for (const r of ["/vault", "/museum", "/favorites", "/vault/halls"]) { await s.go(r, 9000); await s.dismiss(); const t = norm(await s.text()); const e = EMPTY.exec(t), err = ERR.exec(t); if (!e || err) bad.push([r, e ? "empty-words ok" : "no empty state", err ? err[0] : "-", t.slice(0, 100)]); }
    check("an empty but reachable account shows the normal empty state on Vault, Exhibitions, Favorites and Halls (no 'could not load')", bad.length === 0, bad);
  } finally { await s.close(); }
  // 2. pending device-only work survives an outage and reaches the account once
  await sim("/__sim/reset"); s = await L.open({ width: 1280, height: 1500 });
  try { await s.go("/vault/add", 9000); await s.dismiss(); await s.setField("input[placeholder*='Name this item']", "OUTAGE keeper item"); await sim("/__sim/fail?write=1"); await s.mclick("Save", true); await sleep(5000);
    const savedOnDevice = !(await L.dump("vault_items")).some((r) => r.title === "OUTAGE keeper item"); check("setup: with writes refused the item is not in the account (it exists only on this device)", savedOnDevice, 0);
    await sim("/__sim/fail?write=0&rest=1"); await s.go("/vault", 12000); await s.dismiss(); let t = norm(await s.text());
    check("outage: the device-only item is still shown in the Vault (a failed read did not erase it)", t.includes("OUTAGE keeper item"), t.slice(0, 200));
    check("outage: the page says the item is on this device / not in the account yet (not silent)", /not in your account yet|saved on this device|on this device/i.test(t), t.slice(0, 200));
    await sim("/__sim/fail?rest=0"); await s.go("/vault", 9000); await sleep(25000); const rows = (await L.dump("vault_items")).filter((r) => r.title === "OUTAGE keeper item");
    check("after the account is reachable again the item reaches it exactly once (and is still shown)", rows.length === 1 && norm(await s.text()).includes("OUTAGE keeper item"), rows.length);
  } finally { await s.close(); await sim("/__sim/fail?write=0&rest=0"); }
  // 3. another account's cached records are never shown to the account signed in now
  await sim("/__sim/reset"); await L.registerSecond(); s = await L.open({ width: 1280, height: 1000 });
  try { await s.go("/vault", 12000); await s.dismiss(); const warm = norm(await s.text()); check("setup: the first account's records are cached on this device and shown", firstTitles.some((x) => warm.includes(x)), firstTitles.slice(0, 3));
    await s.go("/museum", 9000); await s.switchTo(second); await sim("/__sim/fail?rest=1");
    const leaks = []; for (const r of ["/vault", "/portfolio", "/museum", "/vault/halls", "/favorites"]) { await s.go(r, 11000); await s.dismiss(); const t = norm(await s.text()); for (const x of [...firstTitles, ...firstExhibits]) if (x && t.includes(x)) { leaks.push([r, x]); break; } }
    check("second account during an outage: none of the first account's item or exhibition names appear on Vault, Portfolio, Exhibitions, Halls or Favorites", leaks.length === 0, leaks);
    await sim("/__sim/fail?rest=0"); const leaks2 = []; for (const r of ["/vault", "/museum"]) { await s.go(r, 10000); await s.dismiss(); const t = norm(await s.text()); for (const x of [...firstTitles, ...firstExhibits]) if (x && t.includes(x)) { leaks2.push([r, x]); break; } }
    check("second account with the database reachable: still none of the first account's names", leaks2.length === 0, leaks2);
  } finally { await s.close(); await sim("/__sim/fail?rest=0"); }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
