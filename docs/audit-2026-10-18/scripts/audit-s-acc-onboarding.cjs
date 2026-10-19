// ACC: onboarding for the unfinished-onboarding QA user (m.c).
//   node audit-s-acc-onboarding.cjs --w=390            (walks steps, does NOT finish)
//   node audit-s-acc-onboarding.cjs --w=1440 --finish  (walks every step and finishes setup)
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep, admin, man } = A;
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 1500000).unref();
const W = Number((process.argv.find((a) => a.startsWith("--w=")) || "--w=1440").slice(4));
const FINISH = process.argv.includes("--finish");
const MOBILE = W < 500;
const tag = MOBILE ? "390 (browser-emulated touch)" : "1440";
const touch = MOBILE;

const h1 = (S) => S.evaluate("(document.querySelector('main h1') || {}).innerText || ''");
const stepOf = async (S) => { const t = await h1(S); return /personal account/i.test(t) ? 1 : /Add a business/i.test(t) ? 2 : /Pick your look/i.test(t) ? 3 : /Review and finish/i.test(t) ? 4 : 0; };
const btnState = (S, re) => S.evaluate(`(() => { const b = [...document.querySelectorAll('main button')].find((x) => new RegExp(${JSON.stringify(re)}, 'i').test(x.innerText.trim())); return b ? { disabled: b.disabled, text: b.innerText.trim(), pressed: b.getAttribute('aria-pressed') } : null; })()`);
const clickMain = (S, re) => A.clickText(S, re, "main button", { touch });
const err = (S) => S.evaluate("(() => { const e = document.querySelector('main div[class*=\"red-500\"]'); return e ? e.innerText : null; })()");
const overflow = (S) => S.evaluate("document.documentElement.scrollWidth - innerWidth");
async function waitStep(S, n, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await stepOf(S)) === n) return true; await sleep(250); } return false; }

(async () => {
  const m = man();
  const ownerProf = await admin.from("profiles").select("username").eq("id", m.personalId).single();
  const ownerUsername = ownerProf.data && ownerProf.data.username;
  const S = await session("onboard", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  try {
    // ---------- A. gate: other pages bounce to /onboarding
    const GATED = ["/dashboard", "/vault", "/vault/quick", "/capture", "/goals", "/museum", "/messages", "/notifications", "/account", "/account/billing", "/portfolio", "/insurance", "/activity", "/community-board", "/favorites", "/sales"];
    const gateHits = [];
    for (const p of GATED) {
      await S.visit(p); await sleep(500);
      const fin = await S.path();
      gateHits.push(`${p}->${fin}`);
      r.check(fin === "/onboarding", { page: `${p} | unfinished-onboarding user | ${tag}`, control: "Direct URL while setup is unfinished", expected: "sends the person to /onboarding (app pages stay closed until setup is finished)", actual: `landed on ${fin}`, evidence: fin === "/onboarding" ? "" : await S.jshot("acc-onb-gate-" + p.replace(/\W+/g, "_")), impact: "blocked workflow", repro: `Sign in with unfinished setup; open ${p}` });
    }
    for (const p of ["/discover", "/learn", "/guide"]) {
      await S.visit(p); await sleep(500);
      const fin = await S.path();
      r.pass({ page: `${p} | unfinished-onboarding user | ${tag}`, control: "Public page while setup is unfinished", expected: "(informational) public pages stay reachable", actual: `landed on ${fin}`, evidence: "", impact: "improvement", repro: `Open ${p}` });
    }
    // /login and / while signed in with unfinished setup
    await S.visit("/login"); r.pass({ page: `/login | unfinished-onboarding user | ${tag}`, control: "Visit the login page while already signed in", expected: "(informational) what a signed-in person sees", actual: `stays on ${await S.path()}; heading "${await h1(S)}"`, evidence: "", impact: "improvement", repro: "Signed in; open /login" });
    await S.visit("/"); r.pass({ page: `/ | unfinished-onboarding user | ${tag}`, control: "Visit the landing page while signed in with unfinished setup", expected: "(informational)", actual: `lands on ${await S.path()}`, evidence: "", impact: "improvement", repro: "Signed in; open /" });

    // ---------- B. onboarding page shell
    await S.visit("/onboarding");
    let step = await stepOf(S);
    const shot0 = await S.jshot(`acc-onb-${W}-start`);
    r.check(step === 2, { page: `/onboarding | unfinished-onboarding user | ${tag}`, control: "First view (saved personal profile exists)", expected: "resumes at step 2 'Add a business?' because step 1 details were saved to the account; progress bar shows 4 steps", actual: `step=${step}; heading="${await h1(S)}"; horizontal overflow=${await overflow(S)}px`, evidence: shot0, impact: "usability", repro: "Sign in as an account whose personal profile was saved but setup is unfinished" });
    r.check((await overflow(S)) <= 1, { page: `/onboarding | unfinished-onboarding user | ${tag}`, control: "Responsive layout (step 2)", expected: "no horizontal scrolling", actual: `overflow ${await overflow(S)}px`, evidence: shot0, impact: "usability", repro: `Open /onboarding at ${W}px` });
    // header nav links while setup is unfinished: do they explain themselves?
    const navClick = [];
    for (const label of ["^Vault$", "^Lounge$"]) {
      const ok = await A.clickText(S, label, "header a,nav a", { touch }); await sleep(2200);
      const p = await S.path(); const t = (await A.bodyText(S)).slice(0, 400);
      const explained = /finish (your )?setup|complete (your )?setup|before you can|set up your account first/i.test(t.replace(/Your personal details are ready.*/, ""));
      navClick.push({ label, ok, p, explained });
    }
    const navOk = navClick.every((c) => c.p === "/onboarding" && c.explained);
    r.check(navOk, { page: `/onboarding | unfinished-onboarding user | ${tag}`, control: "Header links Vault / Lounge (shown while setup is unfinished)", expected: "either hidden/disabled, or the person is told why they cannot leave (e.g. 'finish setup first'); a link that silently returns to the same page looks broken", actual: JSON.stringify(navClick), evidence: await S.jshot(`acc-onb-${W}-navclick`), impact: "usability", repro: "Unfinished setup: on /onboarding click Vault in the header" });

    // ---------- C. step 2 business toggle and validation
    await S.visit("/onboarding"); step = await stepOf(S);
    const personalOnly = await btnState(S, "Personal only");
    r.check(personalOnly && personalOnly.pressed === null && /✓/.test(personalOnly.text), { page: `/onboarding step 2 | unfinished-onboarding user | ${tag}`, control: "Personal only (card)", expected: "selected by default (tick shown)", actual: JSON.stringify(personalOnly), evidence: "", impact: "usability", repro: "Open step 2" });
    await clickMain(S, "Add a business profile"); await sleep(600);
    const bizFields = await S.evaluate("(() => ({ inputs: [...document.querySelectorAll('main input')].map((i) => i.placeholder), selects: [...document.querySelectorAll('main select option')].map((o) => o.innerText) }))()");
    const contDis = await btnState(S, "^Continue");
    r.check(bizFields.inputs.some((x) => /Business name/i.test(x)) && contDis && contDis.disabled === true, { page: `/onboarding step 2 | unfinished-onboarding user | ${tag}`, control: "Add a business profile (card)", expected: "reveals business name, handle, type, website; Continue is disabled until name and handle are filled", actual: `fields=${JSON.stringify(bizFields)}; Continue disabled=${contDis && contDis.disabled}`, evidence: await S.jshot(`acc-onb-${W}-biz`), impact: "usability", repro: "Step 2: click Add a business profile" });
    await A.typeInto(S, 'input[placeholder="Business name"]', "A"); await A.typeInto(S, 'input[placeholder="business_handle"]', "ab");
    let c = await btnState(S, "^Continue");
    r.check(c.disabled === true, { page: `/onboarding step 2 | unfinished-onboarding user | ${tag}`, control: "Business name 1 character, handle 2 characters", expected: "Continue stays disabled (name needs 2+, handle needs 3+)", actual: `Continue disabled=${c.disabled}`, evidence: "", impact: "usability", repro: "Type 'A' and 'ab'" });
    await A.typeInto(S, 'input[placeholder="Business name"]', "QA Audit Shop"); await A.typeInto(S, 'input[placeholder="business_handle"]', "QA Shop!! Handle-1");
    const handle = await S.evaluate("document.querySelector('input[placeholder=\"business_handle\"]').value");
    c = await btnState(S, "^Continue");
    r.check(handle === "qa_shop_handle_1" && c.disabled === false, { page: `/onboarding step 2 | unfinished-onboarding user | ${tag}`, control: "Business handle formatting", expected: "'QA Shop!! Handle-1' becomes qa_shop_handle_1 and Continue enables", actual: `handle="${handle}"; Continue disabled=${c.disabled}`, evidence: "", impact: "usability", repro: "Type a handle with spaces and symbols" });
    await S.evaluate("(() => { const s = document.querySelector('main select'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'gallery'); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await A.typeInto(S, 'input[placeholder="https://…"]', "notaurl");
    // switching back to Personal only hides the business form and re-enables Continue
    await clickMain(S, "Personal only"); await sleep(500);
    const hidden = await S.evaluate("![...document.querySelectorAll('main input')].some((i) => i.placeholder === 'Business name')");
    c = await btnState(S, "^Continue");
    r.check(hidden && c.disabled === false, { page: `/onboarding step 2 | unfinished-onboarding user | ${tag}`, control: "Personal only (after choosing a business)", expected: "business form hides; Continue enabled", actual: `form hidden=${hidden}; Continue disabled=${c.disabled}`, evidence: "", impact: "usability", repro: "Choose business, then Personal only" });
    await clickMain(S, "Add a business profile"); await sleep(400);
    const keep = await S.evaluate("document.querySelector('input[placeholder=\"Business name\"]').value");
    r.check(keep === "QA Audit Shop", { page: `/onboarding step 2 | unfinished-onboarding user | ${tag}`, control: "Re-choosing 'Add a business profile'", expected: "what was typed before is kept", actual: `business name field="${keep}"`, evidence: "", impact: "usability", repro: "Type business name; switch to Personal only; switch back" });

    // ---------- D. Back to step 1: identity validation
    await clickMain(S, "^Back$"); await sleep(600);
    step = await stepOf(S);
    const pre = await S.evaluate("(() => ({ name: document.querySelector('input[placeholder^=\"e.g. Jordan\"]').value, user: document.querySelector('input[placeholder^=\"e.g. jordan\"]').value, pressed: [...document.querySelectorAll('main button[aria-pressed=true]')].map((b) => b.getAttribute('aria-label')) }))()");
    r.check(step === 1 && pre.name === "QA Audit onboard" && /qa_au_onboard/.test(pre.user), { page: `/onboarding step 1 | unfinished-onboarding user | ${tag}`, control: "Back (step 2 to step 1)", expected: "step 1 shows the saved display name, username and chosen avatar", actual: `step=${step}; ${JSON.stringify(pre)}`, evidence: await S.jshot(`acc-onb-${W}-step1`), impact: "usability", repro: "Step 2: click Back" });
    const save = () => btnState(S, "Save and continue");
    await A.typeInto(S, 'input[placeholder^="e.g. Jordan"]', "Q");
    let sv = await save();
    r.check(sv.disabled === true, { page: `/onboarding step 1 | unfinished-onboarding user | ${tag}`, control: "Display name with 1 character", expected: "Save and continue disabled (needs 2+ characters)", actual: `disabled=${sv.disabled}`, evidence: "", impact: "usability", repro: "Clear display name, type one letter" });
    await A.typeInto(S, 'input[placeholder^="e.g. Jordan"]', "");
    sv = await save();
    r.check(sv.disabled === true, { page: `/onboarding step 1 | unfinished-onboarding user | ${tag}`, control: "Display name empty", expected: "Save and continue disabled", actual: `disabled=${sv.disabled}`, evidence: "", impact: "usability", repro: "Clear display name" });
    await A.typeInto(S, 'input[placeholder^="e.g. Jordan"]', "QA Audit onboard");
    await A.typeInto(S, 'input[placeholder^="e.g. jordan"]', "ab");
    sv = await save();
    r.check(sv.disabled === true, { page: `/onboarding step 1 | unfinished-onboarding user | ${tag}`, control: "Username with 2 characters", expected: "Save and continue disabled (needs 3+)", actual: `disabled=${sv.disabled}`, evidence: "", impact: "usability", repro: "Type 'ab' as username" });
    await A.typeInto(S, 'input[placeholder^="e.g. jordan"]', "Zed A-B.c!! " + "x".repeat(40));
    const uname = await S.evaluate("document.querySelector('input[placeholder^=\"e.g. jordan\"]').value");
    const urlText = await S.evaluate("(document.body.innerText.match(/Public URL: [^\\n]*/) || [''])[0]");
    r.check(/^zed_a_b_c_x+$/.test(uname) && uname.length <= 24 && urlText.includes(uname), { page: `/onboarding step 1 | unfinished-onboarding user | ${tag}`, control: "Username formatting and length", expected: "lower case, letters/numbers/underscore only, max 24 characters; the Public URL preview matches", actual: `username="${uname}" (${uname.length}); ${urlText}`, evidence: "", impact: "usability", repro: "Type 'Zed A-B.c!!' plus 40 x's" });
    // avatar: aria-pressed moves
    await A.clickText(S, "^Fox Collector$", "main button", { touch }); await sleep(300);
    const av = await S.evaluate("[...document.querySelectorAll('main button[aria-pressed=true]')].map((b) => b.getAttribute('aria-label'))");
    r.check(av.length === 1 && av[0] === "Fox Collector", { page: `/onboarding step 1 | unfinished-onboarding user | ${tag}`, control: "Avatar picker (Fox Collector)", expected: "exactly one avatar selected, the one clicked", actual: JSON.stringify(av), evidence: await S.jshot(`acc-onb-${W}-avatar`), impact: "usability", repro: "Step 1: click an avatar" });
    // duplicate username: the owner's already-taken handle
    if (ownerUsername) {
      await A.typeInto(S, 'input[placeholder^="e.g. jordan"]', ownerUsername);
      await clickMain(S, "Save and continue"); await sleep(3500);
      const stAfter = await stepOf(S); const e = await err(S);
      const raw = /duplicate key|violates|unique constraint|23505|\bPGRST|\{|\[object/i.test(e || "");
      r.check(stAfter === 1 && !!e && !raw, { page: `/onboarding step 1 | unfinished-onboarding user | ${tag}`, control: "Save and continue with a username that another account already has", expected: "stays on step 1 and says in plain words that the username is taken", actual: `step=${stAfter}; message="${e}"`, evidence: await S.jshot(`acc-onb-${W}-dup-username`), impact: "usability", repro: "Step 1: type an existing username; Save and continue" });
    }
    // valid save
    await A.typeInto(S, 'input[placeholder^="e.g. jordan"]', "qa_au_onboard_" + m.stamp);
    await clickMain(S, "Save and continue"); await sleep(2500);
    r.check(await waitStep(S, 2), { page: `/onboarding step 1 | unfinished-onboarding user | ${tag}`, control: "Save and continue (valid)", expected: "moves to step 2", actual: `step=${await stepOf(S)}`, evidence: "", impact: "blocked workflow", repro: "Step 1: valid name+username; Save and continue" });
    const dbProf = await admin.from("profiles").select("display_name,username,avatar_url,onboarding_completed,is_public").eq("id", m.c.profileId).single();
    r.check(dbProf.data && dbProf.data.avatar_url === "__preset:fox" && dbProf.data.onboarding_completed === false, { page: `/onboarding step 1 | unfinished-onboarding user | ${tag}`, control: "Save and continue persists to the account", expected: "avatar fox and username saved in the database while setup is still unfinished", actual: JSON.stringify(dbProf.data), evidence: "", impact: "data loss", repro: "Save step 1; check account record" });

    // ---------- E. leave and return
    await S.visit("/dashboard"); await sleep(800);
    r.check((await S.path()) === "/onboarding" && (await stepOf(S)) === 2, { page: `/onboarding | unfinished-onboarding user | ${tag}`, control: "Leave (open /dashboard) and come back", expected: "returned to /onboarding at step 2 with the saved details", actual: `${await S.path()} step=${await stepOf(S)}`, evidence: "", impact: "usability", repro: "Save step 1; open /dashboard" });
    // step 3 persists across a reload (draft)
    await clickMain(S, "^Continue"); await sleep(600);
    step = await stepOf(S);
    // look & screen
    const looks = await S.evaluate("[...document.querySelectorAll('main button[aria-pressed]')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim().slice(0, 12) + '=' + b.getAttribute('aria-pressed'))");
    await A.clickText(S, "^Bright", "main button", { touch }); await sleep(600);
    const logoB = await S.evaluate("(() => { const bs = [...document.querySelectorAll('main button[aria-pressed]')].filter((b) => /Bright|Classic/.test(b.innerText)); return bs.map((b) => b.innerText.trim().split('\\n')[0] + '=' + b.getAttribute('aria-pressed')); })()");
    await A.clickText(S, "^Light$", "main button", { touch }); await sleep(900);
    const light = await S.evaluate("({ bg: document.documentElement.getAttribute('data-vltd-theme'), pressed: [...document.querySelectorAll('main button[aria-pressed=true]')].map((b) => b.innerText.trim().split('\\n')[0]) })");
    const shotLight = await S.jshot(`acc-onb-${W}-step3-light`);
    await A.clickText(S, "^Dark$", "main button", { touch }); await sleep(900);
    const dark = await S.evaluate("({ bg: document.documentElement.getAttribute('data-vltd-theme') })");
    r.check(step === 3 && light.bg !== dark.bg && light.pressed.includes("Light") && logoB.some((x) => /Bright=true/.test(x)), { page: `/onboarding step 3 | unfinished-onboarding user | ${tag}`, control: "Bright / Classic and Light / Dark", expected: "Bright becomes selected; Light changes the screen colours immediately and Dark changes them back", actual: `step=${step}; initial=${JSON.stringify(looks)}; after Bright=${JSON.stringify(logoB)}; light=${JSON.stringify(light)}; dark=${JSON.stringify(dark)}`, evidence: shotLight, impact: "usability", repro: "Step 3: click Bright, Light, Dark" });
    // reload on step 3: stays on step 3 and keeps choices?
    await S.visit("/onboarding"); await sleep(600);
    const stReload = await stepOf(S);
    const afterReload = await S.evaluate("({ bg: document.documentElement.getAttribute('data-vltd-theme'), pressed: [...document.querySelectorAll('main button[aria-pressed=true]')].map((b) => b.innerText.trim().split('\\n')[0]) })");
    r.check(stReload === 3 && afterReload.pressed.includes("Bright"), { page: `/onboarding step 3 | unfinished-onboarding user | ${tag}`, control: "Reload while on step 3", expected: "stays on step 3 with Bright still chosen", actual: `step=${stReload}; ${JSON.stringify(afterReload)}`, evidence: await S.jshot(`acc-onb-${W}-step3-reload`), impact: "usability", repro: "Choose Bright on step 3; reload" });
    // Back / Continue between 3 and 2 and 4
    await clickMain(S, "^Back$"); await sleep(500); const s2 = await stepOf(S);
    await clickMain(S, "^Continue"); await sleep(500); const s3 = await stepOf(S);
    await clickMain(S, "^Continue"); await sleep(500); const s4 = await stepOf(S);
    r.check(s2 === 2 && s3 === 3 && s4 === 4, { page: `/onboarding | unfinished-onboarding user | ${tag}`, control: "Back / Continue between steps 3, 2, 3, 4", expected: "3 -> Back -> 2 -> Continue -> 3 -> Continue -> 4", actual: `${s2},${s3},${s4}`, evidence: "", impact: "blocked workflow", repro: "Walk the steps" });
    // ---------- F. step 4
    const uni = await S.evaluate("[...document.querySelectorAll('main button[aria-pressed]')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim() + '=' + b.getAttribute('aria-pressed'))");
    await A.clickText(S, "^Select all$", "main button", { touch }); await sleep(400);
    const allSel = await S.evaluate("[...document.querySelectorAll('main button[aria-pressed=true]')].length");
    const sumAll = await S.evaluate("(document.body.innerText.match(/@[a-z0-9_]+ · Personal[^\\n]*/) || [''])[0]");
    await A.clickText(S, "Skip — show everything", "main button", { touch }); await sleep(400);
    const noneSel = await S.evaluate("[...document.querySelectorAll('main button[aria-pressed=true]')].length");
    await A.clickText(S, "^Music", "main button", { touch }); await sleep(300);
    const oneSel = await S.evaluate("[...document.querySelectorAll('main button[aria-pressed=true]')].map((b) => b.innerText.trim())");
    const sumOne = await S.evaluate("(document.body.innerText.match(/@[a-z0-9_]+ · Personal[^\\n]*/) || [''])[0]");
    r.check(allSel === uni.length && noneSel === 0 && oneSel.length === 1 && /Music/.test(oneSel[0]), { page: `/onboarding step 4 | unfinished-onboarding user | ${tag}`, control: "Universe pills, Select all, Skip — show everything", expected: "Select all selects every universe; Skip clears them; clicking Music selects only it; the summary line reflects the count", actual: `universes=${uni.length}; select all=${allSel} (${sumAll}); skip=${noneSel}; one=${JSON.stringify(oneSel)} (${sumOne})`, evidence: await S.jshot(`acc-onb-${W}-step4`), impact: "usability", repro: "Step 4: Select all, Skip, then Music" });
    // summary with Personal only: go back to step 2, choose Personal only, return to step 4
    await clickMain(S, "^Back$"); await sleep(400); await clickMain(S, "^Back$"); await sleep(400);
    await clickMain(S, "Personal only"); await sleep(300); await clickMain(S, "^Continue"); await sleep(400); await clickMain(S, "^Continue"); await sleep(500);
    const summ = await A.bodyText(S); const fb = await btnState(S, "finish");
    r.check(/QA Audit onboard/.test(summ) && !/QA Audit Shop/.test(summ) && /Finish setup/.test(fb.text), { page: `/onboarding step 4 | unfinished-onboarding user | ${tag}`, control: "Setup summary (Personal only chosen)", expected: "summary lists the personal profile only and the button says 'Finish setup'", actual: `button="${fb.text}"; ${summ.match(/SETUP SUMMARY.{0,160}/i)?.[0]}`, evidence: await S.jshot(`acc-onb-${W}-step4-personal`), impact: "misleading result", repro: "Choose Personal only; view step 4" });
    if (MOBILE) {
      const small = await S.evaluate("[...document.querySelectorAll('main button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 1 && (r.height < 32); }).map((b) => b.innerText.trim().slice(0, 20) + ' ' + Math.round(b.getBoundingClientRect().height))");
      r.check(small.length === 0, { page: `/onboarding step 4 | unfinished-onboarding user | ${tag}`, control: "Tap targets", expected: "buttons are at least 32px tall", actual: small.length ? JSON.stringify(small) : "all >= 32px", evidence: "", impact: "usability", repro: "Open step 4 at 390px" });
    }
    r.check((await overflow(S)) <= 1, { page: `/onboarding step 4 | unfinished-onboarding user | ${tag}`, control: "Responsive layout (step 4)", expected: "no horizontal scrolling", actual: `overflow ${await overflow(S)}px`, evidence: "", impact: "usability", repro: "" });
    if (!FINISH) { r.nt({ page: `/onboarding step 4 | unfinished-onboarding user | ${tag}`, control: "Finish setup", expected: "completes setup", actual: "not pressed in this pass (done in the 1440 pass)", evidence: "", impact: "none", repro: "" }); return; }

    // ---------- G. add a business and finish
    await clickMain(S, "^Back$"); await sleep(400); await clickMain(S, "^Back$"); await sleep(400);
    await clickMain(S, "Add a business profile"); await sleep(400);
    await A.typeInto(S, 'input[placeholder="Business name"]', "QA Audit Shop"); await A.typeInto(S, 'input[placeholder="business_handle"]', "qa_shop_" + m.stamp);
    await S.evaluate("(() => { const s = document.querySelector('main select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'gallery'); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await A.typeInto(S, 'input[placeholder="https://…"]', "https://example.com");
    await clickMain(S, "^Continue"); await sleep(400); await clickMain(S, "^Continue"); await sleep(400);
    await A.clickText(S, "^Music", "main button", { touch }); await sleep(300);
    const finLabel = await btnState(S, "finish");
    const sum2 = await A.bodyText(S);
    r.check(/Create business and finish/.test(finLabel.text) && /QA Audit Shop/.test(sum2) && /Separate business profile/.test(sum2), { page: `/onboarding step 4 | unfinished-onboarding user | ${tag}`, control: "Setup summary and finish button with a business", expected: "summary lists the business and the button says 'Create business and finish'", actual: `button="${finLabel.text}"; ${sum2.match(/Setup summary.{0,220}/)?.[0]}`, evidence: await S.jshot(`acc-onb-${W}-step4-biz`), impact: "misleading result", repro: "Choose business; go to step 4" });
    // interrupted connection: go offline, press finish, must report a failure and stay on step 4
    await S.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await clickMain(S, "Create business and finish"); await sleep(3500);
    const offErr = await err(S); const offStep = await stepOf(S);
    await S.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    r.check(offStep === 4 && !!offErr, { page: `/onboarding step 4 | unfinished-onboarding user | ${tag}`, control: "Create business and finish while the connection is down", expected: "stays on step 4 and shows a plain error; nothing claims success", actual: `step=${offStep}; message="${offErr}"`, evidence: await S.jshot(`acc-onb-${W}-finish-offline`), impact: "misleading result", repro: "Step 4: go offline; press finish" });
    const before = await admin.from("profiles").select("id,profile_type,onboarding_completed").eq("user_id", m.c.userId);
    await sleep(1500);
    // real finish
    await clickMain(S, "Create business and finish");
    const t0 = Date.now(); let fin = "";
    while (Date.now() - t0 < 25000) { fin = await S.path(); if (fin !== "/onboarding") break; await sleep(500); }
    await sleep(2500);
    const finPath = await S.path();
    const after = await admin.from("profiles").select("id,profile_type,username,display_name,onboarding_completed,is_public,collection_interests,business_type,website,avatar_url").eq("user_id", m.c.userId);
    const pers = (after.data || []).find((p) => p.profile_type === "personal"); const biz = (after.data || []).find((p) => p.profile_type === "business");
    const activeId = await S.evaluate("localStorage.getItem('vltd_active_profile_id_v1')");
    r.check(!!pers && pers.onboarding_completed === true && !!biz && biz.business_type === "gallery" && biz.website === "https://example.com" && Array.isArray(pers.collection_interests) && pers.collection_interests.length >= 1 && activeId === pers.id && /^\/dashboard|^\/$/.test(finPath), { page: `/onboarding step 4 | unfinished-onboarding user | ${tag}`, control: "Create business and finish", expected: "personal profile finished (interests saved), separate business profile created with type and website, Personal stays the active profile, lands on the dashboard", actual: `landed ${finPath}; before=${JSON.stringify((before.data || []).map((p) => p.profile_type + ':' + p.onboarding_completed))}; personal=${JSON.stringify({ done: pers && pers.onboarding_completed, public: pers && pers.is_public, interests: pers && pers.collection_interests })}; business=${JSON.stringify(biz && { type: biz.business_type, site: biz.website, user: biz.username })}; active profile is personal=${activeId === (pers && pers.id)}`, evidence: await S.jshot(`acc-onb-${W}-after-finish`), impact: "blocked workflow", repro: "Walk all steps with a business; finish" });
    r.pass({ page: `/onboarding finish | unfinished-onboarding user | ${tag}`, control: "Profile visibility after finishing (informational)", expected: "(informational) setup finish also sets the personal profile public", actual: `is_public=${pers && pers.is_public} for the personal profile after finishing (the landing says 'Private by default'; items stay private unless made public)`, evidence: "", impact: "improvement", repro: "Finish setup; read the profile record" });
    // gate released
    for (const p of ["/vault", "/account", "/goals"]) { await S.visit(p); r.check((await S.path()).startsWith(p), { page: `${p} | finished-onboarding user | ${tag}`, control: "Direct URL after setup is finished", expected: "page opens", actual: await S.path(), evidence: "", impact: "blocked workflow", repro: "" }); }
    await S.visit("/onboarding"); await sleep(1500);
    r.check((await S.path()) !== "/onboarding", { page: `/onboarding | finished-onboarding user | ${tag}`, control: "Open /onboarding after finishing", expected: "leaves the setup page (nothing to set up)", actual: await S.path(), evidence: "", impact: "usability", repro: "Finish setup; open /onboarding" });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
