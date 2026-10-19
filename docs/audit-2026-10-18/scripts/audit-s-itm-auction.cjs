// ITM auction pages: /auction (list, search, sort, filters) and /auction/[id] (bid form) as visitor, unrelated viewer and owner. One real bid by the QA viewer on a QA auction; Buy Now is never clicked.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, typeIn, ENTER, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, P, ST, m } = X;
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
(async () => {
  let S = null; const { ck, nt, bl, out } = X.makeCk(() => S, {});
  const PG = (route, who, e = "") => `${route} | ${who}, ${dev}${e ? ", " + e : ""}`;
  let live;
  try {
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", P);
    live = await mkItem("auclive", { title: "QA ITM auction live", status: "AUCTION", auction_status: "ACTIVE", auction_ends_at: Date.now() + 2 * 86400e3, auction_starting_bid: 25, reserve_price: 40, buy_it_now_price: 90, auction_bid_count: 0, is_public: true, grade: "9.2", description: "Auction description text", purchase_price: 12, notes: "AUCTION-PRIVATE-NOTE" });
    const dead = await mkItem("aucdead", { title: "QA ITM auction cancelled", status: "COLLECTION", auction_status: "CANCELLED", auction_ends_at: Date.now() + 2 * 86400e3, auction_starting_bid: 10, is_public: true });
    for (const [kind, who] of [["visitor", "signed out"], ["viewer", "unrelated viewer"], ["owner", "owner"]]) {
      S = await X.S_(kind, { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
      try {
        await S.visit("/auction"); await sleep(3000); await dismissBanner(S);
        let t = await text(S);
        const cards = await S.evaluate(`[...document.querySelectorAll('a[href^="/auction/"]')].map(a => ({ href: a.getAttribute('href'), t: a.innerText.replace(/\\s+/g,' ').slice(0, 100) }))`);
        const liveCard = cards.find((c) => c.href.includes(live)); const deadCard = cards.find((c) => c.href.includes(dead));
        await ck(!!liveCard && !deadCard, { page: PG("/auction", who, "1 live + 1 cancelled auction"), control: "Auction list", expected: "The live auction is listed; the cancelled one is not", actual: `live listed=${!!liveCard}; cancelled listed=${!!deadCard}; cards=${cards.length}; card: ${liveCard ? liveCard.t : ""}`, repro: "Open /auction" });
        if (liveCard) await ck(/\$25/.test(liveCard.t), { page: PG("/auction", who), control: "Auction card bid", expected: "Shows the starting bid $25 (no bids yet)", actual: liveCard.t, repro: "Read the card" });
        const net = await S.evaluate(`document.body.innerText.includes('AUCTION-PRIVATE-NOTE') || document.body.innerText.includes('$12')`);
        await ck(!net, { page: PG("/auction", who), control: "Auction list privacy", expected: "No private note or purchase price on the list", actual: `private text shown=${net}`, impact: "privacy/data loss", repro: "Read the list" });
        // search + sort + universe
        const search = `document.querySelector('input[placeholder="Search auctions..."]')`;
        await mclick(S, search); await typeIn(S, "live", { clear: true }); await sleep(600);
        const n1 = await S.evaluate(`[...document.querySelectorAll('a[href^="/auction/"]')].filter(a=>a.getAttribute('href').includes(${JSON.stringify(live)})).length`);
        await typeIn(S, "zzzzqq", { clear: true }); await sleep(600);
        const n2 = await S.evaluate(`[...document.querySelectorAll('a[href^="/auction/"]')].length`); t = await text(S);
        await ck(n1 >= 1 && n2 === 0, { page: PG("/auction", who), control: "Search auctions", expected: "'live' finds the auction; gibberish shows no cards (with an empty message)", actual: `live matches=${n1}; gibberish cards=${n2}; empty text: ${(t.match(/No auctions[^.]*\.?/i) || ["none"])[0]}`, repro: "Type live; then zzzzqq" });
        await typeIn(S, "", { clear: true }); await sleep(300);
        const sortEl = await S.evaluate(`!!document.querySelector('select')`);
        nt({ page: PG("/auction", who), control: "Sort control", expected: "Observation", actual: sortEl ? "a select element is present" : "no select element", impact: "none", repro: "Look for sort" });
        // open the auction
        await mclick(S, `document.querySelector('a[href*="${live}"]')`); await sleep(3500);
        const p = await S.path(); t = await text(S);
        await ck(p === `/auction/${live}` && /QA ITM auction live/.test(t), { page: PG("/auction/[id]", who), control: "Auction card -> auction page", expected: "Opens that auction with its title", actual: `path=${p}; title shown=${/QA ITM auction live/.test(t)}`, repro: "Click the auction card" });
        await ck(!/AUCTION-PRIVATE-NOTE|\$12\b/.test(t) && /Auction description text/.test(t), { page: PG("/auction/[id]", who), control: "Auction page content", expected: "Shows the public description; never the private note or what was paid", actual: `description shown=${/Auction description text/.test(t)}; private note/cost shown=${/AUCTION-PRIVATE-NOTE|\$12\b/.test(t)}; reserve text: ${(t.match(/Reserve[^A-Z]{0,20}(Met|Not met|\$\d+)/) || ["-"])[0]}`, impact: "privacy/data loss", repro: "Open the auction page" });
        const shot = await S.jshot(`itm-auction-${kind}-${MOBILE ? "390" : "1440"}`);
        if (kind === "visitor") {
          await ck(/Sign in to place a bid/.test(t), { page: PG("/auction/[id]", who), control: "Bid form for a signed-out visitor", expected: "'Sign in to place a bid' with a link, no bid box", actual: (t.match(/Sign in to place a bid[^.]{0,30}/) || ["not shown"])[0], evidence: shot, repro: "Open an auction signed out" });
        } else if (kind === "viewer") {
          const bidIn = `document.querySelector('input[type=number][placeholder="25"]')`;
          await mclick(S, bidIn); await typeIn(S, "10", { clear: true }); await ENTER(S); await sleep(1200);
          t = await text(S);
          await ck(/Minimum bid is \$25/.test(t), { page: PG("/auction/[id]", who), control: "Bid below the minimum ($10)", expected: "'Minimum bid is $25' and nothing placed", actual: (t.match(/Minimum bid is[^.A-Z]{0,12}/) || ["no message"])[0] + `; bids in db=${((await admin.from("bids").select("id").eq("item_id", live)).data || []).length}`, repro: "Type 10 in the bid box; Enter" });
          await typeIn(S, "", { clear: true });
          await mclick(S, bidIn); await typeIn(S, "-5", { clear: true }); await ENTER(S); await sleep(1000); t = await text(S);
          await ck(/Minimum bid is \$25/.test(t), { page: PG("/auction/[id]", who), control: "Bid with a negative amount (-5)", expected: "Refused with the minimum-bid message", actual: (t.match(/Minimum bid is[^.A-Z]{0,12}/) || ["no message"])[0], repro: "Type -5; Enter" });
          await mclick(S, bidIn); await typeIn(S, "30", { clear: true });
          await mclick(S, byText("^Bid$", "button")); await sleep(3500);
          t = await text(S); const bid = await admin.from("bids").select("*").eq("item_id", live); const it = await dbItem(live);
          await ck((bid.data || []).length === 1 && Number(it.auction_current_bid) === 30 && Number(it.auction_bid_count) === 1 && /Bid of \$30 placed/.test(t), { page: PG("/auction/[id]", who, "QA viewer bids $30 on a QA auction"), control: "Bid ($30)", expected: "One bid row of $30, the item's current bid 30 and bid count 1, and 'Bid of $30 placed!' shown", actual: `bids=${(bid.data || []).length} ${JSON.stringify((bid.data || []).map((b) => b.amount))}; current_bid=${it.auction_current_bid}; count=${it.auction_bid_count}; message: ${(t.match(/Bid of \$30 placed!/) || ["none"])[0]}`, repro: "Type 30; Bid" });
          await ck(/\$30/.test(t) && /Bid History/.test(t), { page: PG("/auction/[id]", who), control: "Bid History after a bid", expected: "Current bid $30 and the bid listed in Bid History", actual: (t.match(/Current Bid.{0,30}/) || [""])[0] + " | " + (t.match(/Bid History.{0,60}/) || ["no history"])[0], repro: "After the bid" });
          await mclick(S, bidIn); await typeIn(S, "30", { clear: true }); await ENTER(S); await sleep(1500); t = await text(S);
          await ck(/Minimum bid is \$31/.test(t), { page: PG("/auction/[id]", who), control: "Bid equal to the current bid ($30)", expected: "'Minimum bid is $31'", actual: (t.match(/Minimum bid is[^.A-Z]{0,12}/) || ["no message"])[0], repro: "Bid 30 again" });
          bl({ page: PG("/auction/[id]", who), control: "Buy Now", expected: "Buy Now places a bid at the Buy It Now price", actual: "BLOCKED by safety rule: it is a purchase-style commitment, never clicked", impact: "none", repro: "n/a" });
        } else {
          t = await text(S);
          const form = /Place a Bid/.test(t);
          nt({ page: PG("/auction/[id]", who), control: "Bid form shown to the seller on their own auction", expected: "Observation: a seller should not be able to bid on their own item", actual: `bid form shown to the owner=${form}`, evidence: shot, impact: form ? "improvement" : "none", repro: "Owner opens their own auction page" });
          if (form) {
            const bidIn = `document.querySelector('input[type=number]')`;
            await mclick(S, bidIn); await typeIn(S, "99", { clear: true }); await ENTER(S); await sleep(2500); t = await text(S);
            const bids = (await admin.from("bids").select("bidder_id,amount").eq("item_id", live)).data || [];
            const own = bids.some((b) => b.bidder_id === m.userId);
            await ck(!own, { page: PG("/auction/[id]", who), control: "Seller bids on their own auction ($99)", expected: "Refused: a seller cannot bid on their own item", actual: `seller bid recorded=${own}; message: ${(t.match(/Bid of \$99 placed!|[^.]*own[^.]*\./i) || ["none"])[0]}`, impact: "misleading result", repro: "As the owner, bid on your own auction" });
          }
        }
        // cancelled auction page
        await S.visit(`/auction/${dead}`); await sleep(2500); t = await text(S);
        await ck(/ended|not found|no longer|cancel/i.test(t) && !/Place a Bid/.test(t), { page: PG("/auction/[id]", who, "cancelled auction"), control: "Open a cancelled auction by its URL", expected: "Says it ended / not found; no bid form", actual: t.slice(60, 200), repro: "Open the URL of a cancelled auction" });
      } finally { await S.close(); }
    }
    nt({ page: "/auction/[id] network | signed out", control: "Reserve price in the page's data", expected: "Observation: the public view returns reserve_price (40) to every visitor (the page only shows Met / Not met); AUCTION_COLUMNS in src/lib/auctionLib.ts requests it", actual: "see ITM-219 (public_vault_items columns)", impact: "improvement", repro: "Read the response of the auction item request" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "auction suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { try { await admin.from("bids").delete().eq("item_id", live); await admin.from("profiles").update({ is_public: false }).eq("id", P); } catch {} console.log(JSON.stringify(X.sumRows(out))); try { await S.close(); } catch {} process.exit(0); }
})();
