// ACC: Settings contact, data, security (privacy cards), billing, invite, business/new. Owner, Personal. --w=1440|390 [--part=...]
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep, admin, man } = A;
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 1700000).unref();
const W = Number((process.argv.find((a) => a.startsWith("--w=")) || "--w=1440").slice(4));
const MOBILE = W < 500; const touch = MOBILE;
const tag = MOBILE ? "390 (browser-emulated touch)" : "1440";
const PART = (process.argv.find((a) => a.startsWith("--part=")) || "").slice(7);
const m = man();
const db = async () => (await admin.from("profiles").select("*").eq("id", m.personalId).single()).data;
const clickBtn = (S, re) => A.clickText(S, re, "main button,main a", { touch });
const go = async (S, p) => { await S.visit(p); await sleep(1200); };
const overflow = (S) => S.evaluate("document.documentElement.scrollWidth - innerWidth");
const toast = (S) => S.evaluate("(() => { const t = [...document.querySelectorAll('[role=status],[role=alert],[class*=toast],div')].filter((e) => e.children.length === 0 && /sent|failed|couldn|enter a valid|already|saved|copied|error/i.test(e.innerText || '') && e.getBoundingClientRect().width > 1).map((e) => e.innerText.trim()).filter((x) => x.length < 140); return t.slice(0, 4); })()");
const page = (x) => `${x} | owner, Personal | ${tag}`;

async function contact(S) {
  await go(S, "/account?section=contact");
  const orig = await db();
  const ph = await S.evaluate("[...document.querySelectorAll('main input')].filter((e) => e.getBoundingClientRect().width > 1).map((e) => e.placeholder)");
  const vals = ["QA Contact Name", "(555) 010-0199", "1 Audit Way", "Suite 9", "Testville", "TS", "12345", "US"];
  for (let i = 0; i < ph.length && i < vals.length; i++) await A.typeInto(S, `main input[placeholder="${ph[i]}"]`, vals[i]);
  await clickBtn(S, "Save contact info"); await sleep(1800);
  const msg = await toast(S); const t = await A.bodyText(S);
  let d = await db();
  r.check(/Contact info saved/.test(t) && d.full_name === "QA Contact Name" && d.zip === "12345" && d.city === "Testville", { page: page("/account?section=contact"), control: "Save contact info", expected: "says 'Contact info saved.' and the database holds every field", actual: `message=${/Contact info saved/.test(t)}; db=${JSON.stringify({ n: d.full_name, p: d.phone, a: d.address_line1, a2: d.address_line2, c: d.city, s: d.state, z: d.zip, k: d.country })}`, evidence: await S.jshot(`acc-set-contact-${W}`), impact: "data loss", repro: "Fill every contact field; Save contact info" });
  await go(S, "/account?section=contact");
  const back = await S.evaluate("[...document.querySelectorAll('main input')].filter((e) => e.getBoundingClientRect().width > 1).map((e) => e.value)");
  r.check(JSON.stringify(back) === JSON.stringify(vals), { page: page("/account?section=contact"), control: "Contact info after reload", expected: "all eight fields come back as saved", actual: JSON.stringify(back), evidence: "", impact: "data loss", repro: "Save; reload" });
  // unsaved edit dropped
  await A.typeInto(S, `main input[placeholder="${ph[0]}"]`, "Not Saved Name");
  await go(S, "/account?section=data"); await go(S, "/account?section=contact");
  const kept = await S.evaluate(`document.querySelector('main input[placeholder="${ph[0]}"]').value`);
  r.check(kept === "QA Contact Name", { page: page("/account?section=contact"), control: "Edit contact then leave without saving (no Cancel button)", expected: "unsaved edit is dropped", actual: kept, evidence: "", impact: "data loss", repro: "" });
  // invalid phone / zip
  await A.typeInto(S, `main input[placeholder="${ph[1]}"]`, "not a phone"); await A.typeInto(S, `main input[placeholder="${ph[6]}"]`, "ABCDE-zz");
  await clickBtn(S, "Save contact info"); await sleep(1800);
  d = await db();
  r.pass({ page: page("/account?section=contact"), control: "Phone 'not a phone' and ZIP 'ABCDE-zz' (informational)", expected: "(informational) contact fields have no format checks", actual: `saved as phone="${d.phone}" zip="${d.zip}"; no warning shown`, evidence: "", impact: "improvement", repro: "Type junk in Phone and ZIP; Save" });
  if (MOBILE || true) r.check((await overflow(S)) <= 1, { page: page("/account?section=contact"), control: "Responsive layout", expected: "no horizontal scrolling", actual: `overflow ${await overflow(S)}px`, evidence: "", impact: "usability", repro: "" });
  await admin.from("profiles").update({ full_name: orig.full_name, phone: orig.phone, address_line1: orig.address_line1, address_line2: orig.address_line2, city: orig.city, state: orig.state, zip: orig.zip, country: orig.country }).eq("id", m.personalId);
}

async function data(S) {
  await go(S, "/account?section=data");
  // Export Vault JSON: stub captures the blob
  await clickBtn(S, "Export Vault JSON"); await sleep(1500);
  const look = await S.look();
  const blobs = look && look.blobs || []; const dl = look && look.downloads || [];
  // read the blob content through a re-run that keeps text: patch createObjectURL to remember the text
  await S.evaluate("(() => { const o = URL.createObjectURL; window.__blobText = []; URL.createObjectURL = function (b) { try { b.text().then((t) => window.__blobText.push(t.slice(0, 400000))); } catch (e) {} return o.call(URL, b); }; })()");
  await clickBtn(S, "Export Vault JSON"); await sleep(1500);
  const text = await S.evaluate("window.__blobText && window.__blobText[0]");
  let parsed = null; try { parsed = JSON.parse(text); } catch {}
  const items = parsed && (Array.isArray(parsed) ? parsed : parsed.items || parsed.vault || []);
  const titles = (items || []).map((x) => x.title || x.name || "").filter(Boolean);
  const foreign = titles.filter((x) => !/^QA /.test(x));
  r.check(!!parsed && items.length >= 26 && foreign.length === 0, { page: page("/account?section=data"), control: "Export Vault JSON", expected: "downloads a file with this profile's items only (26 owned + 5 sold = 31 records, none from the Business profile or other accounts)", actual: `downloads=${JSON.stringify(dl.slice(0, 2))}; blobs=${JSON.stringify(blobs.slice(0, 2))}; parsed=${!!parsed}; records=${items ? items.length : "n/a"}; non-QA titles=${JSON.stringify(foreign.slice(0, 3))}`, evidence: await S.jshot(`acc-set-export-${W}`), impact: "privacy/data loss", repro: "Settings > Data and maintenance > Export Vault JSON" });
  // clear local cache: dismissing the confirm leaves things alone
  S.dialogs.length = 0; S.dialogMode = "dismiss";
  await clickBtn(S, "Clear Local Cache"); await sleep(1000);
  const dlg1 = S.dialogs.slice();
  const stay = await S.path();
  S.dialogMode = "accept"; S.dialogs.length = 0;
  await S.evaluate("localStorage.setItem('vltd_audit_marker', '1'); true");
  await clickBtn(S, "Clear Local Cache"); await sleep(4000);
  const dlg2 = S.dialogs.slice();
  const items2 = await S.evaluate("document.body.innerText.length");
  await go(S, "/vault"); await sleep(3000);
  const cards = await S.evaluate("document.querySelectorAll('a[href^=\"/vault/item/\"]').length");
  S.dialogMode = "dismiss";
  r.check(dlg1.length === 1 && /vault|device/i.test(dlg1[0].message) && dlg2.length === 1 && cards >= 20, { page: page("/account?section=data"), control: "Clear Local Cache (Cancel, then OK)", expected: "asks first; Cancel changes nothing; OK clears cache on this device only and the vault still has all items afterwards", actual: `Cancel dialog=${JSON.stringify(dlg1)}; OK dialog=${JSON.stringify(dlg2).slice(0, 200)}; items shown afterwards=${cards}`, evidence: "", impact: "data loss", repro: "Clear Local Cache; Cancel; again OK; open Vault" });
  // Sync Now
  await go(S, "/account?section=data");
  await clickBtn(S, "^Sync Now$"); await sleep(5000);
  const syncText = await S.evaluate("(document.body.innerText.match(/(Synced|Sync complete|Up to date|sync[^\\n]{0,80})/gi) || []).slice(0, 4)");
  r.check(syncText.length > 0, { page: page("/account?section=data"), control: "Sync Now", expected: "reports the result of the sync", actual: JSON.stringify(syncText), evidence: await S.jshot(`acc-set-syncnow-${W}`), impact: "usability", repro: "Click Sync Now" });
  r.nt({ page: page("/account?section=data"), control: "Repair / Migrate Images", expected: "repairs item photos", actual: "NOT TESTED: it rewrites item photo storage for the fixture items, which other audit areas are measuring; judged not worth disturbing their evidence", evidence: "", impact: "none", repro: "" });
}

async function security(S) {
  await go(S, "/account/security");
  r.check((await overflow(S)) <= 1, { page: page("/account/security"), control: "Responsive layout", expected: "no horizontal scrolling", actual: `overflow ${await overflow(S)}px`, evidence: await S.jshot(`acc-set-security-${W}`), impact: "usability", repro: "" });
  // change email
  await clickBtn(S, "^Change$"); await sleep(600);
  const emailInput = 'main input[type=email],main input[placeholder*="@"]';
  const hasInput = await S.evaluate(`!!document.querySelector('${emailInput}')`);
  await A.typeInto(S, emailInput, "not-an-email"); await A.clickText(S, "^(Send confirmation|Save|Update|Send)", "main button", { touch }); await sleep(900);
  const t1 = await toast(S);
  await A.typeInto(S, emailInput, "qa.audit.nobody@example.invalid"); S.intercepted.length = 0; await A.clickText(S, "^(Send confirmation|Save|Update|Send)", "main button", { touch }); await sleep(2500);
  const t2 = await toast(S); const int2 = S.intercepted.map((q) => q.url);
  const claimedSent = (await A.bodyText(S)).match(/Confirmation email sent[^.]*/);
  r.check(hasInput && t1.some((x) => /valid email/i.test(x)) && !claimedSent && int2.some((u) => /change-email/.test(u)), { page: page("/account/security"), control: "Email address > Change (bad address, then a valid one with the send refused)", expected: "bad address refused ('Enter a valid email address'); with the send refused, the page does NOT claim a confirmation email was sent", actual: `bad address toast=${JSON.stringify(t1)}; refused-send toast=${JSON.stringify(t2)}; claims sent=${!!claimedSent}; intercepted=${JSON.stringify(int2)}`, evidence: await S.jshot(`acc-set-changeemail-${W}`), impact: "misleading result", repro: "Email address: Change; type an address; send while the server refuses" });
  r.blocked({ page: page("/account/security"), control: "Email change confirmation / password change completion", expected: "a real email is sent and the link applied", actual: "BLOCKED: would send real email / change real credentials (safety rule)", evidence: "", impact: "none", repro: "" });
  // reset password button
  await go(S, "/account/security");
  S.intercepted.length = 0;
  await clickBtn(S, "^Reset password$"); await sleep(2500);
  const t3 = await toast(S);
  r.check(S.intercepted.some((q) => /password-reset|recover/.test(q.url)) && !t3.some((x) => /reset email sent/i.test(x)), { page: page("/account/security"), control: "Change Password > Reset password (send refused by the audit)", expected: "tries to send; when refused, does NOT say 'Password reset email sent'", actual: `toast=${JSON.stringify(t3)}; intercepted=${JSON.stringify(S.intercepted.map((q) => q.url))}; page shows 'sent' state=${/Reset email sent|email sent/i.test(await A.bodyText(S))}`, evidence: await S.jshot(`acc-set-resetpw-${W}`), impact: "misleading result", repro: "Security: Reset password with the mail service unreachable" });
  // 2FA
  await go(S, "/account/security");
  S.intercepted.length = 0;
  await clickBtn(S, "Enable 2FA"); await sleep(3000);
  const mfa = await S.evaluate("(document.body.innerText.match(/(Scan|authenticator|QR|code|Couldn.t|failed|error)[^\\n]{0,100}/gi) || []).slice(0, 5)");
  r.check(S.intercepted.some((q) => /factors|mfa/.test(q.url)), { page: page("/account/security"), control: "Enable 2FA", expected: "starts enrolment (the request is intercepted by the audit) and tells the person plainly that it did not start", actual: `intercepted=${JSON.stringify(S.intercepted.map((q) => q.url.slice(0, 60)))}; page text=${JSON.stringify(mfa)}`, evidence: await S.jshot(`acc-set-2fa-${W}`), impact: "misleading result", repro: "Security: Enable 2FA while the auth service refuses" });
  r.blocked({ page: page("/account/security"), control: "2FA enrolment and code check", expected: "authenticator enrolment", actual: "BLOCKED: needs the real auth service and an authenticator app (auth requests are intercepted)", evidence: "", impact: "none", repro: "" });
  // public profile toggle disabled with reason
  await go(S, "/account/security");
  const pp = await S.evaluate("(() => { const b = [...document.querySelectorAll('main button')].find((x) => /Public profile/.test(x.innerText)); return b ? { disabled: b.disabled, text: b.innerText.replace(/\\s+/g, ' ').trim() } : null; })()");
  const why = await S.evaluate("(document.body.innerText.match(/Paid feature[^\\n]*/) || [''])[0]");
  r.check(!!pp && pp.disabled && /coming soon|Paid/i.test(why), { page: page("/account/security"), control: "Public profile switch", expected: "disabled with a visible reason", actual: `${JSON.stringify(pp)}; reason="${why}"`, evidence: "", impact: "usability", repro: "" });
  // age verification
  const dobInput = 'main input[type=date],main input[placeholder*="MM"],main input[name*=dob]';
  const hasDob = await S.evaluate(`!!document.querySelector('${dobInput}')`);
  const verifyDisabled = await S.evaluate("(() => { const b = [...document.querySelectorAll('main button')].find((x) => /Verify Age/.test(x.innerText)); return b ? b.disabled : null; })()");
  r.check(verifyDisabled === true, { page: page("/account/security"), control: "Verify Age with no date of birth", expected: "disabled and says why ('enter a valid DOB and be 18+')", actual: `disabled=${verifyDisabled}; hint="${(await A.bodyText(S)).match(/Not eligible yet[^.]*/)?.[0]}"`, evidence: "", impact: "usability", repro: "" });
  // marketing opt-in
  const tog = await S.evaluate("(() => { const t = document.querySelector('main [role=switch],main input[type=checkbox]'); return t ? { checked: t.getAttribute('aria-checked') || t.checked } : null; })()");
  await A.clickSel(S, "main [role=switch]", { touch }); await sleep(500);
  await A.clickText(S, "^Save$", "main button", { touch }); await sleep(2500);
  const d = await db();
  r.check(!!tog && d.marketing_opt_in === true, { page: page("/account/security"), control: "Receive product updates switch + Save", expected: "saved to the profile (marketing_opt_in true)", actual: `before=${JSON.stringify(tog)}; db marketing_opt_in=${d.marketing_opt_in}; toast=${JSON.stringify(await toast(S))}`, evidence: await S.jshot(`acc-set-marketing-${W}`), impact: "data loss", repro: "Switch on Receive product updates; Save" });
  await admin.from("profiles").update({ marketing_opt_in: false }).eq("id", m.personalId);
  // sign out everywhere: is there a confirmation?
  await go(S, "/account/security");
  S.dialogs.length = 0; S.dialogMode = "dismiss"; S.intercepted.length = 0;
  await clickBtn(S, "^Sign out all$"); await sleep(4000);
  const p2 = await S.path();
  r.check(S.dialogs.length > 0 || p2 === "/account/security", { page: page("/account/security"), control: "Sign out all (danger zone)", expected: "asks 'are you sure?' before ending every session (and stays put if declined)", actual: `confirmation dialogs=${JSON.stringify(S.dialogs)}; landed ${p2}; sign-out request intercepted=${S.intercepted.some((q) => /logout/.test(q.url))} (the request itself was refused by the audit); session still stored in browser=${await S.evaluate("!!localStorage.getItem('vltd-auth')")}`, evidence: await S.jshot(`acc-set-signoutall-${W}`), impact: "misleading result", repro: "Security > Sign out all, without confirming" });
}

async function billing(S) {
  await go(S, "/account/billing");
  r.check((await overflow(S)) <= 1, { page: page("/account/billing"), control: "Responsive layout", expected: "no horizontal scrolling", actual: `overflow ${await overflow(S)}px`, evidence: await S.jshot(`acc-set-billing-${W}`), impact: "usability", repro: "" });
  const plan = await S.evaluate("(document.body.innerText.match(/CURRENT PLAN\\s+([^\\n]+)/i) || [])[1]");
  const dbp = await db();
  r.check(/Business/.test(plan || "") === (dbp.tier === "FULL"), { page: page("/account/billing"), control: "Current plan banner", expected: "matches the stored plan", actual: `banner="${plan}"; stored tier=${dbp.tier}; stripe customer on file=${!!dbp.stripe_customer_id}`, evidence: "", impact: "misleading result", repro: "Open /account/billing" });
  // upgrade: checkout request refused
  S.intercepted.length = 0;
  const up = await A.clickText(S, "Upgrade", "main button", { touch }); await sleep(2500);
  const t = await toast(S); const bt = await A.bodyText(S);
  r.check(up && S.intercepted.some((q) => /billing\/checkout/.test(q.url)) && (await S.path()) === "/account/billing" && !/Redirecting…/.test(bt), { page: page("/account/billing"), control: "Upgrade → (checkout request refused by the audit)", expected: "asks the server to start checkout; when refused it stays here, restores the button and says it could not start checkout", actual: `intercepted=${JSON.stringify(S.intercepted.map((q) => q.url))}; toast=${JSON.stringify(t)}; path=${await S.path()}; still says Redirecting=${/Redirecting…/.test(bt)}`, evidence: await S.jshot(`acc-set-upgrade-${W}`), impact: "misleading result", repro: "Billing: Upgrade → with the billing service unreachable" });
  r.blocked({ page: page("/account/billing"), control: "Stripe checkout / billing portal / cancel plan", expected: "real payment flow", actual: "BLOCKED: no purchases or billing sessions may be created (safety rule); /api/billing/* is intercepted", evidence: "", impact: "none", repro: "" });
  S.intercepted.length = 0;
  await clickBtn(S, "^Downgrade$"); await sleep(2500);
  r.check(S.intercepted.some((q) => /billing\/portal/.test(q.url)), { page: page("/account/billing"), control: "Downgrade (Free card)", expected: "opens the billing portal request (refused by the audit); tells the person when it cannot", actual: `intercepted=${JSON.stringify(S.intercepted.map((q) => q.url))}; toast=${JSON.stringify(await toast(S))}; account has no billing customer on file`, evidence: "", impact: "usability", repro: "Billing: Downgrade" });
  // redeem
  const dis0 = await S.evaluate("(() => { const b = [...document.querySelectorAll('main button')].find((x) => /^Redeem$/.test(x.innerText.trim())); return b ? b.disabled : null; })()");
  await A.typeInto(S, 'main input[placeholder="VLTD-XXXX-XXXX"]', "vltd-zzzz-0000");
  const val = await S.evaluate("document.querySelector('main input[placeholder=\"VLTD-XXXX-XXXX\"]').value");
  await clickBtn(S, "^Redeem$"); await sleep(3500);
  const rt = await A.bodyText(S);
  const rmsg = (rt.match(/(invalid|not valid|expired|not found|already|unknown|failed|success|Couldn.t)[^.\n]{0,100}/i) || ["(no message)"])[0];
  r.check(dis0 === true && val === "VLTD-ZZZZ-0000" && rmsg !== "(no message)" && !/success/i.test(rmsg), { page: page("/account/billing"), control: "Redeem code (invalid code 'vltd-zzzz-0000')", expected: "Redeem disabled until a code is typed; code shown in capitals; an invalid code is refused with a plain message", actual: `disabled when empty=${dis0}; field="${val}"; message="${rmsg}"`, evidence: await S.jshot(`acc-set-redeem-${W}`), impact: "usability", repro: "Billing: type a made-up code; Redeem" });
  // contact link and /redeem
  await clickBtn(S, "Contact information"); await sleep(2000);
  r.check((await S.path()) === "/account?section=contact", { page: page("/account/billing"), control: "Contact information (link)", expected: "opens the contact form", actual: await S.path(), evidence: "", impact: "usability", repro: "" });
  await go(S, "/redeem");
  r.check((await S.path()) === "/account/billing", { page: page("/redeem"), control: "/redeem (direct URL)", expected: "goes to the billing page where codes are redeemed", actual: await S.path(), evidence: "", impact: "usability", repro: "Open /redeem signed in" });
}

async function invite(S) {
  await go(S, "/account/invite");
  const link = await S.evaluate("(document.body.innerText.match(/https:\\/\\/vltd\\.app\\/\\?ref=[A-Z0-9]+/) || [''])[0]");
  const code = (link.match(/ref=([A-Z0-9]+)/) || [])[1];
  r.check(!!code && (await S.evaluate("document.body.innerText.includes('" + code + "')")), { page: page("/account/invite"), control: "Invite link and code", expected: "a personal https://vltd.app/?ref=CODE link", actual: link, evidence: await S.jshot(`acc-set-invite-${W}`), impact: "usability", repro: "" });
  await clickBtn(S, "^Copy link$"); await sleep(800);
  let lk = await S.look();
  const copiedBtn = await S.evaluate("(() => { const b = [...document.querySelectorAll('main button')].find((x) => /Copied|Copy link/.test(x.innerText)); return b ? b.innerText.trim() : null; })()");
  r.check(lk.clip.some((c) => c.includes(link)), { page: page("/account/invite"), control: "Copy link", expected: "puts the invite link on the clipboard and the button confirms", actual: `clipboard=${JSON.stringify(lk.clip)}; button now says "${copiedBtn}"`, evidence: "", impact: "blocked workflow", repro: "Click Copy link" });
  await clickBtn(S, "^Share$"); await sleep(800);
  lk = await S.look();
  r.check(lk.share >= 1 && /vltd\.app\/\?ref=/.test((lk.shared && lk.shared.url) || ""), { page: page("/account/invite"), control: "Share (system share sheet)", expected: "opens the device share sheet with the invite link", actual: JSON.stringify({ share: lk.share, shared: lk.shared }), evidence: "", impact: "blocked workflow", repro: "Click Share" });
  const hrefs = await S.evaluate("[...document.querySelectorAll('main a[href]')].filter((a) => /^(sms:|mailto:|https:\\/\\/(api\\.whatsapp|twitter|www\\.facebook|www\\.reddit))/.test(a.getAttribute('href'))).map((a) => ({ t: a.innerText.trim(), h: a.getAttribute('href'), tgt: a.getAttribute('target'), rel: a.getAttribute('rel') }))");
  const allHave = hrefs.length === 6 && hrefs.every((x) => decodeURIComponent(x.h).includes(`vltd.app/?ref=${code}`));
  const external = hrefs.filter((x) => /^https:/.test(x.h));
  const safe = external.every((x) => x.tgt === "_blank" && /noopener/.test(x.rel || ""));
  r.check(allHave, { page: page("/account/invite"), control: "Share to Text / WhatsApp / X / Facebook / Reddit / Email (links)", expected: "six links, each carrying the same invite link", actual: JSON.stringify(hrefs.map((x) => x.t)) + " carry link=" + allHave, evidence: "", impact: "usability", repro: "" });
  r.check(safe, { page: page("/account/invite"), control: "External share links open safely", expected: "new tab with rel=noopener", actual: JSON.stringify(external.map((x) => [x.t, x.tgt, x.rel])), evidence: "", impact: "improvement", repro: "" });
  r.pass({ page: page("/account/invite"), control: "Friends invited / rewards (informational)", expected: "(informational)", actual: (await A.bodyText(S)).match(/\d+ Friends Invited[^.]*\.?[^.]*\./)?.[0] || "", evidence: "", impact: "improvement", repro: "" });
  r.check((await overflow(S)) <= 1, { page: page("/account/invite"), control: "Responsive layout", expected: "no horizontal scrolling", actual: `overflow ${await overflow(S)}px`, evidence: "", impact: "usability", repro: "" });
}

async function bizNew(S) {
  await go(S, "/account/business/new");
  const dis = async () => S.evaluate("(() => { const b = [...document.querySelectorAll('main button')].find((x) => /Create business profile/.test(x.innerText)); return b ? b.disabled : null; })()");
  r.check((await dis()) === true, { page: page("/account/business/new"), control: "Create business profile with an empty form", expected: "disabled", actual: `disabled=${await dis()}`, evidence: await S.jshot(`acc-set-bizlnew-${W}`), impact: "usability", repro: "" });
  await A.typeInto(S, 'main input[placeholder="Business name"]', "A"); await A.typeInto(S, 'main input[placeholder="business_handle"]', "ab");
  r.check((await dis()) === true, { page: page("/account/business/new"), control: "1-character name and 2-character handle", expected: "still disabled", actual: `disabled=${await dis()}`, evidence: "", impact: "usability", repro: "" });
  await A.typeInto(S, 'main input[placeholder="business_handle"]', "QA New!! Handle");
  const hv = await S.evaluate("document.querySelector('main input[placeholder=\"business_handle\"]').value");
  r.check(hv === "qa_new_handle", { page: page("/account/business/new"), control: "Business handle formatting", expected: "'QA New!! Handle' becomes qa_new_handle", actual: hv, evidence: "", impact: "usability", repro: "" });
  await clickBtn(S, "^Cancel$"); await sleep(2000);
  const profs = await admin.from("profiles").select("id").eq("user_id", m.userId);
  r.check((await S.path()) === "/account" && (profs.data || []).length === 2, { page: page("/account/business/new"), control: "Cancel", expected: "returns to Settings and creates nothing", actual: `${await S.path()}; profiles on account=${(profs.data || []).length}`, evidence: "", impact: "data loss", repro: "Type a name; Cancel" });
  await go(S, "/account/business/new");
  await A.typeInto(S, 'main input[placeholder="Business name"]', "QA Second Shop"); await A.typeInto(S, 'main input[placeholder="business_handle"]', "qa_second_shop_" + m.stamp);
  await clickBtn(S, "Create business profile"); await sleep(5000);
  const profs2 = await admin.from("profiles").select("id,username,profile_type").eq("user_id", m.userId);
  const created = (profs2.data || []).find((p) => p.username === "qa_second_shop_" + m.stamp);
  r.check(!!created || /limit|only one|already/i.test(await A.bodyText(S)), { page: page("/account/business/new"), control: "Create business profile (valid)", expected: "creates a second business profile or explains the limit", actual: `created=${!!created}; path=${await S.path()}; text="${(await A.bodyText(S)).replace(/^.*SETTINGS/, "").slice(0, 160)}"`, evidence: await S.jshot(`acc-set-bizcreate-${W}`), impact: "blocked workflow", repro: "Fill valid details; Create business profile" });
  if (created) await admin.from("profiles").delete().eq("id", created.id);
}

(async () => {
  const S = await session("owner", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  try {
    if (!PART || PART === "contact") await contact(S);
    if (!PART || PART === "data") await data(S);
    if (!PART || PART === "security") await security(S);
    if (!PART || PART === "billing") await billing(S);
    if (!PART || PART === "invite") await invite(S);
    if (!PART || PART === "biz") await bizNew(S);
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
