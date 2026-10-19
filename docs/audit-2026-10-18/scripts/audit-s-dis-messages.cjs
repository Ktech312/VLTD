// DIS suite M: /messages between the two synthetic QA accounts only (owner <-> unrelated viewer). Private 1:1 table: visible to the two participants only.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C;
const r = R("DIS");
const m = man(); const P = m.personalId; const K = m.k.profileId;
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/messages", control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-messages.cjs" }); } };
const convRows = async () => (await admin.from("conversations").select("id,profile_a_id,profile_b_id,last_message_at").or(`profile_a_id.in.(${P},${K}),profile_b_id.in.(${P},${K})`)).data.filter((c) => [P, K].includes(c.profile_a_id) && [P, K].includes(c.profile_b_id));
const msgRows = async (cid) => (await admin.from("direct_messages").select("id,body,sender_profile_id,read_at,created_at").eq("conversation_id", cid).order("created_at")).data;
const listText = (S) => S.evaluate(`[...document.querySelectorAll('main [role=button]')].map((d) => { const t = d.innerText.replace(/\\s+/g, ' '); return t.length > 90 ? t.slice(0, 50) + ' ... ' + t.slice(-14) : t; })`);
const bubbles = (S) => S.evaluate(`[...document.querySelectorAll('main .whitespace-pre-wrap, main [class*=rounded-2xl], main [class*=rounded-[14px]]')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim()).filter(Boolean)`);

(async () => {
  // make the viewer findable like a real collector who finished onboarding and is public
  await admin.from("profiles").update({ is_public: true, display_name: "QA dis Viewer" }).eq("id", K);
  await admin.from("public_profiles").upsert({ profile_id: K, display_name: "QA dis Viewer" });
  for (const c of await convRows()) await admin.from("conversations").delete().eq("id", c.id);

  const V = await C.session("visitor");
  await V.visit("/messages"); await sleep(2500);
  r.check(/\/login\?next=%2Fmessages/.test(await V.path()), { page: "/messages | signed-out visitor", control: "Signed-out access", expected: "sent to sign in", actual: await V.path(), evidence: "n/a", impact: "privacy/data loss", repro: "Open /messages signed out" });
  await V.close();

  const O = await C.session("owner"); const W = await C.session("viewer");
  const PG = "/messages | owner (QA Visual Collection) <-> viewer (QA dis Viewer)";
  await section("empty+compose", async () => {
    await O.visit("/messages"); await sleep(3500);
    const t = clean(await O.text());
    r.check(/No conversations yet/.test(t) && /New Message/.test(t), { page: PG, control: "Inbox with no conversations", expected: "'No conversations yet' guidance and a New Message button", actual: (t.match(/No conversations yet[^.]*\./) || ["none"])[0], evidence: await O.jshot("dis-messages-empty"), impact: "usability", repro: "Open /messages with no messages" });
    await C.clickText(O, "New Message", { scope: "body", tags: "button" }); await sleep(600);
    const dlg = clean(await O.text());
    await C.typeInto(O, "input[placeholder='Search collectors by name…']", "zzqqxx"); await sleep(1500);
    const none = clean(await O.text());
    await C.typeInto(O, "input[placeholder='Search collectors by name…']", "QA dis Viewer"); await sleep(2000);
    const found = await O.evaluate(`[...document.querySelectorAll('button')].filter((b) => /QA dis Viewer/.test(b.textContent)).map((b) => b.textContent.replace(/\\s+/g, ' ').trim())`);
    const self = await O.evaluate(`[...document.querySelectorAll('button')].filter((b) => /QA Visual Collection/.test(b.textContent) && b.closest('[class*=fixed]')).length`);
    r.check(found.length === 1 && self === 0, { page: PG, control: "New Message: search collectors by name", expected: "typing the viewer's name lists exactly that collector; yourself is not offered; a nonsense name shows a no-results line", actual: `found=${found.join("|")}; self listed=${self}; nonsense text: ${(none.match(/No (collectors|results|matches)[^.]*/i) || ["no message"])[0]}`, evidence: await O.jshot("dis-messages-compose"), impact: "usability", repro: "New Message; type the other user's name" });
    r.check(/No (collectors|results|matches)/i.test(none), { page: PG, control: "New Message: no collector matches", expected: "an explicit 'no collectors found' line", actual: (none.match(/No (collectors|results|matches)[^.]*/i) || ["nothing shown"])[0], evidence: "n/a", impact: "usability", repro: "New Message; type zzqqxx" });
    await C.click(O, `([...document.querySelectorAll('button')].find((b) => /QA dis Viewer/.test(b.textContent)))`); await sleep(3000);
    const cv = await convRows();
    r.check(cv.length === 1 && [cv[0].profile_a_id, cv[0].profile_b_id].sort().join() === [P, K].sort().join(), { page: PG, control: "Picking a collector starts the conversation", expected: "exactly one conversation between the two profiles (canonical pair) and the thread opens", actual: `conversations=${cv.length}; thread open=${await O.evaluate("!!document.querySelector(\"input[placeholder^='Write a message']\")")}`, evidence: await O.jshot("dis-messages-thread-open"), impact: "blocked workflow", repro: "New Message; pick the collector" });
  });

  await section("name", async () => {
    const lt = await listText(O);
    const head = await O.evaluate("document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)");
    r.check(lt.some((x) => /QA dis Viewer/.test(x)), { page: PG, control: "Conversation list: who you are talking to", expected: "the other collector's public name (QA dis Viewer, who is a public collector with a public profile)", actual: "list row: " + lt.join(" | ") + " (the thread header also reads 'Collector')", evidence: await O.jshot("dis-messages-name"), impact: "misleading result", repro: "Start a conversation with a collector; read the name in the list and the thread header" });
  });

  await section("send", async () => {
    const send = `([...document.querySelectorAll('button')].find((b) => /^Send$/i.test(b.textContent.trim()) || /Send/i.test(b.getAttribute('aria-label') || '')))`;
    const dis0 = await O.evaluate(`(() => { const b = ${send}; return b ? b.disabled : null; })()`);
    r.check(dis0 === true, { page: PG, control: "Send with an empty message", expected: "Send is disabled", actual: String(dis0), evidence: "n/a", impact: "usability", repro: "Open a thread; look at Send" });
    await C.typeInto(O, "input[placeholder^='Write a message']", "   ");
    const dis1 = await O.evaluate(`(() => { const b = ${send}; return b ? b.disabled : null; })()`);
    r.check(dis1 === true, { page: PG, control: "Send with only spaces", expected: "Send stays disabled", actual: String(dis1), evidence: "n/a", impact: "usability", repro: "Type spaces" });
    await C.typeInto(O, "input[placeholder^='Write a message']", "[QA audit] hello from the owner");
    await C.click(O, send); await sleep(2500);
    const cid = (await convRows())[0].id; let ms = await msgRows(cid);
    r.check(ms.length === 1 && ms[0].body === "[QA audit] hello from the owner" && ms[0].sender_profile_id === P && /hello from the owner/.test(clean(await O.text())) && (await O.evaluate("document.querySelector(\"input[placeholder^='Write a message']\").value")) === "", { page: PG, control: "Send (real click)", expected: "one message row from the owner's profile; it appears in the thread; the box empties", actual: `rows=${ms.length}; body='${ms[0] && ms[0].body}'; sender ok=${ms[0] && ms[0].sender_profile_id === P}`, evidence: await O.jshot("dis-messages-sent"), impact: "data loss", repro: "Type a message; click Send" });
    // Enter / Shift+Enter in the single-line box
    await C.typeInto(O, "input[placeholder^='Write a message']", "[QA audit] enter key message");
    await C.click(O, "document.querySelector(\"input[placeholder^='Write a message']\")");
    const n0 = (await msgRows(cid)).length;
    await O.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers: 8 });
    await O.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers: 8 }); await sleep(1500);
    const n1 = (await msgRows(cid)).length;
    await C.key(O, "Enter", "Enter", 13); await sleep(2500);
    const after = await msgRows(cid);
    r.check(n1 === n0 && after.length === n0 + 1 && after[after.length - 1].body === "[QA audit] enter key message", { page: PG, control: "Enter key / Shift+Enter in the message box", expected: "Shift+Enter does not send; Enter sends", actual: "Shift+Enter: messages " + n0 + " -> " + n1 + "; Enter: -> " + after.length, evidence: "n/a", impact: "usability", repro: "Type; Shift+Enter; then Enter" });
    r.check(true, { page: PG, control: "Message box is a single line", expected: "(observation) the box is a one-line input, so a message cannot contain line breaks although it allows up to 4,000 characters", actual: "input element (Shift+Enter does nothing)", evidence: "n/a", impact: "improvement", repro: "Try to write two lines" });
    // very long message
    const long = "x".repeat(4100);
    await O.evaluate(`(() => { const t = document.querySelector("input[placeholder^='Write a message']"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(t, ${JSON.stringify(long)}); t.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await sleep(300);
    const ml = await O.evaluate("document.querySelector(\"input[placeholder^='Write a message']\").maxLength");
    await C.click(O, send); await sleep(2500);
    const afterLong = await msgRows(cid); const tx = clean(await O.text());
    const stored = afterLong.length > after.length ? afterLong[afterLong.length - 1].body.length : 0;
    r.check(afterLong.length === after.length || (stored === 4000 && /4,?000|too long|limit/i.test(tx)), { page: PG, control: "Send a 4,100-character message (limit is 4,000)", expected: "refused, or trimmed WITH a visible reason; never silently shortened and never stored over the limit", actual: `input maxLength=${ml}; messages ${after.length} -> ${afterLong.length}; stored length=${stored}; visible notice: ${(tx.match(/(too long|4,?000|limit)[^.]*/i) || ["none"])[0]}; draft kept=${(await O.evaluate("document.querySelector(\"input[placeholder^='Write a message']\").value.length"))}`, evidence: await O.jshot("dis-messages-toolong"), impact: "misleading result", repro: "Paste 4,100 characters; Send" });
    await C.typeInto(O, "input[placeholder^='Write a message']", "");
  });

  await section("recipient", async () => {
    await W.visit("/messages"); await sleep(3500);
    const lt = await listText(W);
    const cid = (await convRows())[0].id;
    r.check(lt.length === 1 && /xxxx/.test(lt[0]) && /3\s*$/.test(lt[0]), { page: "/messages | viewer", control: "Recipient's inbox", expected: "one conversation with the owner, newest message as the preview, unread count 3", actual: lt.join(" || "), evidence: await W.jshot("dis-messages-recipient"), impact: "misleading result", repro: "Open /messages as the recipient" });
    const unreadDb = (await msgRows(cid)).filter((x) => x.sender_profile_id === P && !x.read_at).length;
    await C.click(W, `document.querySelector('main [role=button]')`); await sleep(3000);
    const unreadAfter = (await msgRows(cid)).filter((x) => x.sender_profile_id === P && !x.read_at).length;
    const lt2 = await listText(W);
    r.check(unreadDb === 3 && unreadAfter === 0 && !/3\s*$/.test(lt2[0] || "") && /hello from the owner/.test(clean(await W.text())), { page: "/messages | viewer", control: "Open the conversation", expected: "both messages show; the 3 unread messages are marked read in the database and the badge clears", actual: `unread in db ${unreadDb} -> ${unreadAfter}; list row now ends: ${(lt2[0] || "").slice(-20)}; thread shows hello=${/hello from the owner/.test(clean(await W.text()))}`, evidence: await W.jshot("dis-messages-recipient-open"), impact: "misleading result", repro: "Open the conversation as the recipient" });
    await C.typeInto(W, "input[placeholder^='Write a message']", "[QA audit] reply from the viewer");
    await C.click(W, `([...document.querySelectorAll('button')].find((b) => /^Send$/i.test(b.textContent.trim()) || /Send/i.test(b.getAttribute('aria-label') || '')))`); await sleep(2500);
    const ms = await msgRows(cid);
    r.check(ms[ms.length - 1].body === "[QA audit] reply from the viewer" && ms[ms.length - 1].sender_profile_id === K, { page: "/messages | viewer", control: "Reply", expected: "stored as the viewer's message in the same conversation", actual: `last='${ms[ms.length - 1].body}' sender ok=${ms[ms.length - 1].sender_profile_id === K}; conversations now=${(await convRows()).length}`, evidence: "n/a", impact: "data loss", repro: "Reply in the thread" });
    // owner sees reply after reload with an unread badge
    await O.visit("/messages"); await sleep(3500);
    const olt = await listText(O);
    const lastMsg = (await msgRows((await convRows())[0].id)).pop(); const openNow = !!lastMsg.read_at;
    r.check(olt.length === 1 && /reply from the viewer/.test(olt[0]) && (/1\s*$/.test(olt[0]) || openNow), { page: PG, control: "Sender sees the reply (after reload)", expected: "preview shows the reply and it is flagged unread (badge 1) unless the owner's open thread already showed it live (then it is marked read)", actual: olt.join(" || ") + "; reply already marked read=" + openNow, evidence: await O.jshot("dis-messages-owner-after-reply"), impact: "misleading result", repro: "Owner reloads /messages" });
  });

  await section("star-hide", async () => {
    await W.visit("/messages"); await sleep(3500);
    const star = `document.querySelector('main [role=button] button[aria-label="Star"], main [role=button] button[aria-label="Unstar"]')`;
    const hid = await W.evaluate(`!!document.querySelector('main [role=button] button[aria-label="Remove from inbox"]')`);
    await C.click(W, star); await sleep(1500);
    const cid = (await convRows())[0].id;
    const prefs = (await admin.from("conversation_prefs").select("*").eq("conversation_id", cid)).data;
    const lab = await W.evaluate(`(document.querySelector('main [role=button] button[aria-label="Unstar"]') || {}).ariaLabel`);
    r.check(lab === "Unstar" && prefs.length >= 1 && prefs.some((x) => x.profile_id === K && (x.starred === true || x.starred_at)), { page: "/messages | viewer", control: "Star a conversation", expected: "label flips to Unstar; a preference row is saved for the viewer only", actual: `label=${lab}; prefs=${JSON.stringify(prefs).slice(0, 160)}`, evidence: "n/a", impact: "data loss", repro: "Click the star on a conversation row" });
    await C.click(W, `document.querySelector('main [role=button] button[aria-label="Unstar"]')`); await sleep(1200);
    r.check((await W.evaluate(`(document.querySelector('main [role=button] button[aria-label="Star"]') || {}).ariaLabel`)) === "Star", { page: PG.replace("owner", "viewer"), control: "Unstar", expected: "flips back", actual: "ok", evidence: "n/a", impact: "usability", repro: "Click again" });
    await C.click(W, `document.querySelector('main [role=button] button[aria-label="Remove from inbox"]')`); await sleep(1800);
    const gone = (await listText(W)).length === 0;
    const msgsKept = (await msgRows(cid)).length;
    await W.visit("/messages"); await sleep(3500);
    r.check(hid && gone && (await listText(W)).length === 0 && msgsKept >= 3, { page: "/messages | viewer", control: "Remove from inbox", expected: "the conversation leaves the viewer's list (and stays gone after reload) without deleting the messages for the other person", actual: `removed from list=${gone}; after reload rows=${(await listText(W)).length}; messages still in db=${msgsKept}`, evidence: await W.jshot("dis-messages-hidden"), impact: "data loss", repro: "Click the X on a conversation row; reload" });
    // new message from owner brings it back?
    await O.visit("/messages"); await sleep(3000);
    await C.click(O, `document.querySelector('main [role=button]')`); await sleep(2500);
    await C.typeInto(O, "input[placeholder^='Write a message']", "[QA audit] second hello");
    await C.click(O, `([...document.querySelectorAll('button')].find((b) => /^Send$/i.test(b.textContent.trim()) || /Send/i.test(b.getAttribute('aria-label') || '')))`); await sleep(2500);
    await W.visit("/messages"); await sleep(3500);
    const back = await listText(W);
    r.check(back.length === 1 && /second hello/.test(back[0]), { page: "/messages | viewer", control: "A new message after 'Remove from inbox'", expected: "the conversation reappears so the new message is not missed", actual: back.join(" || ") || "still hidden: the viewer never sees the new message", evidence: await W.jshot("dis-messages-after-hide-new"), impact: "misleading result", repro: "Recipient removes the conversation; the sender writes again" });
  });

  await section("isolation", async () => {
    const X = await C.session("onboard"); await X.visit("/messages"); await sleep(3000);
    r.check((await listText(X)).length === 0 || /onboarding|login/.test(await X.path()), { page: "/messages | third account (onboarding unfinished)", control: "Other account", expected: "sees none of the two users' messages (or is sent to finish onboarding)", actual: `${await X.path()} | rows ${(await listText(X)).length}`, evidence: "n/a", impact: "privacy/data loss", repro: "Sign in as another user; open /messages" });
    await X.close();
    const B = await C.session("business"); await B.visit("/messages"); await sleep(3500);
    r.check((await listText(B)).length === 0, { page: "/messages | owner, Business profile", control: "Messages under the Business profile", expected: "empty: the Personal profile's conversation is not shown", actual: String((await listText(B)).length), evidence: await B.jshot("dis-messages-business"), impact: "privacy/data loss", repro: "Switch to Business; open /messages" });
    await B.close();
  });

  await O.close(); await W.close();
  const M2 = await C.session("owner", { width: 390, height: 844, mobile: true });
  await M2.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await M2.visit("/messages"); await sleep(3500);
  const ov = await M2.evaluate("(() => { const sc = document.querySelector('.vltd-content-wrap'); return { sc: sc.scrollWidth, w: innerWidth }; })()");
  const tapC = await C.centre(M2, "document.querySelector('main [role=button]')");
  if (tapC) { await M2.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tapC.x, y: tapC.y, id: 1 }] }); await M2.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(2500); }
  const threadOpen = await M2.evaluate("!!document.querySelector(\"input[placeholder^='Write a message']\")");
  const listHidden = await M2.evaluate("(() => { const l = document.querySelector('main [role=button]'); return !l || l.getBoundingClientRect().width === 0; })()");
  await C.click(M2, `document.querySelector('button[aria-label="Back to conversations"]')`); await sleep(800);
  const back = await M2.evaluate("!!document.querySelector('main [role=button]') && document.querySelector('main [role=button]').getBoundingClientRect().width > 0");
  r.check(ov.sc <= ov.w + 1 && threadOpen && listHidden && back, { page: "/messages | owner, 390 phone (browser-emulated)", control: "Phone: tap a conversation, then Back to conversations", expected: "no sideways scroll; the thread opens full-width; Back returns to the list", actual: `overflow ${JSON.stringify(ov)}; thread open=${threadOpen}; list hidden while reading=${listHidden}; back to list=${back}`, evidence: await M2.jshot("dis-messages-390"), impact: "usability", repro: "At 390 px tap a conversation; tap Back" });
  await M2.close();

  // cleanup: the conversation (cascades to messages and prefs)
  for (const c of await convRows()) await admin.from("conversations").delete().eq("id", c.id);
  console.log("conversations left:", (await convRows()).length);
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
