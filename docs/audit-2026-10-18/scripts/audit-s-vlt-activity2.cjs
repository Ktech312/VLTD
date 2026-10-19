// VLT suite 12b: re-runs for /notifications (bug reply alert is a plain block, not a link) and long waits for the refused-connection states of /notifications and /activity. Seeds and removes its own rows.
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, admin, blockRest } = X; const r = R("VLT");
const crypto = require("crypto");
(async () => {
  const m = X.man(); const P = m.personalId; const viewer = m.k;
  const bugId = crypto.randomUUID(); const cmId = crypto.randomUUID(); const convId = crypto.randomUUID(); const dmIds = [crypto.randomUUID(), crypto.randomUUID()];
  const gal = (await admin.from("galleries").select("id,title,visibility").eq("profile_id", P)).data; const pubG = gal.find((g) => g.visibility === "PUBLIC") || gal[0];
  const uid = (await admin.from("profiles").select("user_id").eq("id", P).single()).data.user_id;
  const cleanup = async () => { await admin.from("comments").delete().eq("id", cmId); await admin.from("direct_messages").delete().in("id", dmIds); await admin.from("conversations").delete().eq("id", convId); await admin.from("bug_reports").delete().eq("id", bugId); };
  await cleanup();
  await admin.from("bug_reports").insert({ id: bugId, user_id: uid, email: m.email, message: "QA VLT bug report body", status: "resolved", admin_reply: "QA VLT admin reply: fixed in the next release", admin_replied_at: new Date().toISOString() });
  await admin.from("comments").insert({ id: cmId, exhibition_id: pubG.id, author_id: viewer.profileId, body: "QA VLT short comment" });
  await admin.from("conversations").insert({ id: convId, profile_a_id: P, profile_b_id: viewer.profileId, last_message_at: new Date().toISOString() });
  await admin.from("direct_messages").insert([{ id: dmIds[0], conversation_id: convId, sender_profile_id: viewer.profileId, body: "QA VLT first message" }, { id: dmIds[1], conversation_id: convId, sender_profile_id: viewer.profileId, body: "QA VLT second message" }]);
  const S = await X.session("owner");
  try {
    r.pass({ page: "/notifications | owner, Personal", control: "(test note) corrections for VLT-445, 448, 449, 458, 459, 466", expected: "n/a", actual: "First-run results stay. My extractors only looked at links, but the 'Reply to your bug report' alert is a plain block with no link (so it was missed); the Activity row counter missed one subtitle type and did not expect the seeded comment event (47 = 44 items + 2 logged + 1 comment); my text pattern for the value panel did not match the panel's own line breaks (the panel itself is correct, see screenshot vlt-activity-valued.jpg).", evidence: "shots/vlt-activity-valued.jpg", impact: "none", repro: "audit-s-vlt-activity.cjs vs 2" });
    await S.visit("/notifications"); await sleep(3000);
    const cards = await S.evaluate("[...document.querySelectorAll('div.flex.flex-col.gap-3 > *')].map((c) => ({ tag: c.tagName, href: c.getAttribute('href'), t: c.innerText.replace(/\\s+/g, ' ').trim() })).filter((c) => /ago|just now/.test(c.t))");
    const bug = cards.find((c) => /Reply to your bug report/i.test(c.t)); const cm = cards.find((c) => /New comment/.test(c.t)); const dm = cards.find((c) => /new messages/i.test(c.t));
    r.check(cards.length === 3 && !!bug && !!cm && !!dm, { page: "/notifications | owner, Personal | comment, 2 unread messages, bug reply", control: "Alerts list (re-run)", expected: "Three alerts: new comment, '2 new messages', 'Reply to your bug report'", actual: JSON.stringify(cards), evidence: await S.jshot("vlt-alerts-list2"), impact: "misleading result", repro: "Seed; open /notifications" });
    r.check(bug && bug.t.includes("QA VLT admin reply") && !bug.href, { page: "/notifications | owner, Personal", control: "'Reply to your bug report' alert content", expected: "Shows the admin's reply text", actual: JSON.stringify(bug), impact: "misleading result", repro: "read" });
    r.pass({ page: "/notifications | owner, Personal", control: "Bug-reply alert has no link", expected: "(observation) shown as plain text; nothing to open", actual: `href=${bug && bug.href}`, impact: "improvement", repro: "inspect" });
    // refused: long waits
    for (const [path, label] of [["/notifications", "Alerts"], ["/activity", "Activity"]]) {
      const F = await X.session("owner");
      try {
        await F.visit("/robots.txt"); await blockRest(F, true); await F.go(path);
        let tx = "", i = 0; for (; i < 80; i++) { await sleep(1000); tx = squash(await F.text()); if (i > 3 && tx.includes(label) && !/Loading/.test(tx)) break; }
        const stuck = /Loading/.test(tx); const empty = /No activity yet/.test(tx); const err = /Could not load|couldn.t load/i.test(tx);
        r.check(!stuck && !empty, { page: `${path} | data connection refused, nothing saved on this device (waited up to 70 s)`, control: `${label} when the cloud refuses (long wait)`, expected: "Ends in a could-not-load message with a way to retry; neither 'Loading…' for ever nor 'No activity yet'", actual: `after ${i}s: ${stuck ? "still 'Loading…'" : empty ? "'No activity yet' (reads as an empty account)" : err ? "error message" : "other"}: ${tx.slice(tx.indexOf(label) >= 0 ? tx.indexOf(label) : 0, 220)}`, evidence: await F.jshot("vlt-" + label.toLowerCase() + "-refused-long"), impact: "misleading result", repro: `Fresh browser; refuse supabase REST; open ${path}; wait` });
      } finally { await F.close(); }
    }
  } finally { await S.close(); await cleanup(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
