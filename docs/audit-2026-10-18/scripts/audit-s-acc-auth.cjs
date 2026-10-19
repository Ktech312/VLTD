// ACC: signup / login / recovery / reset / confirmed pages, signed out. No password is ever typed; no account is created; sends are intercepted.
//   node audit-s-acc-auth.cjs [--only=signup|login|forgot|reset|confirmed|google]
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep } = A;
const r = R("ACC");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 1200000).unref();
const want = (n) => ONLY !== "links" && (!ONLY || ONLY === n);

const reqTo = (S, re) => S.reqs.filter((q) => re.test(q.url));

async function open(width, mobile) { return session("visitor", { width, height: mobile ? 844 : 900, mobile }); }

async function signup(width, mobile) {
  const tag = mobile ? "390 (browser-emulated touch)" : "1440";
  const page = `/signup | visitor | ${tag}`;
  const S = await open(width, mobile);
  try {
    await S.visit("/signup");
    const f = await S.evaluate(`(() => { const L = [...document.querySelectorAll('label')].map((l) => l.innerText.replace(/\\s+/g, ' ').trim()); const inputs = [...document.querySelectorAll('input')].map((i) => ({ type: i.type, required: i.required, min: i.minLength, ph: i.placeholder, ac: i.autocomplete })); const btn = [...document.querySelectorAll('button')].map((b) => b.innerText.trim()); const links = [...document.querySelectorAll('main a')].map((a) => a.innerText.trim() + '->' + a.getAttribute('href')); return { L, inputs, btn, links, sw: document.documentElement.scrollWidth, iw: innerWidth }; })()`);
    const shot = await S.jshot(`acc-signup-${width}`);
    const okF = f.L.length >= 4 && /first name/i.test(f.L[0]) && /email/i.test(f.L[1]) && /^password/i.test(f.L[2]) && /confirm/i.test(f.L[3]) && f.btn.some((b) => /claim free account/i.test(b)) && f.sw <= f.iw + 1;
    r.check(okF, { page, control: "Signup form fields and labels", expected: "First name (optional), Email, Password, Confirm password, 'Claim free account'; no horizontal scroll", actual: JSON.stringify(f), evidence: shot, impact: "usability", repro: `Open /signup at ${width}px` });
    r.check(f.links.some((l) => /Back to VLTD->\//.test(l)) && f.links.some((l) => /Log in->\/login/.test(l)), { page, control: "Signup links: Back to VLTD, Log in", expected: "Back goes to /, Log in goes to /login", actual: JSON.stringify(f.links), evidence: "", impact: "usability", repro: "Open /signup" });
    // go through each link by real click
    for (const [re, want, name] of [["Back to VLTD", "/", "Back to VLTD"], ["^Log in$", "/login", "Log in"]]) {
      await S.visit("/signup");
      await A.clickText(S, re, "a", { touch: mobile }); await sleep(1500);
      const p = await S.path();
      r.check(p === want || p.startsWith(want + "?"), { page, control: `${name} (link)`, expected: `opens ${want}`, actual: p, evidence: "", impact: "blocked workflow", repro: `Open /signup; click ${name}` });
    }
    // empty submit
    await S.visit("/signup");
    S.intercepted.length = 0; const before = S.reqs.length;
    await A.clickText(S, "claim free account", "button", { touch: mobile }); await sleep(800);
    let v = await S.evaluate(`(() => { const inv = [...document.querySelectorAll('input:invalid')].map((i) => i.type + ':' + (i.validity.valueMissing ? 'missing' : i.validity.typeMismatch ? 'type' : i.validity.tooShort ? 'short' : '?')); return { invalid: inv, focused: document.activeElement && document.activeElement.type, msg: document.activeElement && document.activeElement.validationMessage }; })()`);
    let posted = reqTo({ reqs: S.reqs.slice(before) }, /api\/auth\/signup/).length + S.intercepted.filter((q) => /auth\/signup/.test(q.url)).length;
    r.check(posted === 0 && v.invalid.length >= 3 && v.focused === "email", { page, control: "Claim free account (empty form)", expected: "nothing is sent; the form says which field is needed (browser validation on Email first)", actual: `requests sent=${posted}; invalid fields=${JSON.stringify(v.invalid)}; focus on=${v.focused}; message="${v.msg}"`, evidence: await S.jshot(`acc-signup-${width}-empty`), impact: "usability", repro: "Open /signup; click Claim free account with nothing filled in" });
    // malformed email only
    await A.typeInto(S, 'input[type=email]', "not-an-email"); S.intercepted.length = 0; const b2 = S.reqs.length;
    await A.clickText(S, "claim free account", "button", { touch: mobile }); await sleep(800);
    v = await S.evaluate(`(() => { const e = document.querySelector('input[type=email]'); return { typeMismatch: e.validity.typeMismatch, msg: e.validationMessage, focused: document.activeElement === e, value: e.value }; })()`);
    posted = reqTo({ reqs: S.reqs.slice(b2) }, /api\/auth\/signup/).length + S.intercepted.filter((q) => /auth\/signup/.test(q.url)).length;
    r.check(v.typeMismatch && v.focused && posted === 0, { page, control: "Email field with malformed address 'not-an-email'", expected: "refused before sending, field flagged as not an email", actual: `typeMismatch=${v.typeMismatch}; message="${v.msg}"; requests sent=${posted}`, evidence: await S.jshot(`acc-signup-${width}-malformed`), impact: "usability", repro: "Open /signup; type not-an-email; click Claim free account" });
    // valid email, still no password
    await A.typeInto(S, 'input[type=email]', "qa.nobody@example.invalid"); S.intercepted.length = 0; const b3 = S.reqs.length;
    await A.clickText(S, "claim free account", "button", { touch: mobile }); await sleep(800);
    v = await S.evaluate(`(() => { const p = document.querySelector('input[type=password]'); return { missing: p.validity.valueMissing, focused: document.activeElement === p, msg: p.validationMessage }; })()`);
    posted = reqTo({ reqs: S.reqs.slice(b3) }, /api\/auth\/signup/).length + S.intercepted.filter((q) => /auth\/signup/.test(q.url)).length;
    r.check(v.missing && v.focused && posted === 0, { page, control: "Claim free account (valid email, no password)", expected: "refused before sending; Password field flagged", actual: `valueMissing=${v.missing}; focus on password=${v.focused}; requests sent=${posted}`, evidence: "", impact: "usability", repro: "Open /signup; type a valid email only; click Claim free account" });
    r.blocked({ page, control: "Password rules (min 8 characters, passwords must match) and real submit", expected: "short password -> 'Use at least 8 characters'; mismatch -> 'The passwords do not match'; valid submit -> confirmation screen", actual: "BLOCKED: would require typing a password into a production form and creating a real account (safety rule)", evidence: "", impact: "none", repro: "n/a" });
    // launch-access counter
    const prog = await S.evaluate("!!document.querySelector('[role=progressbar]')");
    r.nt({ page, control: "Founding spots counter / progress bar", expected: "shows how many of 50 spots remain, or fails quietly", actual: `/api/launch-access is intercepted by the audit (503): the page shows no counter (progressbar present=${prog}) and the form stays usable; counter itself not tested`, evidence: "", impact: "none", repro: "Open /signup" });
  } finally { await S.close(); }
}

async function login(width, mobile) {
  const tag = mobile ? "390 (browser-emulated touch)" : "1440";
  const page = `/login | visitor | ${tag}`;
  const S = await open(width, mobile);
  try {
    await S.visit("/login");
    const f = await S.evaluate(`(() => ({ L: [...document.querySelectorAll('label')].map((l) => l.innerText.replace(/\\s+/g, ' ').trim()), btn: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean), links: [...document.querySelectorAll('main a')].map((a) => a.innerText.replace(/\\s+/g, ' ').trim() + '->' + a.getAttribute('href')), sw: document.documentElement.scrollWidth, iw: innerWidth, types: [...document.querySelectorAll('input')].map((i) => i.type + '/' + i.autocomplete) }))()`);
    const shot = await S.jshot(`acc-login-${width}`);
    const ok = f.L.length === 2 && /email/i.test(f.L[0]) && /password/i.test(f.L[1]) && f.btn.includes("Log in") && f.btn.some((b) => /Continue with Google/.test(b)) && f.sw <= f.iw + 1;
    r.check(ok, { page, control: "Login form fields and buttons", expected: "Email, Password, Log in, Continue with Google; no horizontal scroll", actual: JSON.stringify(f), evidence: shot, impact: "usability", repro: `Open /login at ${width}px` });
    for (const [re, want, name] of [["Forgot password\\?", "/forgot-password", "Forgot password?"], ["Claim one of the first 50", "/signup", "Claim one of the first 50 free accounts"], ["Back to VLTD", "/", "Back to VLTD"]]) {
      await S.visit("/login");
      await A.clickText(S, re, "a", { touch: mobile }); await sleep(1500);
      const p = await S.path();
      r.check(p === want, { page, control: `${name} (link)`, expected: `opens ${want}`, actual: p, evidence: "", impact: "blocked workflow", repro: `Open /login; click "${name}"` });
    }
    // empty submit (nothing typed): goes to the real auth service with a blank email and blank password
    await S.visit("/login");
    const b0 = S.reqs.length;
    await A.clickText(S, "^Log in$", "button", { touch: mobile }); await sleep(2500);
    let st = await S.evaluate(`(() => { const e = document.querySelector('main div[class*="red-400"]'); return { err: e ? e.innerText : null, path: location.pathname, btn: [...document.querySelectorAll('button')].find((b) => /log in|logging/i.test(b.innerText) && !/google/i.test(b.innerText))?.innerText }; })()`);
    let tokenReq = S.reqs.slice(b0).filter((q) => /auth\/v1\/token/.test(q.url)).length;
    const raw = /AuthApiError|status|json|\{|undefined|\[object/i.test(st.err || "");
    r.check(!!st.err && !raw && st.path === "/login" && st.btn === "Log in", { page, control: "Log in (nothing filled in)", expected: "stays on /login and says plainly what is wrong (e.g. enter your email and password); button returns to 'Log in'", actual: `error shown="${st.err}"; token requests=${tokenReq}; path=${st.path}; button="${st.btn}"`, evidence: await S.jshot(`acc-login-${width}-empty`), impact: "usability", repro: "Open /login; click Log in with both fields empty" });
    // malformed email only
    await A.typeInto(S, 'input[type=email]', "not-an-email");
    const b1 = S.reqs.length;
    await A.clickText(S, "^Log in$", "button", { touch: mobile }); await sleep(2500);
    st = await S.evaluate(`(() => { const e = document.querySelector('main div[class*="red-400"]'); return { err: e ? e.innerText : null, path: location.pathname }; })()`);
    tokenReq = S.reqs.slice(b1).filter((q) => /auth\/v1\/token/.test(q.url)).length;
    r.check(!!st.err && !/AuthApiError|\{|undefined|\[object/i.test(st.err) && st.path === "/login", { page, control: "Log in (malformed email 'not-an-email', no password)", expected: "stays on /login with a plain-language error", actual: `error="${st.err}"; token requests=${tokenReq}`, evidence: await S.jshot(`acc-login-${width}-malformed`), impact: "usability", repro: "Open /login; type not-an-email; click Log in" });
    r.blocked({ page, control: "Log in with a real password (and ?next= redirect after sign-in, 2FA code step, wrong-password message)", expected: "valid credentials -> dashboard or ?next= target; wrong password -> friendly error", actual: "BLOCKED: requires typing a password into the production login form (safety rule); sessions in this audit are injected", evidence: "", impact: "none", repro: "n/a" });
  } finally { await S.close(); }
}

async function google(width, mobile) {
  const tag = mobile ? "390 (browser-emulated touch)" : "1440";
  const page = `/login | visitor | ${tag}`;
  const S = await open(width, mobile);
  try {
    await S.visit("/login");
    S.intercepted.length = 0;
    await A.clickText(S, "Continue with Google", "button", { touch: mobile }); await sleep(3500);
    const i = S.intercepted.filter((q) => /auth\/v1\/authorize/.test(q.url));
    const ui = await S.evaluate(`({ path: location.href.slice(0, 80), text: document.body ? document.body.innerText.slice(0, 120) : '', btn: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter((t) => /google|redirect/i.test(t)) })`);
    r.check(i.length >= 1 && /provider=google/.test(i[0].url), { page, control: "Continue with Google", expected: "starts the Google sign-in request to the auth service (request intercepted by the audit)", actual: `intercepted: ${JSON.stringify(i.map((q) => q.url.slice(0, 90)))}; page after: ${JSON.stringify(ui)}`, evidence: await S.jshot(`acc-login-${width}-google`), impact: "blocked workflow", repro: "Open /login; click Continue with Google" });
    r.nt({ page, control: "Continue with Google (completing sign-in, return to the app)", expected: "Google consent then back to the app", actual: "NOT TESTED: the auth request is intercepted; no external Google page was opened", evidence: "", impact: "none", repro: "n/a" });
  } finally { await S.close(); }
}

async function forgot(width, mobile) {
  const tag = mobile ? "390 (browser-emulated touch)" : "1440";
  const page = `/forgot-password | visitor | ${tag}`;
  const S = await open(width, mobile);
  try {
    await S.visit("/forgot-password");
    const f = await S.evaluate(`({ L: [...document.querySelectorAll('label')].map((l) => l.innerText.replace(/\\s+/g, ' ').trim()), btn: [...document.querySelectorAll('button')].map((b) => ({ t: b.innerText.trim(), d: b.disabled })).filter((b) => b.t), back: [...document.querySelectorAll('main a')].map((a) => a.innerText.trim() + '->' + a.getAttribute('href')), focused: document.activeElement && document.activeElement.type, sw: document.documentElement.scrollWidth, iw: innerWidth })`);
    const send0 = f.btn.find((b) => /send reset link/i.test(b.t));
    r.check(f.L[0] === "Email" && send0 && send0.d === true && f.sw <= f.iw + 1, { page, control: "Reset form: Email field and Send reset link (empty)", expected: "Email field; Send reset link disabled until an address is typed (and not left silently inert)", actual: JSON.stringify(f), evidence: await S.jshot(`acc-forgot-${width}`), impact: "usability", repro: "Open /forgot-password" });
    await A.clickText(S, "Back to login", "a", { touch: mobile }); await sleep(1200);
    r.check((await S.path()) === "/login", { page, control: "Back to login (link)", expected: "opens /login", actual: await S.path(), evidence: "", impact: "usability", repro: "Open /forgot-password; click Back to login" });
    // enter a well-formed (non-existent) address; the send is intercepted -> must show failure, not success
    await S.visit("/forgot-password");
    await A.typeInto(S, 'input[type=email]', "qa.nobody@example.invalid"); S.intercepted.length = 0;
    const dis = await S.evaluate("[...document.querySelectorAll('button')].find((b) => /send reset link/i.test(b.innerText)).disabled");
    await A.clickText(S, "send reset link", "button", { touch: mobile }); await sleep(3000);
    const t = await A.bodyText(S);
    const sentClaim = /Reset link sent|you.ll receive a password reset link/i.test(t);
    const err = await S.evaluate(`(() => { const e = document.querySelector('main div[class*="red-400"]'); return e ? e.innerText : null; })()`);
    r.check(S.intercepted.some((q) => /recover/.test(q.url)) && !sentClaim && !!err, { page, control: "Send reset link (request refused: interception returns 503)", expected: "request is made; the page reports the failure honestly and does NOT say 'Reset link sent'", actual: `button enabled after typing=${!dis}; intercepted=${JSON.stringify(S.intercepted.map((q) => q.url.slice(0, 60)))}; success claimed=${sentClaim}; error shown="${err}"`, evidence: await S.jshot(`acc-forgot-${width}-fail`), impact: sentClaim ? "misleading result" : "usability", repro: "Open /forgot-password; type an email; click Send reset link while the service is unreachable" });
    // malformed
    await S.visit("/forgot-password");
    await A.typeInto(S, 'input[type=email]', "not-an-email"); S.intercepted.length = 0;
    await A.clickText(S, "send reset link", "button", { touch: mobile }); await sleep(2500);
    const t2 = await A.bodyText(S); const sent2 = /Reset link sent/i.test(t2);
    const err2 = await S.evaluate(`(() => { const e = document.querySelector('main div[class*="red-400"]'); return e ? e.innerText : null; })()`);
    r.check(!sent2 && !!err2, { page, control: "Send reset link with a malformed address 'not-an-email'", expected: "does not claim a link was sent; says the address is not valid or the request failed", actual: `request sent to service=${S.intercepted.length > 0}; success claimed=${sent2}; error shown="${err2}"`, evidence: await S.jshot(`acc-forgot-${width}-malformed`), impact: sent2 ? "misleading result" : "usability", repro: "Open /forgot-password; type not-an-email; click Send reset link" });
    r.blocked({ page, control: "Receiving the reset email / completing a real password reset", expected: "email arrives; link opens /reset-password", actual: "BLOCKED: no real email may be sent or received (safety rule)", evidence: "", impact: "none", repro: "n/a" });
  } finally { await S.close(); }
}

async function endState(S, path, wait, label, page, mobile) {
  const t0 = Date.now();
  await S.go(path);
  await sleep(1500);
  let snap = "";
  const seen = [];
  while (Date.now() - t0 < wait) {
    snap = await A.bodyText(S).catch(() => "");
    const h1 = await S.evaluate("(document.querySelector('h1') || {}).innerText || ''").catch(() => "");
    if (!seen.length || seen[seen.length - 1].h1 !== h1) seen.push({ at: Math.round((Date.now() - t0) / 100) / 10, h1 });
    await sleep(500);
  }
  return { snap, seen };
}

async function reset(width, mobile) {
  const tag = mobile ? "390 (browser-emulated touch)" : "1440";
  const S = await open(width, mobile);
  try {
    for (const [path, name] of [["/reset-password", "no token"], ["/reset-password?code=bogus", "invalid ?code"], ["/reset-password#access_token=bogus&refresh_token=bogus&type=recovery", "invalid #access_token"], ["/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", "#error otp_expired"]]) {
      const page = `/reset-password | visitor | ${tag} | ${name}`;
      const { snap, seen } = await endState(S, path, 12000, name, page, mobile);
      const spinning = /Verifying link|Confirming|Loading/i.test(snap) && !/expired|request a new/i.test(snap);
      const hasForm = (await S.evaluate("document.querySelectorAll('input[type=password]').length")) > 0;
      const link = await S.evaluate("[...document.querySelectorAll('main a')].map((a) => a.innerText.trim() + '->' + a.getAttribute('href'))");
      r.check(!spinning && !hasForm && /expired|invalid|new link|request/i.test(snap), { page, control: "Reset password page, " + name, expected: "within ~12 s ends in a clear 'link expired / request a new one' state (no spinner forever, no password form without a session)", actual: `h1 timeline=${JSON.stringify(seen)}; password form shown=${hasForm}; links=${JSON.stringify(link)}; text="${snap.slice(0, 200)}"`, evidence: await S.jshot(`acc-reset-${width}-${name.replace(/\W+/g, "_")}`), impact: "blocked workflow", repro: `Open ${path.slice(0, 40)}...` });
    }
    r.blocked({ page: `/reset-password | visitor | ${tag}`, control: "Setting a new password (both fields, mismatch and 8-character messages)", expected: "valid recovery session -> form -> new password saved", actual: "BLOCKED: needs a real emailed recovery link and typing a password (safety rule)", evidence: "", impact: "none", repro: "n/a" });
  } finally { await S.close(); }
}

async function confirmed(width, mobile) {
  const tag = mobile ? "390 (browser-emulated touch)" : "1440";
  const S = await open(width, mobile);
  try {
    for (const [path, name] of [["/auth/confirmed", "no token"], ["/auth/confirmed?code=bogus", "invalid ?code"], ["/auth/confirmed#access_token=bogus&refresh_token=bogus&type=signup", "invalid #access_token"], ["/auth/confirmed#error=access_denied&error_code=otp_expired&error_description=expired", "#error otp_expired"]]) {
      const page = `/auth/confirmed | visitor | ${tag} | ${name}`;
      const { snap, seen } = await endState(S, path, 12000, name, page, mobile);
      const spinning = /Confirming your email/i.test(snap);
      const links = await S.evaluate("[...document.querySelectorAll('main a,main button')].map((a) => a.innerText.trim() + '->' + (a.getAttribute('href') || 'button'))");
      r.check(!spinning && links.length > 0, { page, control: "Email confirmation page, " + name, expected: "within ~12 s ends in a clear state with a next step (log in / request again) rather than 'Confirming your email…' for ever", actual: `h1 timeline=${JSON.stringify(seen)}; links=${JSON.stringify(links)}; text="${snap.slice(0, 220)}"`, evidence: await S.jshot(`acc-confirmed-${width}-${name.replace(/\W+/g, "_")}`), impact: "blocked workflow", repro: `Open ${path.slice(0, 40)}` });
    }
  } finally { await S.close(); }
}

async function links(width, mobile) {
  const tag = mobile ? "390 (browser-emulated touch)" : "1440";
  const S = await open(width, mobile);
  try {
    for (const [from, re, want, name] of [["/signup", "^Log in$", "/login", "Log in"], ["/login", "Forgot password\?", "/forgot-password", "Forgot password?"], ["/login", "Claim one of the first 50", "/signup", "Claim one of the first 50 free accounts"]]) {
      await S.visit(from);
      const ok = await A.clickText(S, re, "main a", { touch: mobile }); await sleep(2000);
      const p = await S.path();
      r.check(ok && p === want, { page: `${from} | visitor | ${tag}`, control: `${name} (link)`, expected: `opens ${want}`, actual: p, evidence: "", impact: "blocked workflow", repro: `Open ${from}; click "${name}"` });
    }
  } finally { await S.close(); }
}

(async () => {
  if (ONLY === "links") { await links(1440, false); await links(390, true); }
  if (want("signup")) { await signup(1440, false); await signup(390, true); }
  if (want("login")) { await login(1440, false); await login(390, true); }
  if (want("google")) { await google(1440, false); await google(390, true); }
  if (want("forgot")) { await forgot(1440, false); await forgot(390, true); }
  if (want("reset")) { await reset(1440, false); await reset(390, true); }
  if (want("confirmed")) { await confirmed(1440, false); await confirmed(390, true); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
