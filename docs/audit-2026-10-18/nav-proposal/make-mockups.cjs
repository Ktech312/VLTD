// Navigation proposal mockups. NOTHING IN THE APP CHANGES: the live pages are opened in a browser and their DOM is edited in memory (the six-button row removed, a Browse button and
// menu added, two rows added to the Account menu), then photographed. The result is what the arrangement would look like in the app's own styling.
//   AUDIT_MANIFEST=<manifest> node make-mockups.cjs
const path = require("path");
const fs = require("fs");
const T = require(path.join(__dirname, "..", "scripts", "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const OUT = __dirname;

// edits shared by the shots
const REMOVE_ROW_AND_ADD_BROWSE = (mobile, open) => `(() => {
  const row = document.querySelector('nav[data-local-nav]'); const sample = row && row.querySelector('a[data-local-tab]');
  const pillClass = sample ? sample.className.replace('h-11 md:h-9 px-3 text-[13px]', 'h-9 md:h-8 px-3 text-xs') : '';
  if (row) row.parentElement.remove();
  const h1 = document.querySelector('.vltd-page-band h1'); if (!h1) return 'no heading';
  const headRow = document.createElement('div'); headRow.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;position:relative';
  h1.parentElement.insertBefore(headRow, h1); headRow.appendChild(h1);
  const wrap = document.createElement('div'); wrap.style.cssText = 'position:relative'; headRow.appendChild(wrap);
  const btn = document.createElement('button'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', ${open ? "'true'" : "'false'"});
  btn.className = pillClass; btn.style.cssText = 'display:inline-flex;align-items:center;gap:6px';
  btn.innerHTML = 'Browse <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  wrap.appendChild(btn);
  if (${open ? "true" : "false"}) {
    const menu = document.createElement('div'); menu.setAttribute('role', 'menu');
    const r = btn.getBoundingClientRect(); menu.style.cssText = ${mobile ? "'position:fixed;left:16px;right:16px;top:' + (r.bottom + 8) + 'px;' + '" : "'position:absolute;left:0;top:calc(100% + 8px);width:292px;' + '"}z-index:50;background:var(--theme-nav-bg, rgba(11,19,32,0.99));border:1px solid var(--theme-nav-border, rgba(203,208,213,0.18));backdrop-filter:blur(20px);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,0.6);padding:8px';
    const items = [['Public collections', 'Explore public exhibitions and notable items', true], ['Marketplace', 'Collectibles for sale by collectors', false], ['Upcoming Comics', 'New releases by artist or series', false], ['Events', 'Conventions, card shows, auctions, drops', false]];
    for (const [label, sub, current] of items) {
      const a = document.createElement('a'); a.setAttribute('role', 'menuitem'); a.href = '#'; if (current) a.setAttribute('aria-current', 'page');
      a.style.cssText = 'display:flex;align-items:center;gap:10px;min-height:${mobile ? 48 : 40}px;border-radius:12px;padding:6px 12px;text-decoration:none;color:var(--theme-text-primary, #ECEDEF);' + (current ? 'background:rgba(203,208,213,0.10);' : '');
      a.innerHTML = '<span style="width:6px;height:6px;border-radius:99px;flex:none;background:' + (current ? '#4FD3EE' : 'transparent') + '"></span><span style="display:flex;flex-direction:column;min-width:0"><span style="font-size:14px;font-weight:' + (current ? 700 : 500) + '">' + label + '</span><span style="font-size:11px;color:var(--muted2,#61656B);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + sub + '</span></span>';
      menu.appendChild(a);
    }
    wrap.appendChild(menu);
  }
  // the header strip must sit above the page content below it, or the open menu is covered and clipped
  const band = document.querySelector('.vltd-page-band'); if (band) { band.style.zIndex = 40; band.style.overflow = 'visible'; if (band.parentElement) { band.parentElement.style.position = 'relative'; band.parentElement.style.zIndex = 40; } }
  return 'ok';
})()`;

const OPEN_ACCOUNT_AND_ADD_ROWS = `(async () => {
  document.querySelector('button[aria-label="Account menu"]').click();
  await new Promise((r) => setTimeout(r, 700));
  const settings = [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Settings' && a.getAttribute('href') === '/account');
  if (!settings) return 'no account menu';
  const mk = (label, href) => { const a = settings.cloneNode(true); a.textContent = label; a.setAttribute('href', href); return a; };
  const saved = mk('Saved', '/saved'); const watch = mk('Watchlist', '/watchlist');
  const sep = document.createElement('div'); sep.style.cssText = 'height:1px;margin:4px 8px;background:rgba(203,208,213,0.10)';
  settings.parentElement.insertBefore(saved, settings); settings.parentElement.insertBefore(watch, settings); settings.parentElement.insertBefore(sep, settings);
  return 'ok';
})()`;

const BADGE = (text) => `(() => { const b = document.createElement('div'); b.textContent = ${JSON.stringify(text)}; b.style.cssText = 'position:fixed;right:84px;bottom:98px;z-index:99999;background:#0a1a24;color:#4FD3EE;border:1px solid #4FD3EE;border-radius:8px;padding:4px 10px;font:600 11px/1.3 system-ui;pointer-events:none'; document.body.appendChild(b); return 1; })()`;

(async () => {
  let S;
  const shoot = async (name) => { await sleep(700); await S.jshot(name); };
  async function open(w, h, mobile) {
    if (S) { try { await S.close(); } catch {} }
    S = await session("owner", { width: w, height: h, mobile });
    await S.visit("/dashboard"); await sleep(800);
    await S.visit("/discover"); await sleep(2500);
  }
  // desktop: Browse menu and Account menu both open in one frame
  await open(1440, 900, false);
  await shoot("nav-before-desktop");
  console.log("browse", await S.evaluate(REMOVE_ROW_AND_ADD_BROWSE(false, true)));
  console.log("account", await S.evaluate(OPEN_ACCOUNT_AND_ADD_ROWS));
  await S.evaluate(BADGE("MOCKUP: desktop, Discover page. Nothing deployed."));
  await shoot("nav-mockup-desktop");
  // phone: two frames
  await open(390, 800, true);
  await shoot("nav-before-mobile");
  console.log("browse m", await S.evaluate(REMOVE_ROW_AND_ADD_BROWSE(true, true)));
  await S.evaluate(BADGE("MOCKUP: phone, Browse menu open"));
  await shoot("nav-mockup-mobile-browse");
  await open(390, 800, true);
  console.log("browse m2", await S.evaluate(REMOVE_ROW_AND_ADD_BROWSE(true, false)));
  console.log("account m", await S.evaluate(OPEN_ACCOUNT_AND_ADD_ROWS));
  await S.evaluate(BADGE("MOCKUP: phone, Account menu open"));
  await shoot("nav-mockup-mobile-account");
  try { await S.close(); } catch {}
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
