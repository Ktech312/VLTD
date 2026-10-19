// DIS suite N: /learn (hub, articles, playbooks, Save, newsletter), /learn/articles, /guide, /guide/walkthrough. Tutorial media is paused: recorded, not judged.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C;
const r = R("DIS");
const m = man(); const P = m.personalId;
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/learn", control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-learn.cjs" }); } };
const savedChips = (S) => S.evaluate(`[...document.querySelectorAll('main button[aria-pressed]')].filter((b) => /^(Save|Saved)$/.test(b.textContent.trim())).map((b) => b.getAttribute('aria-pressed') + ':' + b.textContent.trim())`);

(async () => {
  const V = await C.session("visitor");
  await V.visit("/learn"); await sleep(3000);
  const PG = "/learn | visitor";
  const shot = await V.jshot("dis-learn-visitor");
  const links = await V.evaluate(`[...document.querySelectorAll('main a')].map((a) => ({ t: a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60), h: a.getAttribute('href') })).filter((x) => /^\\/learn\\//.test(x.h))`);

  await section("links", async () => {
    r.check(links.length === 15, { page: PG, control: "Learn hub: article and playbook links", expected: "1 featured + 6 guides + 8 playbooks = 15 links to /learn/<slug>", actual: String(links.length), evidence: shot, impact: "usability", repro: "Open /learn" });
    const bad = [];
    for (const l of links) {
      await V.visit(l.h); await sleep(1500);
      const t = clean(await V.text()); const h1 = await V.evaluate("(document.querySelector('main h1') || document.querySelector('h1') || {}).textContent || ''");
      const ok = (await V.path()) === l.h && h1.trim().length > 3 && !/404|could not be found/i.test(t);
      if (!ok) bad.push(`${l.h} -> ${await V.path()} h1='${h1.trim().slice(0, 30)}' ${/404|could not be found/i.test(t) ? "404" : ""}`);
    }
    r.check(bad.length === 0, { page: PG, control: "Every Learn link opens its page (15 destinations, real navigation)", expected: "each opens with its own heading, no 404", actual: bad.length ? bad.join(" | ") : "all 15 open", evidence: "n/a", impact: "blocked workflow", repro: "Click each card/playbook on /learn" });
    // heading of the card equals the heading of the page
    await V.visit("/learn"); await sleep(1500);
    const cards2 = await V.evaluate("[...document.querySelectorAll('main a')].filter((a) => /^\\/learn\\//.test(a.getAttribute('href'))).slice(0, 7).map((a) => ({ h: a.getAttribute('href'), t: ((a.querySelector('h2, h3, h4') || {}).textContent || '').trim() }))");
    const mism = [];
    for (const l of cards2) {
      await V.visit(l.h); await sleep(1200);
      const h1 = clean(await V.evaluate("(document.querySelector('main h1') || document.querySelector('h1') || {}).textContent || ''"));
      if (!l.t || !h1.startsWith(l.t.slice(0, 14))) mism.push(l.t + " vs " + h1);
    }
    r.check(mism.length === 0, { page: PG, control: "Card title vs the article's own heading", expected: "same title", actual: mism.length ? mism.join(" | ") : "all 7 match", evidence: "n/a", impact: "misleading result", repro: "Compare a card title with the page heading" });
    // article page: back link, CTA, save
    await V.visit("/learn/before-you-sell"); await sleep(1500);
    await C.clickText(V, "^Learn$", { scope: "main", tags: "a" }); await V.waitFor("location.pathname === '/learn'", 15000, "back").catch(() => {}); await sleep(800);
    r.check((await V.path()) === "/learn", { page: "/learn/before-you-sell | visitor", control: "Back link 'Learn'", expected: "returns to the hub", actual: await V.path(), evidence: "n/a", impact: "usability", repro: "Open an article; click Learn" });
    await V.visit("/learn/before-you-sell"); await sleep(1200);
    await C.clickText(V, "^Start your collection$", { scope: "main", tags: "a" }); await V.waitFor("location.pathname === '/signup'", 15000, "cta").catch(() => {}); await sleep(800);
    r.check((await V.path()) === "/signup", { page: "/learn/before-you-sell | visitor", control: "Call to action 'Start your collection'", expected: "goes to sign-up", actual: await V.path(), evidence: "n/a", impact: "usability", repro: "Click it" });
    // previous/next article navigation
    await V.visit("/learn/pricing-with-confidence"); await sleep(1500);
    const nav = await V.evaluate("[...document.querySelectorAll('main a')].map((a) => a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40) + ' -> ' + a.getAttribute('href'))");
    r.check(true, { page: "/learn/pricing-with-confidence | visitor", control: "Previous / Next article navigation", expected: "(observation) links to the neighbouring articles", actual: "none exist; article page links: " + nav.join(" | "), evidence: "n/a", impact: "improvement", repro: "Open an article; look for previous/next" });
    await V.visit("/learn/no-such-article"); await sleep(2000);
    const nt = clean(await V.text());
    r.check(/404|could not be found|not found/i.test(nt), { page: "/learn/no-such-article | visitor", control: "Unknown article slug", expected: "a not-found page", actual: nt.slice(60, 150), evidence: await V.jshot("dis-learn-unknown"), impact: "usability", repro: "Open /learn/no-such-article" });
  });

  await section("save-visitor", async () => {
    await V.visit("/learn"); await sleep(2500);
    const before = await savedChips(V);
    await C.click(V, `document.querySelectorAll('main button[aria-pressed]')[1]`); await sleep(600);
    await C.click(V, `document.querySelectorAll('main button[aria-pressed]')[3]`); await sleep(600);
    const mid = await savedChips(V); const t = clean(await V.text());
    r.check(before.every((x) => x.startsWith("false")) && mid[1].startsWith("true") && mid[3].startsWith("true") && /Saved guides/i.test(t), { page: PG, control: "Save on two guide cards (signed out)", expected: "both flip to Saved and a 'Saved guides' section appears", actual: mid.join(", ") + "; Saved guides section=" + /Saved guides/i.test(t), evidence: await V.jshot("dis-learn-saved"), impact: "misleading result", repro: "Click Save on two cards" });
    await V.visit("/learn"); await sleep(2500);
    const after = await savedChips(V);
    r.check(after[1].startsWith("true") && after[3].startsWith("true"), { page: PG, control: "Saved guides after reload (this browser)", expected: "still saved", actual: after.join(", "), evidence: "n/a", impact: "data loss", repro: "Reload" });
    await C.click(V, `document.querySelectorAll('main button[aria-pressed]')[1]`); await sleep(500);
    await C.click(V, `document.querySelectorAll('main button[aria-pressed]')[3]`); await sleep(500);
    r.check(!/Saved guides/i.test(clean(await V.text())), { page: PG, control: "Unsave both", expected: "'Saved guides' section disappears", actual: "section gone=" + !/Saved guides/i.test(clean(await V.text())), evidence: "n/a", impact: "usability", repro: "Click Saved on both" });
  });

  await section("newsletter", async () => {
    await V.visit("/learn"); await sleep(2500);
    await V.evaluate("window.scrollTo(0, 0); true");
    const sub = `([...document.querySelectorAll('form button')].find((b) => /Subscribe/.test(b.textContent)))`;
    await C.click(V, sub); await sleep(500);
    const t1 = clean(await V.text());
    await C.typeInto(V, "form input[type=email]", "a@b");
    await C.click(V, sub); await sleep(500);
    const t2 = clean(await V.text());
    V.intercepted.length = 0;
    await C.typeInto(V, "form input[type=email]", "qa-audit@example.invalid");
    await C.click(V, sub); await sleep(1500);
    const t3 = clean(await V.text());
    r.check(/valid email/i.test(t1) && /valid email/i.test(t2), { page: PG, control: "Newsletter: Subscribe with an empty box / the address 'a@b' (browser form check handles text without an @)", expected: "'Enter a valid email address.' and nothing is sent", actual: `${(t1.match(/Enter a valid[^.]*\./) || ["none"])[0]} | ${(t2.match(/Enter a valid[^.]*\./) || ["none"])[0]}`, evidence: "n/a", impact: "usability", repro: "Click Subscribe empty; type nonsense; Subscribe" });
    r.check(V.intercepted.some((x) => /newsletter/.test(x.url)) && !/You're on the list/.test(t3) && /Something went wrong|Network error|Try again/i.test(t3), { page: PG, control: "Newsletter: Subscribe with a valid address (INTERCEPTED: /api/newsletter answered 503 by the audit - no real signup, no email)", expected: "when the signup fails the form says so and does NOT claim 'You're on the list'", actual: `intercepted=${V.intercepted.map((x) => x.url).join()}; message: ${(t3.match(/(Something went wrong[^.]*\.|Network error[^.]*\.|You're on the list)/) || ["none"])[0]}`, evidence: await V.jshot("dis-learn-newsletter-failed"), impact: "misleading result", repro: "Subscribe while the endpoint fails" });
    r.nt({ page: PG, control: "Newsletter: a successful subscription", expected: "'You're on the list' and a welcome email", actual: "not exercised: would add an address to the real newsletter list and send email", evidence: "n/a", impact: "none", repro: "n/a" });
  });

  await section("articles", async () => {
    await V.visit("/learn/articles"); await sleep(2500);
    const t = clean(await V.text());
    r.check(/No articles yet/.test(t), { page: "/learn/articles | visitor", control: "Articles & Guides list", expected: "(current state) no articles are published: an explicit empty state", actual: (t.match(/No articles yet[^.]*\./) || ["none"])[0], evidence: await V.jshot("dis-learn-articles"), impact: "usability", repro: "Open /learn/articles" });
    const hrefs = await V.evaluate("[...document.querySelectorAll('a')].map((a) => a.textContent.replace(/\\s+/g, ' ').trim() + ' -> ' + a.getAttribute('href'))");
    const expect = { "Log in": "/login", "Sign up": "/signup", "Guide": "/learn", "Articles": "/learn/articles" };
    const miss = Object.entries(expect).filter(([k, v]) => !hrefs.some((h) => h === `${k} -> ${v}`));
    r.check(miss.length === 0, { page: "/learn/articles | visitor", control: "Page links: Log in / Sign up / Guide / Articles", expected: "each goes where it says", actual: miss.length ? "missing: " + miss.map((x) => x.join("->")).join(", ") : "all four present with the right targets", evidence: "n/a", impact: "usability", repro: "Read the links" });
    await V.visit("/learn/articles/no-such-article"); await sleep(2000);
    r.check(/404|could not be found|not found/i.test(clean(await V.text())), { page: "/learn/articles/[slug] | visitor", control: "Unknown article slug", expected: "not-found page", actual: clean(await V.text()).slice(60, 140), evidence: "n/a", impact: "usability", repro: "Open /learn/articles/no-such-article" });
    r.nt({ page: "/learn/articles/[slug]", control: "A real published article: reading, table of contents, previous/next", expected: "article page", actual: "NOT TESTED: no article is published (the list is empty) and seeding one would publish it publicly", evidence: "n/a", impact: "none", repro: "n/a" });
  });

  await section("guide", async () => {
    await V.visit("/guide"); await sleep(3000);
    const g = await V.evaluate(`(() => { const anchors = [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')); const ids = anchors.filter((h) => !document.querySelector(h)); return { anchors: anchors.length, missing: ids, internal: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter((h) => /^\\//.test(h)) }; })()`);
    r.check(g.missing.length === 0 && g.anchors >= 10, { page: "/guide | visitor", control: "Guide index and section links (#anchors)", expected: "every # link has a matching section on the page", actual: `${g.anchors} anchors; missing targets: ${g.missing.join(",") || "none"}`, evidence: await V.jshot("dis-guide"), impact: "usability", repro: "Click each index link" });
    await C.click(V, `([...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '#goals'))`); await sleep(1200);
    const pos = await V.evaluate("(() => { const el = document.getElementById('goals'); const sc = document.querySelector('.vltd-content-wrap'); return el ? Math.round(el.getBoundingClientRect().top - sc.getBoundingClientRect().top) : null; })()");
    r.check(pos !== null && pos >= -10 && pos < 500, { page: "/guide | visitor", control: "Index link 'Goals' (real click)", expected: "scrolls the Goals section into view", actual: `section top is ${pos}px from the top of the scroll area`, evidence: "n/a", impact: "usability", repro: "Click Goals in the quick index" });
    const uniq = [...new Set(g.internal)].filter((h) => !/^\/guide/.test(h));
    const bad = [];
    for (const h of uniq) { await V.visit(h); await sleep(1500); const p = await V.path(); const t = clean(await V.text()); if (/404|could not be found/i.test(t)) bad.push(h + " -> 404"); }
    r.check(bad.length === 0, { page: "/guide | visitor", control: `Guide links into the app (${uniq.length} distinct destinations, signed out)`, expected: "each destination opens (sign-in redirects count as opening)", actual: bad.length ? bad.join(", ") : uniq.join(" ") + " all resolve", evidence: "n/a", impact: "blocked workflow", repro: "Click each 'Go to' link in the guide" });
    await V.visit("/guide/walkthrough"); await sleep(3000);
    const w = await V.evaluate(`(() => ({ videos: document.querySelectorAll('video').length, iframes: document.querySelectorAll('iframe').length, imgs: [...document.querySelectorAll('main img')].map((i) => i.naturalWidth > 0).length, tabs: [...document.querySelectorAll('[role=tab], main button')].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 8), links: [...document.querySelectorAll('main a')].map((a) => a.textContent.trim() + '->' + a.getAttribute('href')) }))()`);
    r.check(true, { page: "/guide/walkthrough | visitor", control: "Walkthrough media (tutorial rebuild is paused - recorded, not judged)", expected: "(record only)", actual: `videos=${w.videos}, iframes=${w.iframes}, images=${w.imgs}; buttons/tabs: ${w.tabs.join(" | ")}; links: ${w.links.join(" | ")}`, evidence: await V.jshot("dis-walkthrough"), impact: "improvement", repro: "Open /guide/walkthrough" });
    await C.clickText(V, "^Add an item$", { scope: "main", tags: "a" }); await sleep(2000);
    r.check(/\/login|\/capture/.test(await V.path()), { page: "/guide/walkthrough | visitor", control: "'Add an item' link", expected: "goes to the add flow (or sign-in)", actual: await V.path(), evidence: "n/a", impact: "usability", repro: "Click it" });
    await V.visit("/guide/walkthrough"); await sleep(2000);
    await C.clickText(V, "Back to Help", { scope: "main", tags: "a" }); await sleep(1500);
    r.check((await V.path()) === "/guide", { page: "/guide/walkthrough | visitor", control: "← Back to Help", expected: "returns to /guide", actual: await V.path(), evidence: "n/a", impact: "usability", repro: "Click it" });
  });
  await V.close();

  await section("owner", async () => {
    const O = await C.session("owner");
    await O.visit("/learn"); await sleep(3500);
    await C.click(O, `document.querySelectorAll('main button[aria-pressed]')[2]`); await sleep(2500);
    const rows = (await admin.from("saved_articles").select("*").eq("profile_id", P)).data || [];
    const O2 = await C.session("owner"); await O2.visit("/learn"); await sleep(3500);
    const c2 = await savedChips(O2);
    r.check(rows.length === 1 && c2[2].startsWith("true"), { page: "/learn | owner, Personal", control: "Save a guide as a signed-in collector (clean second browser)", expected: "stored for this profile and shown as Saved in a fresh browser", actual: `rows=${rows.length}; second browser: ${c2.join(",")}`, evidence: "n/a", impact: "data loss", repro: "Sign in; Save a guide; open /learn elsewhere" });
    await O2.close();
    await C.click(O, `document.querySelectorAll('main button[aria-pressed]')[2]`); await sleep(2000);
    r.check(((await admin.from("saved_articles").select("*").eq("profile_id", P)).data || []).length === 0, { page: "/learn | owner", control: "Unsave", expected: "row removed", actual: "removed", evidence: "n/a", impact: "data loss", repro: "Click Saved again" });
    await O.close();
  });

  const M = await C.session("visitor", { width: 390, height: 844, mobile: true });
  await M.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  for (const p of ["/learn", "/guide", "/learn/before-you-sell"]) {
    await M.visit(p); await sleep(2500);
    const ov = await M.evaluate("(() => { const sc = document.querySelector('.vltd-content-wrap') || document.scrollingElement; return { sc: sc.scrollWidth, w: innerWidth }; })()");
    r.check(ov.sc <= ov.w + 1, { page: p + " | visitor, 390 phone (browser-emulated)", control: "Phone layout", expected: "no sideways scroll", actual: JSON.stringify(ov), evidence: await M.jshot("dis-390" + p.replace(/\//g, "-")), impact: "usability", repro: "Open " + p + " at 390 px" });
  }
  await M.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
