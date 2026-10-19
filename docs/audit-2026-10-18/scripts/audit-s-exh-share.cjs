// EXH suite 10: the Share panel on a Private exhibition ("Turn on public sharing?").
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, byLabelRe, key, gdb } = X;
const R = rows();
const m = man();
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const A = ex.A;
const PG = "/museum/[galleryId] | owner, Personal, 'QA Spare A' (Private) | Share panel";
const dlg = (S) => S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g, ' ') : null; })()`);

(async () => {
  await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", A);
  const g0 = await gdb(A);
  const S = await session("owner");
  try {
    await S.visit("/museum/" + A); await sleep(7000);
    await mclick(S, byLabel("Share this exhibition"), { wait: 900 });
    let t = await dlg(S);
    R.check(/Turn on public sharing\?/.test(t) && /not added to public discovery/.test(t), { page: PG, control: "Share on a Private exhibition", expected: "Asks 'Turn on public sharing?' and says it is not added to public discovery; no link yet", actual: String(t).slice(0, 300), evidence: await S.jshot("exh-share-private-panel-1440"), impact: "misleading result", repro: "Private exhibition > Share" });
    await mclick(S, byLabel("Not now"), { wait: 1200 });
    let g = await gdb(A);
    const afterNo = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? [...d.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.textContent).trim()) : null; })()`);
    R.check(g.visibility === "LOCKED" && g.public_token === g0.public_token && !!afterNo && afterNo.includes("Turn it on"), { page: PG, control: "'Not now'", expected: "Stays Private (nothing saved); the panel stays open with a way to change your mind ('Turn it on')", actual: `database ${g.visibility}; buttons now ${JSON.stringify(afterNo)}`, impact: "privacy/data loss", repro: "Share > Not now" });
    await mclick(S, byLabel("Turn it on"), { wait: 1200 });
    const again = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? [...d.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.textContent).trim()) : null; })()`);
    R.check(!!again && again.includes("Yes"), { page: PG, control: "'Turn it on' after 'Not now'", expected: "Brings the question back (Yes / Not now)", actual: JSON.stringify(again), impact: "usability", repro: "Share > Not now > Turn it on" });
    await mclick(S, byLabelRe("^Yes"), { wait: 4500 });
    g = await gdb(A);
    t = await dlg(S);
    const link = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); const i = d && d.querySelector('input'); return i ? i.value : null; })()`);
    R.check(g.visibility === "INVITE" && g.layout.guestViewMode !== "guest" && !!link && link.endsWith("/museum/share/" + g.public_token), { page: PG, control: "'Yes' (turn on public sharing)", expected: "Becomes Guest View (anyone with the link), saved to the database, and the link appears in the panel", actual: `database ${g.visibility}/guestViewMode ${g.layout.guestViewMode}; link in panel ${link}`, evidence: await S.jshot("exh-share-after-yes-1440"), impact: "privacy/data loss", repro: "Share > Yes" });
    const pill = await S.evaluate(`[...document.querySelectorAll('main button')].filter(b => ['Private','Public Exhibit','Guest View','Registered Users'].includes(b.textContent.trim())).map(b => b.textContent.trim() + ':' + (b.className.includes('active') ? 'on' : 'off')).join(',')`);
    await key(S, "Escape", "Escape", 27);
    const pillAfter = await S.evaluate(`(() => { const t = document.body.innerText; const mm = t.match(/Locked|Invite Only|Public/); return mm ? mm[0] : null; })()`);
    R.check(pillAfter === "Invite Only", { page: PG, control: "Page badge after turning sharing on", expected: "The exhibition badge on the page changes from Locked to Invite Only", actual: `badge '${pillAfter}'`, impact: "misleading result", repro: "Share > Yes, close, read the access mode" });
    // back to private for what follows
    await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", A);
  } finally { await S.close(); }
  console.log("DONE share");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
