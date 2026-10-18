// Login through the real form. LOCAL ONLY for typing credentials (localhost dev build of this commit, talking to the real project with disposable QA
// accounts); the production checks below use an injected session and type nothing.
//   node login2.cjs --local=http://localhost:3000 [--prod=https://vltd.app]
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const arg = (n, d) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "--" + n + "=" + d).split("=").slice(1).join("=");
const LOCAL = arg("local", "http://localhost:3000"); const PROD = arg("prod", "https://vltd.app");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 600));
const type = (S, sel, v) => S.setVal(sel, v);
const logIn = async (S, email, password) => {
  await type(S, "input[type=email]", email); await type(S, "input[type=password]", password);
  await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Log in'); b.click(); return true; })()");
};
const hasSession = (S) => S.evaluate("(() => { try { const a = JSON.parse(localStorage.getItem('vltd-auth') || 'null'); return !!(a && a.access_token); } catch { return false; } })()");
const signOut = async (S) => {
  await S.waitFor("document.querySelector('button[aria-label=\"Account menu\"]')", 60000, "account menu"); await S.clickSel('button[aria-label="Account menu"]'); await sleep(700);
  await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Sign Out'); b.click(); return true; })()");
  await S.waitFor("location.pathname === '/login'", 60000, "login after sign out"); await sleep(1500);
};

(async () => {
  const m = man();
  const ctrl = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId).eq("title", "QA Owned Control")).data[0];
  // ===================== LOCAL: the real login form =====================
  const S = await browser(LOCAL, { withSession: false });
  try {
    info("LOCAL build served at", LOCAL);
    await S.go("/login"); await S.waitFor("document.querySelector('input[type=email]')", 90000, "login form"); await sleep(1200);
    await logIn(S, m.email, "wrong-password-" + Date.now()); await sleep(5000);
    const bad = await S.evaluate("({ path: location.pathname, alert: [...document.querySelectorAll('[role=alert]')].map((a) => a.textContent.trim()).join(' | '), text: document.body.innerText.split('\\n').join(' | ').slice(0, 300) })");
    check("[local login] a wrong password is refused: stays on the login page with a plain message", bad.path === "/login" && (bad.alert.length > 0 || /invalid|incorrect|wrong|didn.t match|not match/i.test(bad.text)), bad);
    info("wrong-password message", bad.alert || bad.text);
    check("[local login] a wrong password leaves no session behind", (await hasSession(S)) === false);
    await type(S, "input[type=password]", m.password);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Log in'); b.click(); return true; })()");
    await S.waitFor("location.pathname !== '/login'", 60000, "left login"); await sleep(3000);
    await S.waitFor("/QA Journey Personal/.test(document.body.innerText)", 90000, "Home after login");
    check("[local login] the correct password signs in and lands on Home as that account", (await S.path()).startsWith("/dashboard") && (await hasSession(S)), await S.path());
    await S.evaluate("location.reload(); true"); await S.waitFor("/QA Journey Personal/.test(document.body.innerText)", 90000, "Home after refresh"); await sleep(1500);
    check("[local login] a refresh keeps you signed in", (await S.path()).startsWith("/dashboard") && (await hasSession(S)));
    await S.go("/vault"); await S.waitFor("/TOTAL VALUE/.test(document.body.innerText)", 90000, "Vault"); await sleep(1500);
    await signOut(S);
    check("[local login] Sign Out leads to the login page and clears the session", (await S.path()).startsWith("/login") && (await hasSession(S)) === false);
    await S.evaluate("history.back(); true"); await sleep(5000);
    const afterBack = await S.evaluate("({ path: location.pathname, shows: /TOTAL VALUE|PURCHASE COST|QA Owned Control/.test(document.body.innerText) })");
    check("[local login] Back after signing out does NOT show the private pages again", afterBack.shows === false, afterBack);
    await S.evaluate("location.reload(); true"); await sleep(5000);
    check("[local login] a refresh after signing out stays signed out", (await hasSession(S)) === false && !/TOTAL VALUE|PURCHASE COST/.test(await S.text()));
    // requested destination restored after login
    const dest = "/vault/item/" + ctrl.id;
    await S.go(dest); await sleep(7000);
    const redirected = await S.evaluate("location.pathname + location.search");
    check("[local login] a signed-out visitor opening a private link is sent to the login page with the destination remembered", redirected.startsWith("/login") && /next=/.test(redirected), redirected);
    await S.waitFor("document.querySelector('input[type=email]')", 60000, "login form 2"); await sleep(800);
    await logIn(S, m.email, m.password);
    await S.waitFor("location.pathname.startsWith('/vault/item/')", 90000, "destination after login").catch(() => {}); await sleep(3000);
    check("[local login] after logging in you land on the page you asked for (the item), not Home", (await S.path()).startsWith(dest), await S.path());
  } catch (e) { console.log("STOPPED(local)", e.message); try { await S.shot("login2-stop.png"); } catch { /* ignore */ } fail++; }
  finally { await S.close(); }

  // unfinished onboarding stays gated (local, real form)
  const C = await browser(LOCAL, { withSession: false });
  try {
    await C.go("/login"); await C.waitFor("document.querySelector('input[type=email]')", 90000); await sleep(1200);
    await logIn(C, m.c.email, m.c.password);
    await C.waitFor("location.pathname !== '/login'", 60000, "left login (C)"); await sleep(5000);
    const p1 = await C.path();
    check("[local login] an account with unfinished onboarding is sent to onboarding after logging in", p1.startsWith("/onboarding"), p1);
    for (const target of ["/dashboard", "/vault", "/museum"]) { await C.go(target); await sleep(6000); const p = await C.path(); check(`[local login] unfinished onboarding: opening ${target} directly is sent back to onboarding`, p.startsWith("/onboarding"), p); }
  } catch (e) { console.log("STOPPED(local C)", e.message); fail++; }
  finally { await C.close(); }

  // ===================== PRODUCTION: nothing typed =====================
  const P = await browser(PROD);
  try {
    info("PRODUCTION commit", ((await (await fetch(PROD + "/")).text()).match(/name="vltd-commit" content="([^"]+)"/) || [])[1]);
    await P.go("/dashboard"); await P.waitFor("/PURCHASE COST/.test(document.body.innerText)", 120000, "prod Home"); await sleep(2000);
    await signOut(P);
    check("[PRODUCTION sign-out] Sign Out leads to the login page and clears the session", (await P.path()).startsWith("/login") && (await hasSession(P)) === false);
    await P.evaluate("history.back(); true"); await sleep(6000);
    const pb = await P.evaluate("({ path: location.pathname, shows: /TOTAL VALUE|PURCHASE COST|QA Owned Control/.test(document.body.innerText) })");
    check("[PRODUCTION sign-out] Back after signing out does not show the private pages", pb.shows === false, pb);
    await P.evaluate("location.reload(); true"); await sleep(6000);
    check("[PRODUCTION sign-out] a refresh stays signed out", (await hasSession(P)) === false && !/TOTAL VALUE|PURCHASE COST/.test(await P.text()));
    await P.go("/vault"); await sleep(7000);
    check("[PRODUCTION sign-out] opening /vault while signed out goes to the login page", (await P.path()).startsWith("/login"), await P.path());
  } catch (e) { console.log("STOPPED(prod)", e.message); fail++; }
  finally { await P.close(); }
  const PC = await browser(PROD, { creds: { email: m.c.email, password: m.c.password, profileId: m.c.profileId } });
  try {
    await PC.go("/dashboard"); await sleep(9000);
    const q1 = await PC.path();
    check("[PRODUCTION onboarding] an account with unfinished onboarding is held at onboarding when it opens Home", q1.startsWith("/onboarding"), q1);
    for (const target of ["/vault", "/museum", "/vault/add"]) { await PC.go(target); await sleep(6000); const p = await PC.path(); check(`[PRODUCTION onboarding] ${target} is held at onboarding`, p.startsWith("/onboarding"), p); }
  } catch (e) { console.log("STOPPED(prod C)", e.message); fail++; }
  finally { await PC.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
