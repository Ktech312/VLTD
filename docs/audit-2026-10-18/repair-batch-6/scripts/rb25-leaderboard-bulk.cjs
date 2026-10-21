// RC-12 (subject leaderboards) and RC-11 (code half: honest message when the scan allowance cannot be read), verified on PRODUCTION with the isolated QA fixture.
// No AI call is made (the harness refuses AI requests and the fixed page stops before asking); a QA item's subject is set and restored.
//   AUDIT_MANIFEST=<manifest> node rb25-leaderboard-bulk.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { session, sleep, man, admin, text, click, clickText, pickSelect, chooseViaButton, mkPng, tmp } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB25");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(T.AUD, await S.jshot(`rb25-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(T.AUD, ev).replace(/\\/g, "/") : "", impact: "batch 7", repro: "" });
}
(async () => {
  const subject = `qa-rb25-${m.stamp}`.toLowerCase();
  let touched = [], sessions = [], hadPublic = null;
  try {
    const pub = (await admin.from("vault_items").select("id,subject,is_public").eq("profile_id", P).eq("is_public", true).like("id", "qa_vz_%")).data || [];
    touched = pub.map((x) => ({ id: x.id, subject: x.subject }));
    await admin.from("vault_items").update({ subject }).in("id", pub.map((x) => x.id));
    hadPublic = (await admin.from("profiles").select("is_public").eq("id", P).maybeSingle()).data;
    await admin.from("profiles").update({ is_public: true }).eq("id", P); // the function only ranks public profiles
    const fn = await admin.rpc("get_subject_leaderboard", { p_subject: subject, p_limit: 25 });
    const expectItems = pub.length;

    // ---- RC-12: subject board (the page needs a signed-in account)
    const V = await session("viewer", { width: 1440, height: 900 }); sessions.push(V);
    await V.visit(`/community-board/${encodeURIComponent(subject)}`);
    await V.waitFor("/\\d+ collector/.test(document.body.innerText)", 40000, "board").catch(() => {}); await sleep(2500);
    let t = await text(V);
    await rec(V, new RegExp(`1 collector · ${expectItems} items`).test(t) && !/No public collectors/.test(t), "Subject board for a subject with one public QA collector", `'1 collector · ${expectItems} items' and the collector listed`, `database function returns ${fn.data ? fn.data.length : "?"} row(s); page: ${t.slice(0, 220)}`, "/community-board/[subject]");
    const bad = V.badResponses.filter((b) => /get_subject_leaderboard/.test(b.url));
    await rec(null, bad.length === 0, "Subject board: the leaderboard request", "answered without an error", `failed requests: ${JSON.stringify(bad)}`, "/community-board/[subject]");
    // ---- failure state: the request is refused
    await V.send("Network.setBlockedURLs", { urls: ["*rpc/get_subject_leaderboard*"] });
    await V.visit(`/community-board/${encodeURIComponent(subject)}`);
    await V.waitFor("document.body.innerText.includes('try again') || document.body.innerText.includes('No public collectors')", 40000, "board fail").catch(() => {}); await sleep(1500);
    t = await text(V);
    await rec(V, /load this leaderboard/i.test(t) && /Try again/.test(t) && !/No public collectors/.test(t), "Subject board when the request fails", "says it could not load, offers Try again, never 'No public collectors'", `page: ${t.slice(0, 200)}`, "/community-board/[subject]");
    await V.send("Network.setBlockedURLs", { urls: [] });
    await clickText(V, "Try again"); await sleep(5000);
    t = await text(V);
    await rec(V, new RegExp(`1 collector · ${expectItems} items`).test(t), "Subject board: Try again after the connection returns", "the board loads", `page: ${t.slice(0, 160)}`, "/community-board/[subject]");

    // ---- RC-11 code half: allowance unreadable -> honest message (owner; the database refuses the read for this profile until the SQL is applied)
    const O = await session("owner", { width: 1440, height: 900 }); sessions.push(O);
    await O.send("Network.setBlockedURLs", { urls: ["*rpc/bulk_scan_status*"] }); // the allowance cannot be read, whatever the database says
    await O.visit("/vault/bulk"); await O.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(3500);
    await mkPng(tmp("b7-bulk.png"), 500, 400, [90, 90, 200]);
    await chooseViaButton(O, T.btnExpr("Choose photos"), tmp("b7-bulk.png")); await sleep(1500);
    await pickSelect(O, "document.querySelectorAll('select')[0]", "Music"); await sleep(400);
    const cats = await O.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))"); await pickSelect(O, "document.querySelectorAll('select')[1]", cats[0]);
    const aiBefore = O.intercepted.filter((x) => /api\/ai/.test(x.url)).length;
    await clickText(O, "Scan with AI to fill details"); await sleep(4000);
    t = await text(O);
    const aiAfter = O.intercepted.filter((x) => /api\/ai/.test(x.url)).length;
    await rec(O, /check your AI scan allowance/i.test(t) && !/used all your AI scans/.test(t) && aiAfter === aiBefore, "Scan with AI when the scan allowance could not be read", "says the allowance could not be checked (not 'used all'); no AI call made", `message=${JSON.stringify((t.match(/Couldn.t check your AI scan allowance[^.]*\./) || [""])[0])}; used-all shown=${/used all your AI scans/.test(t)}; AI requests=${aiAfter - aiBefore}`, "/vault/bulk");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (hadPublic) await admin.from("profiles").update({ is_public: hadPublic.is_public }).eq("id", P); } catch {}
    for (const x of touched) { try { await admin.from("vault_items").update({ subject: x.subject }).eq("id", x.id); } catch {} }
    for (const S of sessions) { try { await S.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb25-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 300));
    process.exit(0);
  }
})();
