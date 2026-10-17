// Deployed-site check at 320 and 390 px: install prompt, floating Add row, bottom navigation, bug-report button and the sync status
// pill shown TOGETHER (the pill is made real by editing offline, then moving to the Vault by the bottom bar).
//   node live-phone.cjs <label> --base=https://vltd.app
const fs = require("fs");
const path = require("path");
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const LABEL = process.argv[2] || "live-phone";
const OUT = path.join(__dirname, "shots-" + LABEL); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 600)); };
const ID = (n) => `qa_ui_${qa.stamp}_${n}`;
const rects = `(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; };
  const pill = [...document.querySelectorAll('div')].find((d) => /Add to Home Screen/.test(d.textContent) && getComputedStyle(d).position === 'fixed' && d.textContent.length < 40);
  const sync = document.querySelector('[data-cloud-save-status]');
  const syncBox = sync && (sync.firstElementChild || sync);
  const add = document.querySelector('[data-mobile-add-item]');
  const nav = document.querySelector('nav[aria-label="Main navigation"]');
  const bug = document.querySelector('button[aria-label="Report a bug"]');
  const o = (a, b) => a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  const P = r(pill), S = r(syncBox), A = r(add), N = r(nav), B = r(bug);
  return { vw: innerWidth, hScroll: document.documentElement.scrollWidth > innerWidth + 1, pill: P, sync: S, add: A, nav: N, bug: B, syncText: sync ? sync.innerText : null,
    over: { 'prompt/add': o(P, A), 'prompt/nav': o(P, N), 'prompt/sync': o(P, S), 'prompt/bug': o(P, B), 'sync/add': o(S, A), 'sync/nav': o(S, N), 'sync/bug': o(S, B), 'add/bug': o(A, B), 'add/nav': o(A, N) } };
})()`;
(async () => {
  const target = ID(8);
  const orig = (await admin.from("vault_items").select("title").eq("id", target).maybeSingle()).data.title;
  for (const [w, h] of [[390, 844], [320, 640]]) {
    const S = await session(BASE, { width: w, height: h, mobile: true });
    try {
      await S.go("/vault/item/" + target);
      await S.waitFor("document.querySelector('button[aria-label=\"Edit title and category\"]')", 90000, "item page"); await sleep(2500);
      const commit = await S.evaluate("(document.querySelector('meta[name=vltd-commit]') || {}).content || ''");
      console.log(`[${w}] deployed commit seen by the page: ${commit.slice(0, 7)}`);
      await S.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
      await S.evaluate("document.querySelector('button[aria-label=\"Edit title and category\"]').click(); true"); await sleep(600);
      await S.evaluate("(() => { const i = document.querySelector('input[aria-label=\"Title\"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'QA Filler 8 phone'); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('button[aria-label=\"Save title and classification\"]').click(); return true; })()"); await sleep(2500);
      // move to the Vault with the bottom bar (no reload, so the pending status stays)
      await S.evaluate("(() => { const a = [...document.querySelectorAll('nav[aria-label=\"Main navigation\"] a')].find((x) => x.getAttribute('href') === '/vault'); a.click(); return !!a; })()");
      await S.waitFor("location.pathname === '/vault' && document.querySelector('[data-mobile-add-item]')", 60000, "vault with add row"); await sleep(2500);
      await S.evaluate("window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) })); true"); await sleep(1000);
      const m = JSON.parse(JSON.stringify(await S.evaluate(rects)));
      await S.shot(OUT + `/${w}-vault-all-floating.png`);
      console.log(`[${w}] measured:`, JSON.stringify({ pill: m.pill, sync: m.sync, add: m.add, nav: m.nav, bug: m.bug }));
      check(`[${w}] all five floating things are on screen together (install prompt, sync status, Add row, bottom bar, bug button)`, !!(m.pill && m.sync && m.add && m.nav && m.bug), { pill: !!m.pill, sync: !!m.sync, add: !!m.add, nav: !!m.nav, bug: !!m.bug });
      check(`[${w}] the sync status says it is saved on the device and not in the account yet`, /Saved on this device/.test(m.syncText || ""), m.syncText);
      const bad = Object.entries(m.over).filter(([, v]) => v).map(([k]) => k);
      check(`[${w}] none of them overlaps another`, bad.length === 0, bad);
      check(`[${w}] no sideways scroll`, m.hScroll === false);
      // dismissing the prompt removes only the prompt
      await S.evaluate("document.querySelector('button[aria-label=\"Dismiss\"]').click(); true"); await sleep(600);
      const m2 = JSON.parse(JSON.stringify(await S.evaluate(rects)));
      check(`[${w}] dismissing the prompt removes it and leaves the others where they were`, !m2.pill && JSON.stringify(m2.add) === JSON.stringify(m.add) && JSON.stringify(m2.nav) === JSON.stringify(m.nav), { add: [m.add, m2.add] });
      // the page can scroll to its end and the bottom bar stays usable
      await S.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await S.evaluate("window.dispatchEvent(new Event('online')); true");
      await sleep(8000);
    } finally { await S.close(); }
    await admin.from("vault_items").update({ title: orig }).eq("id", target);
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
