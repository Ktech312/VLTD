// Background polling: hidden/visible transitions, duplicate timers after in-app navigation, recovery after an outage, and what the exhibition page's refresh actually updates.
// Counts requests to the simulated database: unread messages (conversations), presence (touch_presence), exhibitions (galleries). Takes about 5 minutes.
//   node scripts/local-tests/polling-transitions.cjs
const L = require("./lib.cjs"); const { sleep, check, sim, seed, P } = L;
const GID = "00000000-0000-4000-8000-0000000099aa";
const gal = (title) => ({ id: GID, profile_id: P, title, visibility: "LOCKED", state: "ACTIVE", public_token: "pub_sim_poll", layout: { itemIds: [], publicItemSnapshots: [] }, exhibition_layout: { itemIds: [], publicItemSnapshots: [] }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
function counter(s) { const c = { unread: 0, presence: 0, galleries: 0, all: 0, marks: [] }; s.c.on((m) => { if (m.method !== "Network.requestWillBeSent") return; try { const u = new URL(m.params.request.url); if (u.origin !== "http://localhost:54321" || m.params.request.method === "OPTIONS") return; c.all++; if (/\/rest\/v1\/conversations$/.test(u.pathname)) c.unread++; else if (/touch_presence/.test(u.pathname)) c.presence++; else if (/\/rest\/v1\/galleries$/.test(u.pathname)) c.galleries++; } catch { /* ignore */ } }); c.reset = () => { c.unread = 0; c.presence = 0; c.galleries = 0; c.all = 0; }; return c; }
const setVis = (s, v) => s.evaluate(`(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "${v}" }); Object.defineProperty(document, "hidden", { configurable: true, get: () => ${v === "hidden"} }); document.dispatchEvent(new Event("visibilitychange")); return true; })()`);
(async () => {
  await sim("/__sim/reset"); await seed({ galleries: [gal("Poll test exhibition")] });
  // 1. duplicate timers after navigating around inside the app and coming back
  let s = await L.open({ width: 1280, height: 900 });
  try { await s.go("/dashboard", 7000); await s.dismiss(); const c = counter(s);
    for (const label of ["Vault", "Exhibitions", "Insights", "Vault", "Exhibitions"]) { await s.mclick(label, true); await sleep(2500); }
    await s.mclick("Home", true); await sleep(3000); c.reset(); await sleep(66000);
    console.log("after 5 in-app navigations, 66 s visible: unread reads", c.unread, "| presence beats", c.presence, "| exhibition reads", c.galleries);
    check("no duplicate timers after in-app navigation: unread count read <= 3 times and presence <= 2 times in 66 s (one 30 s and one 60 s timer)", c.unread <= 3 && c.presence <= 2, { unread: c.unread, presence: c.presence });
    // 2. hidden, then visible again
    await setVis(s, "hidden"); await sleep(500); c.reset(); await sleep(70000);
    check("hidden for 70 s: no unread reads, no presence beats, no exhibition reads", c.unread === 0 && c.presence === 0 && c.galleries === 0 && c.all === 0, { unread: c.unread, presence: c.presence, all: c.all });
    c.reset(); await setVis(s, "visible"); await sleep(4000);
    check("shown again: one look at the unread count and one presence beat (not a burst)", c.unread >= 1 && c.unread <= 2 && c.presence <= 2 && c.all <= 12, { unread: c.unread, presence: c.presence, all: c.all });
    c.reset(); await sleep(35000);
    check("after being shown again the normal 30 s rhythm resumes (1-2 unread reads in 35 s, not more)", c.unread >= 1 && c.unread <= 2, { unread: c.unread });
  } finally { await s.close(); }
  // 3. reconnect: an outage on the sync page, then recovery
  await sim("/__sim/reset"); await seed({ galleries: [gal("Poll test exhibition")] });
  s = await L.open({ width: 1280, height: 900 });
  try { await s.go("/vault/sync", 8000); await s.dismiss(); const c = counter(s); await sim("/__sim/fail?rest=1"); await s.evaluate(`window.dispatchEvent(new Event("offline")); true`); await sleep(20000);
    await sim("/__sim/fail?rest=0"); await s.evaluate(`window.dispatchEvent(new Event("online")); true`); await sleep(6000); c.reset(); await sleep(35000);
    check("reconnect: after the connection returns the page is back to its normal pace (<= 6 requests in 35 s on the sync page)", c.all <= 6, { all: c.all });
  } finally { await s.close(); await sim("/__sim/fail?rest=0"); }
  // 4. the exhibition page's refresh: what it updates, how often, and that it stops when hidden / left
  await sim("/__sim/reset"); await seed({ galleries: [gal("Poll test exhibition")] });
  s = await L.open({ width: 1280, height: 900 });
  try { await s.go("/museum/" + GID, 9000); await s.dismiss(); const c = counter(s); c.reset(); await sleep(46000);
    console.log("exhibition page, visible, 46 s: exhibition reads", c.galleries, "| all requests", c.all);
    check("exhibition page visible: it re-reads the account's exhibitions about every 15 s (2-5 reads in 46 s) - recorded for the owner's decision", c.galleries >= 2 && c.galleries <= 5, { galleries: c.galleries, all: c.all });
    // what it updates: a change made elsewhere (another device or a team member) appears without a reload
    await seed({ galleries: [gal("Poll test exhibition CHANGED ELSEWHERE")] }); let seen = false; for (let i = 0; i < 24 && !seen; i++) { await sleep(1000); seen = /CHANGED ELSEWHERE/.test(await s.text()); }
    check("what the refresh is for: a title changed on another device shows on this open page within about 20 s, without a reload", seen, (await s.text()).slice(0, 120));
    await setVis(s, "hidden"); await sleep(500); c.reset(); await sleep(36000); check("exhibition page hidden: no reads", c.all === 0, { all: c.all });
    await setVis(s, "visible"); await sleep(1000); const afterShow = c.galleries; check("exhibition page shown again: refreshes at once (at least one read)", afterShow >= 1, { afterShow });
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
