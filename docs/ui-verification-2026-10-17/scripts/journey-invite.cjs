// LIVE: the invite page has no reward promise and ordinary invitation sharing still works. Synthetic account.
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
(async () => {
  const m = man();
  const S = await browser(BASE, { width: 1000, height: 900 });
  try {
    await S.go("/account/invite"); await S.waitFor("/Invite friends/i.test(document.body.innerText) && document.body.innerText.includes('/?ref=')", 120000, "invite page with link"); await sleep(2500);
    const t = await S.text(); const flat = t.replace(/\n+/g, " | ");
    console.log("PAGE:", flat.slice(flat.indexOf("Invite friends"), flat.indexOf("Invite friends") + 700));
    check("[invite] no '+1 free Exhibition', 'Exhibition' reward, 'earn', 'bonus' or 'unlock' wording anywhere on the page", !/free exhibition|bonus|\bearn|unlock|\+\s?\d\s*exhibition|your exhibition limit/i.test(t), t.match(/.{0,50}(free exhibition|bonus|earn|unlock|exhibition limit).{0,50}/i)?.[0]);
    check("[invite] the page says plainly that invitation rewards are not available right now", /Invitation rewards are not available right now/.test(t));
    check("[invite] the invite link is shown (…/?ref=CODE) and matches the account's own code", new RegExp("/\?ref=" + ((await admin.from("referral_codes").select("code").eq("user_id", m.userId).maybeSingle()).data?.code || "NOCODE")).test(t));
    const hrefs = await S.evaluate("[...document.querySelectorAll('a')].map((a) => ({ t: a.textContent.trim(), h: a.getAttribute('href') || '' })).filter((x) => /^(Text|WhatsApp|X|Facebook|Reddit|Email)$/.test(x.t))");
    check("[invite] the six share targets are still there (Text, WhatsApp, X, Facebook, Reddit, Email)", hrefs.length === 6, hrefs.map((x) => x.t));
    check("[invite] every share target carries the invite link and a reward-free message", hrefs.every((x) => decodeURIComponent(x.h).includes("/?ref=") ) && hrefs.every((x) => !/exhibition|free|bonus/i.test(decodeURIComponent(x.h).replace(/vault app/i, ""))), hrefs.map((x) => decodeURIComponent(x.h).slice(0, 140)));
    await S.evaluate("(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (s) => { window.__copied = s; return Promise.resolve(); } }, configurable: true }); return true; })()");
    await S.clickText("Copy( link)?|Copy"); await sleep(800);
    const copied = await S.evaluate("window.__copied || ''");
    check("[invite] Copy puts the invite link on the clipboard", /\/\?ref=[A-Z0-9]{9}$/.test(copied), copied);
    const stats = await S.evaluate("[...document.querySelectorAll('p')].map((p) => p.textContent.trim()).filter((x) => /Friends Invited|Bonus|Total/.test(x))");
    check("[invite] only 'Friends Invited' remains of the stats (no Bonus Earned / Total Bonus)", JSON.stringify(stats) === JSON.stringify(["Friends Invited"]), stats);
    await S.go("/?ref=" + (await admin.from("referral_codes").select("code").eq("user_id", m.userId).maybeSingle()).data?.code); await sleep(6000);
    check("[invite] opening a link with ?ref=CODE still loads the app normally", (await S.text()).length > 200);
  } catch (e) { console.log("STOPPED", e.message); fail++; }
  finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
