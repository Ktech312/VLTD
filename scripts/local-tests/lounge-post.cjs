const L = require("./lib.cjs"); const { sleep, NL, check } = L;
(async () => { const s = await L.open({ width: 1280, height: 1400 });
  try { await s.go("/community-board", 9000); await s.dismiss();
    // 1. empty post is refused
    await s.mclick("Post Update", false); await sleep(900);
    await s.mclick("Post to Lounge", false); await sleep(1200);
    let rows = await L.dump("lounge_posts"); check("empty post not saved", rows.length === 1, rows.length);
    let t = await s.text(); check("empty post shows a reason or stays open", /title|write|required|empty|add/i.test(t) || /What's the update/.test(t), t.slice(0, 200));
    // 2. real post
    await s.setField("input[placeholder*=title i], input[aria-label*=title i]", "Local test thread");
    await s.setField("textarea", "Body of the local test post.");
    await s.mclick("Post to Lounge", false); await sleep(2000);
    rows = await L.dump("lounge_posts"); const mine = rows.find((r) => /Local test/.test(r.title || "") || /Body of the local/.test(r.body || ""));
    check("post saved with body", !!mine, rows.map((r) => r.title));
    check("post is owned by the signed-in profile", mine && mine.profile_id === L.P, mine);
    t = await s.text(); check("post appears in feed", /Body of the local test post/.test(t), t.slice(0, 300));
    check("composer closed after posting", !(await s.evaluate(`!!document.querySelector("textarea")`)), 0);
    // 3. open thread, comment
    const opened = await s.mclick("Local test thread", false) || await s.mclick("0 comments", false); await sleep(1500);
    t = await s.text(); console.log("after open:", t.split(NL).filter((x) => x.trim()).slice(6, 40).join(" | ").slice(0, 700));
    console.log("fields:", await s.evaluate(`JSON.stringify([...document.querySelectorAll("input,textarea,button")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.tagName[0] + ":" + (e.getAttribute("aria-label") || e.placeholder || e.innerText || "").trim().split(String.fromCharCode(10)).join(" ").slice(0, 26)).slice(0, 50))`));
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0); })();
