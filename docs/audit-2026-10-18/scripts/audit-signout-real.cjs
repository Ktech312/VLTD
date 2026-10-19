// REAL sign-out of a synthetic QA session (the sign-out request is NOT intercepted: AUDIT_ALLOW_SIGNOUT=1). Does it end the session on the server and in the browser?
// Earlier sign-out rows (ACC-850, ACC-286, ACC-344) were made with the request refused by the audit and only describe the interrupted-connection case.
const { session, R, sleep, man, env } = require("./audit-lib.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const envv = require("../qa/env.cjs");
const r = R("CRW");
(async () => {
  const m = man();
  const S = await session("owner", { width: 1440, height: 900 });
  await S.visit("/dashboard");
  const saved = await S.evaluate("localStorage.getItem('vltd-auth')");
  const sess = JSON.parse(saved);
  // open the account menu and press Sign out with real mouse clicks
  const click = async (re) => {
    const pos = await S.evaluate(`(() => { const re = new RegExp(${JSON.stringify(re)}, 'i'); const e = [...document.querySelectorAll('button,a,[role=menuitem]')].find((x) => re.test((x.getAttribute('aria-label') || x.textContent || '').trim()) && x.getBoundingClientRect().width > 1); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    if (!pos) return false;
    await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pos.x, y: pos.y, button: "none" });
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 1 });
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 0 });
    return true;
  };
  const opened = await click("^Account menu$"); await sleep(1200);
  const pressed = await click("^Sign out$|^Log out$|sign out"); await sleep(6000);
  const path = await S.path();
  const lsAfter = await S.evaluate("localStorage.getItem('vltd-auth')");
  const sessionGone = !lsAfter || !JSON.parse(lsAfter || "null")?.access_token;
  const passed = S.signoutPassed || 0;
  const shot = await S.jshot("crw-signout-real-after");
  // server side: the refresh token captured before sign-out must no longer work
  const sb = createClient(envv.NEXT_PUBLIC_SUPABASE_URL, envv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const ref = await sb.auth.refreshSession({ refresh_token: sess.refresh_token });
  const revoked = !!ref.error && !ref.data.session;
  // reload the app in the same browser
  await S.visit("/dashboard"); const afterReloadPath = await S.path();
  // a clean second browser holding the OLD session (what a copied/stolen session would see)
  const T = await session("visitor", { width: 1440, height: 900 });
  await T.go("/robots.txt"); await sleep(800);
  await T.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(saved)}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(m.personalId)}); true`);
  await T.visit("/dashboard"); await sleep(6000); const oldSessionPath = await T.path(); const tshot = await T.jshot("crw-signout-real-old-session-clean-browser");
  const usable = await T.evaluate("document.body.innerText.slice(0, 400).replace(/\\s+/g, ' ')");
  await T.close(); await S.close();
  const ok1 = opened && pressed && passed >= 1 && /\/login/.test(path) && sessionGone && revoked && /\/login/.test(afterReloadPath);
  r.check(ok1, { page: "/dashboard -> Account menu -> Sign out | owner (synthetic QA session), REAL sign-out request (not intercepted)", control: "Sign out", expected: "the browser session is cleared, the server session is revoked (the old refresh token no longer works) and reopening /dashboard goes to login", actual: `menu opened: ${opened}; Sign out pressed: ${pressed}; real sign-out requests sent: ${passed}; ended at ${path}; browser session removed: ${sessionGone}; old refresh token refused by the server: ${revoked}${ref.error ? " (" + String(ref.error.message).slice(0, 50) + ")" : ""}; /dashboard afterwards ended at ${afterReloadPath}`, evidence: shot, impact: "privacy/data loss", repro: "Sign in as a QA user, open the Account menu, press Sign out, then try the old refresh token and reload /dashboard." });
  r.check(/\/login/.test(oldSessionPath), { page: "/dashboard | clean browser holding the OLD (signed-out) session", control: "reuse of a session after sign-out", expected: "the revoked session is not accepted: login page", actual: `ended at ${oldSessionPath}; page text starts: ${usable.slice(0, 120)}`, evidence: tshot, impact: "privacy/data loss", repro: "Copy the vltd-auth value before signing out, sign out, paste it into a clean browser, open /dashboard." });
  console.log(JSON.stringify({ opened, pressed, passed, path, sessionGone, revoked, afterReloadPath, oldSessionPath }));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
