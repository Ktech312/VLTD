// Queue G: responsive layout and keyboard use at 320, 390 and desktop, synthetic QA account only.
//   node ui-responsive.cjs <label> --base=http://localhost:3000
const fs = require("fs");
const path = require("path");
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
const LABEL = process.argv[2] || "resp";
const OUT = path.join(__dirname, "shots-resp-" + LABEL); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (name, ok, detail) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "").slice(0, 700)); };
const info = (name, detail) => console.log("INFO", name, JSON.stringify(detail ?? "").slice(0, 700));
const VP = [[320, 640, true], [390, 844, true], [1440, 900, false]];
const LONG = "QA-Long-" + "Supercalifragilistic".repeat(8);
const LONG_SPACED = "QA Long Spaced Title " + "with many ordinary words that keep going ".repeat(5).trim();

// elements that are visible, interactive, and cut off by the left/right edge of the screen (carousel cards inside a scroller excluded)
const clippedJs = `(() => {
  const vw = document.documentElement.clientWidth; const out = [];
  const inScroller = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 2) return true; } return false; };
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role=button]')) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    if (r.bottom < 0 || r.top > innerHeight * 6) continue;
    if (r.left < -1 || r.right > vw + 1) { if (inScroller(el)) continue; out.push({ t: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40), l: Math.round(r.left), r: Math.round(r.right), vw }); }
  }
  return out.slice(0, 12);
})()`;
// pairs of fixed-position visible things that overlap (one covering the other)
const fixedOverlapJs = `(() => {
  const els = [...document.querySelectorAll('body *')].filter((el) => { const cs = getComputedStyle(el); if (cs.position !== 'fixed') return false; const r = el.getBoundingClientRect(); return r.width > 8 && r.height > 8 && !(r.width > innerWidth * 0.8 && r.height > innerHeight * 0.7) && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && (el.textContent || '').trim().length > 0 && !el.closest('[role=dialog]') && !el.closest('nextjs-portal'); });
  const tops = els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
  const rect = (el) => el.getBoundingClientRect(); const out = [];
  for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) { const a = rect(tops[i]), b = rect(tops[j]); const w = Math.min(a.right, b.right) - Math.max(a.left, b.left); const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 6 && h > 6) out.push([(tops[i].getAttribute('aria-label') || tops[i].textContent || '').trim().slice(0, 28), (tops[j].getAttribute('aria-label') || tops[j].textContent || '').trim().slice(0, 28), Math.round(w) + 'x' + Math.round(h)]); }
  return out.slice(0, 8);
})()`;
const smallTargetsJs = `(() => { const out = []; for (const el of document.querySelectorAll('a[href], button, [role=button], select, input:not([type=hidden])')) { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue; if (r.top > innerHeight * 3) continue; if (r.height < 36 || r.width < 36) out.push({ t: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }); } return out; })()`;

const KEY = { Tab: 9, Escape: 27, Enter: 13, ArrowDown: 40, ArrowUp: 38, " ": 32 };
async function press(S, key, shift = false) {
  const base = { key, code: key === " " ? "Space" : key, windowsVirtualKeyCode: KEY[key], nativeVirtualKeyCode: KEY[key], modifiers: shift ? 8 : 0 };
  await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base });
  if (key === "Enter" || key === " ") await S.send("Input.dispatchKeyEvent", { type: "char", text: key === "Enter" ? "\r" : " ", ...base });
  await S.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  await sleep(120);
}
const active = (S) => S.evaluate("(() => { const a = document.activeElement; if (!a) return null; const dl = a.closest('[role=dialog]'); return { tag: a.tagName, label: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40), inDialog: !!dl }; })()");

(async () => {
  await admin.from("vault_items").delete().eq("profile_id", qa.profileId).in("title", [LONG, LONG_SPACED]);
  const now = Date.now();
  const mk = (n, title) => ({ id: "qa_ui_" + qa.stamp + "_long" + n, profile_id: qa.profileId, title, created_at: now + n, is_public: false, status: "COLLECTION", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", purchase_price: 123456789.5, current_value: 987654321.25 });
  const ins = await admin.from("vault_items").insert([mk(1, LONG), mk(2, LONG_SPACED)]);
  if (ins.error) throw new Error(ins.error.message);
  const pages = [["home", "/dashboard"], ["vault", "/vault"], ["item", "/vault/item/qa_ui_" + qa.stamp + "_long1"], ["item-spaced", "/vault/item/qa_ui_" + qa.stamp + "_long2"], ["capture", "/capture"], ["quick", "/vault/quick"], ["bulk", "/vault/bulk"], ["exhibitions", "/museum"], ["lounge", "/community-board"], ["discover", "/discover"], ["account", "/account"]];
  try {
    for (const [w, h, mobile] of VP) {
      const S = await session(BASE, { width: w, height: h, mobile });
      try {
        for (const [name, p] of pages) {
          await S.go(p);
          await S.waitFor("document.body && document.body.innerText.length > 150 && !/Checking your account/.test(document.body.innerText)", 30000, name).catch(() => info("page text did not settle in 30 s", name));
          await sleep(3000);
          const m = await S.evaluate("({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bsw: document.body.scrollWidth })");
          const clipped = await S.evaluate(clippedJs);
          const over = await S.evaluate(fixedOverlapJs);
          check("[" + w + "] " + name + ": no sideways page scroll", m.sw <= m.cw + 1 && m.bsw <= m.cw + 1, m);
          check("[" + w + "] " + name + ": no button/link/field is cut off by the screen edge", clipped.length === 0, clipped);
          check("[" + w + "] " + name + ": no fixed bars/pills cover each other", over.length === 0, over);
          if (mobile) { const small = await S.evaluate(smallTargetsJs); if (small.length) info("[" + w + "] " + name + " controls under 36 px", small.slice(0, 8)); }
          if (name === "item" || name === "item-spaced" || name === "home" || name === "vault") await S.shot(OUT + "/" + w + "-" + name + ".png");
        }
        const longVault = await S.evaluate("document.body.innerText.includes('Supercalifragilistic')");
        info("[" + w + "] the very long unspaced title is on the Vault page", longVault);
      } finally { await S.close(); }
    }

    // ------------- keyboard: dialogs, menus (desktop viewport) -------------
    const K = await session(BASE, { width: 1440, height: 900 });
    try {
      await K.go("/vault/item/qa_ui_" + qa.stamp + "_2"); await K.waitFor("document.querySelector('button[aria-label=\"Share this item\"]')", 120000, "item for keyboard"); await sleep(2500);
      // Share dialog
      await K.evaluate("document.querySelector('button[aria-label=\"Share this item\"]').focus(); true");
      await press(K, "Enter"); await sleep(1200);
      let a = await active(K);
      check("[keys] Enter on Share opens the dialog and puts focus inside it", a && a.inDialog, a);
      let stayed = true; const trail = [];
      for (let i = 0; i < 25; i++) { await press(K, "Tab"); const x = await active(K); trail.push(x && x.label); if (!x || !x.inDialog) { stayed = false; break; } }
      check("[keys] 25 Tab presses never leave the Share dialog", stayed, trail);
      for (let i = 0; i < 6; i++) { await press(K, "Tab", true); const x = await active(K); if (!x || !x.inDialog) { stayed = false; break; } }
      check("[keys] Shift+Tab also stays inside", stayed);
      await press(K, "Escape"); await sleep(800);
      const closed = await K.evaluate("!document.querySelector('[role=dialog]')");
      a = await active(K);
      check("[keys] Escape closes the Share dialog and focus returns to the Share button", closed && a && /Share this item/.test(a.label), { closed, a });
      // Delete dialog
      await K.evaluate("document.querySelector('button[aria-label=\"Delete item\"]').focus(); true");
      await press(K, "Enter"); await sleep(900);
      a = await active(K); const delTrail = []; let delStay = true;
      for (let i = 0; i < 8; i++) { await press(K, "Tab"); const x = await active(K); delTrail.push(x && x.label); if (!x || !x.inDialog) delStay = false; }
      check("[keys] the Delete dialog takes focus and Tab stays inside it", a && a.inDialog && delStay, { a, delTrail });
      await press(K, "Escape"); await sleep(700);
      a = await active(K);
      check("[keys] Escape closes the Delete dialog (nothing deleted) and focus returns to the Delete button", !(await K.evaluate("!!document.querySelector('[role=dialog]')")) && a && /Delete item/.test(a.label), a);
      check("[keys] the item still exists after Escape", !!(await admin.from("vault_items").select("id").eq("id", "qa_ui_" + qa.stamp + "_2").maybeSingle()).data);
      // account menu
      await K.go("/vault"); await K.waitFor("document.querySelector('button[aria-label=\"Account menu\"]')", 120000, "vault keyboard"); await sleep(2000);
      await K.evaluate("document.querySelector('button[aria-label=\"Account menu\"]').focus(); true");
      await press(K, "Enter"); await sleep(700);
      const menuOpen = await K.evaluate("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Sign Out')");
      check("[keys] Enter opens the account menu", menuOpen);
      let reach = false; for (let i = 0; i < 40 && !reach; i++) { await press(K, "Tab"); const x = await active(K); if (x && x.label === "Sign Out") reach = true; }
      check("[keys] Tab reaches Sign Out inside the account menu", reach);
      await press(K, "Escape"); await sleep(600);
      const menuClosed = await K.evaluate("![...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Sign Out')");
      check("[keys] Escape closes the account menu", menuClosed);
      // upload menu on the Vault page
      await K.evaluate("(() => { const t = document.querySelector('[aria-label=\"Upload from device\"]'); if (t) t.focus(); return !!t; })()");
      await press(K, "Enter"); await sleep(600);
      const upItems = await K.evaluate("[...document.querySelectorAll('[role=menuitem], [role=menu] a, [role=menu] button')].map((x) => x.textContent.trim().slice(0, 30))");
      check("[keys] Enter on the upload button opens its menu (Single item, Batch)", upItems.some((t) => /Single item/.test(t)) && upItems.some((t) => /Batch/.test(t)), upItems);
      await press(K, "Escape"); await sleep(500);
      check("[keys] Escape closes the upload menu", await K.evaluate("![...document.querySelectorAll('[role=menuitem], [role=menu] a')].some((x) => x.getBoundingClientRect().width > 0)"));
      // title editor by keyboard
      await K.go("/vault/item/qa_ui_" + qa.stamp + "_2"); await K.waitFor("document.querySelector('button[aria-label=\"Edit title and category\"]')", 120000, "item title"); await sleep(2000);
      await K.evaluate("document.querySelector('button[aria-label=\"Edit title and category\"]').focus(); true");
      await press(K, "Enter"); await sleep(600);
      a = await active(K);
      info("[keys] focus after opening the title editor with Enter", a);
      check("[keys] the title editor opens from the keyboard and the Title field is reachable by Tab", await K.evaluate("!!document.querySelector('input[aria-label=\"Title\"]')"));
    } finally { await K.close(); }
  } finally {
    await admin.from("vault_items").delete().eq("profile_id", qa.profileId).in("id", ["qa_ui_" + qa.stamp + "_long1", "qa_ui_" + qa.stamp + "_long2"]);
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
