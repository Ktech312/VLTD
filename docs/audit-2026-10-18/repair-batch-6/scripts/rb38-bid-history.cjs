// ITM-482: one bid must be listed once in Bid History (the bidder's own bid can arrive twice: from the realtime feed and from the page itself).
// Production, isolated QA accounts: a QA item is put up for auction for the test and restored; the QA bid row is removed. No money or real person involved.
//   AUDIT_MANIFEST=<manifest> node rb38-bid-history.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB38");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb38-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-27", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
(async () => {
  let S, restore = null, itemId = null;
  try {
    const it = (await admin.from("vault_items").select("id,status,is_public,auction_status,auction_ends_at,auction_starting_bid,auction_current_bid,auction_bid_count").eq("profile_id", P).like("id", "qa_vz_%").order("id").limit(1)).data[0];
    itemId = it.id; restore = it;
    const prof = (await admin.from("profiles").select("is_public,onboarding_completed").eq("id", P).maybeSingle()).data; restore.prof = prof;
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", P);
    await admin.from("bids").delete().eq("item_id", itemId);
    const up = await admin.from("vault_items").update({ status: "AUCTION", is_public: true, auction_status: "ACTIVE", auction_ends_at: Date.now() + 3600e3, auction_starting_bid: 10, auction_current_bid: null, auction_bid_count: 0 }).eq("id", itemId);
    if (up.error) throw new Error("auction setup: " + up.error.message);
    S = await session("viewer", { width: 1440, height: 900 });
    await S.visit(`/auction/${itemId}`); await S.waitFor("document.body.innerText.includes('Bid History')", 45000, "auction").catch(() => {}); await sleep(3000);
    await A.typeInto(S, 'input[type="number"]', "12"); await A.clickText(S, "^Bid$", "button"); await sleep(7000);
    const t = await body(S);
    const dbBids = ((await admin.from("bids").select("id").eq("item_id", itemId)).data || []).length;
    const header = (t.match(/(\d+) bids?\b/g) || []).join(" | ");
    const rows = await S.evaluate("(() => { const h = [...document.querySelectorAll('h2,h3,div')].find((e) => /Bid History/i.test(e.innerText || '') && (e.innerText || '').length < 40); const sec = h && h.closest('section, div[class*=\"rounded\"]'); return sec ? (sec.innerText.match(/Bidder #\\w+/g) || []).length : -1; })()");
    await rec(S, dbBids === 1 && /\b1 bid\b/.test(t) && rows === 1, "Auction: Bid History after placing one bid", "one bid in the database, the header says 1 bid, and the bid is listed once", `database bids=${dbBids}; headers seen: ${header}; listed rows=${rows}`, "/auction/[id]");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (itemId) await admin.from("bids").delete().eq("item_id", itemId); } catch {}
    try { if (restore) await admin.from("vault_items").update({ status: restore.status, is_public: restore.is_public, auction_status: restore.auction_status, auction_ends_at: restore.auction_ends_at, auction_starting_bid: restore.auction_starting_bid, auction_current_bid: restore.auction_current_bid, auction_bid_count: restore.auction_bid_count }).eq("id", itemId); } catch {}
    try { if (restore) await admin.from("profiles").update({ is_public: restore.prof.is_public, onboarding_completed: restore.prof.onboarding_completed }).eq("id", P); } catch {}
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb38-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();
