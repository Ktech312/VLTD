// ITM auction rerun: signed-out access, the bid and what the page shows afterwards (history, current bid, next minimum), and the owner's own auction.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, typeIn, ENTER, text, dbItem, mkItem, sleep, admin, dismissBanner, P, m } = X;
(async () => {
  let S = null; const { ck, nt, out } = X.makeCk(() => S, {});
  const live = `qa_vz_${X.ST}_itm_auclive`;
  const PG = (route, who, e = "") => `${route} | ${who}, desktop 1440${e ? ", " + e : ""}`;
  try {
    await admin.from("bids").delete().eq("item_id", live);
    await admin.from("vault_items").update({ auction_current_bid: null, auction_bid_count: 0 }).eq("id", live);
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", P);
    // signed out
    S = await X.S_("visitor", { width: 1440, height: 900 });
    for (const p of ["/auction", `/auction/${live}`]) {
      await S.visit(p); await sleep(2500);
      await ck((await S.path()).startsWith("/login?next="), { page: PG(p.replace(live, "[id]"), "signed out"), control: "Open the auctions pages without signing in", expected: "Signed-out visitors are sent to sign in (the bid form's 'Sign in to place a bid' note is then never reachable)", actual: `landed on ${await S.path()}`, repro: `Signed out: open ${p.replace(live, "<id>")}` });
    }
    await S.close();
    // viewer bids
    S = await X.S_("viewer", { width: 1440, height: 900 });
    await S.visit(`/auction/${live}`); await sleep(3500); await dismissBanner(S);
    const bidBox = `document.querySelector('input[type=number]')`;
    await mclick(S, bidBox); await typeIn(S, "30", { clear: true });
    await mclick(S, byText("^Bid$", "button")); await sleep(3500);
    let t = await text(S);
    const bids = (await admin.from("bids").select("*").eq("item_id", live)).data || []; const it = await dbItem(live);
    await ck(bids.length === 1 && Number(it.auction_current_bid) === 30 && Number(it.auction_bid_count) === 1 && /Bid of \$30(\.00)? placed!/.test(t), { page: PG("/auction/[id]", "unrelated viewer", "QA viewer bids $30 on a QA auction"), control: "Bid ($30)", expected: "One bid row of $30, current bid 30, bid count 1, and 'Bid of $30.00 placed!' shown", actual: `bids=${bids.length}; current_bid=${it.auction_current_bid}; count=${it.auction_bid_count}; message: ${(t.match(/Bid of \$30(\.00)? placed!/) || ["none"])[0]}`, repro: "Type 30; Bid" });
    const hist = (t.match(/BID HISTORY\s*(\d+) bids?/i) || [])[1]; const total = (t.match(/TOTAL BIDS\s*(\d+)/i) || [])[1];
    const rowsShown = await S.evaluate(`(() => { const all = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^Bidder #/.test((e.textContent||'').trim())); return all.map(e => e.textContent.trim()); })()`);
    const shot = await S.jshot("itm-auction-history-duplicate");
    await ck(Number(hist) === bids.length && rowsShown.length === bids.length, { page: PG("/auction/[id]", "unrelated viewer", "one bid placed"), control: "Bid History after placing one bid", expected: "One bid in the database, TOTAL BIDS 1, and Bid History lists that one bid once", actual: `db bids=${bids.length}; TOTAL BIDS=${total}; Bid History header says ${hist} bids and shows ${rowsShown.length} rows: ${rowsShown.join(" / ")}`, evidence: shot, impact: "misleading result", repro: "As a signed-in collector bid $30 on an auction with no bids; read Bid History without reloading" });
    await mclick(S, bidBox); await typeIn(S, "30", { clear: true }); await ENTER(S); await sleep(1500); t = await text(S);
    await ck(/Minimum bid is \$31(\.00)?/.test(t), { page: PG("/auction/[id]", "unrelated viewer"), control: "Bid equal to the current bid ($30)", expected: "'Minimum bid is $31.00'", actual: (t.match(/Minimum bid is[^A-Z]{0,14}/) || ["no message"])[0], repro: "Bid 30 again" });
    await X.openItem; await S.visit(`/auction/${live}`); await sleep(3000); t = await text(S);
    const hist2 = (t.match(/BID HISTORY\s*(\d+) bids?/i) || [])[1];
    await ck(Number(hist2) === 1, { page: PG("/auction/[id]", "unrelated viewer", "after reload"), control: "Bid History after reload", expected: "1 bid", actual: `Bid History header says ${hist2} bids`, repro: "Reload the auction page" });
    await S.close();
    // owner view of the list after a bid
    S = await X.S_("owner", { width: 1440, height: 900 });
    await S.visit("/auction"); await sleep(3000);
    const card = await S.evaluate(`(() => { const a = [...document.querySelectorAll('a[href^="/auction/"]')].find(x => x.getAttribute('href').includes(${JSON.stringify(live)})); return a ? a.innerText.replace(/\\s+/g,' ') : ''; })()`);
    await ck(/CURRENT BID \$30/i.test(card) && /1 bid/.test(card), { page: PG("/auction", "owner", "one bid of $30"), control: "Auction card after a bid", expected: "CURRENT BID $30 and '1 bid'", actual: card.slice(0, 120), repro: "After the bid, open /auction" });
    await S.visit(`/auction/${live}`); await sleep(3000); t = await text(S);
    await ck(!/Place a Bid/.test(t), { page: PG("/auction/[id]", "owner"), control: "Seller on their own auction", expected: "No bid form for the seller", actual: `bid form shown=${/Place a Bid/.test(t)}`, repro: "Open your own auction" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "auction2 runner", expected: "completes", actual: "script error: " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { try { await admin.from("bids").delete().eq("item_id", live); await admin.from("profiles").update({ is_public: false }).eq("id", P); } catch {} console.log(JSON.stringify(X.sumRows(out))); try { await S.close(); } catch {} process.exit(0); }
})();
