const C = require("./audit-s-dis-common.cjs"); const { admin, man } = C; const m = man(); const P = m.personalId, K = m.k.profileId;
(async () => {
  const [a, b] = [P, K].sort();
  const cv = await admin.from("conversations").insert({ profile_a_id: a, profile_b_id: b, last_message_at: new Date().toISOString() }).select("id").single();
  const cid = cv.data.id;
  await admin.from("direct_messages").insert([{ conversation_id: cid, sender_profile_id: K, body: "[QA audit] from viewer 1" }, { conversation_id: cid, sender_profile_id: K, body: "[QA audit] from viewer 2" }]);
  const O = await C.session("owner"); await O.visit("/messages"); await C.sleep(3500);
  console.log("owner list:", JSON.stringify(await O.evaluate("[...document.querySelectorAll('main [role=button]')].map((d) => d.innerText)")));
  console.log("thread open:", await O.evaluate("!!document.querySelector(\"input[placeholder^='Write a message']\")"));
  console.log("db read_at:", JSON.stringify((await admin.from("direct_messages").select("body,read_at").eq("conversation_id", cid)).data));
  const W = await C.session("viewer"); await W.visit("/messages"); await C.sleep(3500);
  console.log("viewer list (sent by viewer):", JSON.stringify(await W.evaluate("[...document.querySelectorAll('main [role=button]')].map((d) => d.innerText)")));
  await admin.from("conversations").delete().eq("id", cid);
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
