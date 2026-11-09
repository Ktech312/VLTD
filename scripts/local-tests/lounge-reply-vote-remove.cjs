const L = require("./lib.cjs"); const { sleep, NL, check } = L;
(async () => { const s = await L.open({ width: 1280, height: 1400 });
  try { await s.go("/community-board", 9000); await s.dismiss();
    await s.mclick("Post Update", false); await sleep(900);
    await s.setField("input[placeholder*=title i]", "Reply test thread"); await s.setField("textarea", "Thread body two.");
    await s.mclick("Post to Lounge", false); await sleep(2000);
    // open the comments for my thread: the card button "0 comments" nearest my title
    await s.evaluate(`(() => { const b = [...document.querySelectorAll("button")].filter((x) => /^0 comments$/.test(x.innerText.trim())); b[0] && b[0].scrollIntoView(); })()`);
    await s.mclick("0 comments", false); await sleep(1300);
    await s.setField("textarea[placeholder*=discussion i]", "First local reply");
    await s.mclick("Reply", true); await sleep(1800);
    const cs = await L.dump("lounge_post_comments"); check("reply saved", cs.some((c) => c.body === "First local reply"), cs);
    check("reply owned by signed-in profile", cs[0] && cs[0].profile_id === L.P, cs[0]);
    let t = await s.text(); check("reply shows in thread", /First local reply/.test(t), 0);
    const posts = await L.dump("lounge_posts"); const mine = posts.find((p) => p.title === "Reply test thread");
    check("comment count shown 1", /1 comment\b/.test(t) || (mine && mine.comment_count === 1), mine && mine.comment_count);
    // empty reply is refused
    const before = (await L.dump("lounge_post_comments")).length; await s.mclick("Reply", true); await sleep(900);
    check("empty reply not saved", (await L.dump("lounge_post_comments")).length === before, 0);
    // vote
    await s.mclick("Upvote", false); await sleep(1500);
    const votes = await L.dump("lounge_post_votes"); check("upvote saved once", votes.length === 1 && votes[0].value === 1, votes);
    await s.mclick("Upvote", false); await sleep(1500);
    check("second tap clears the vote", (await L.dump("lounge_post_votes")).length === 0, await L.dump("lounge_post_votes"));
    // reload: post persists
    await s.go("/community-board", 8000); t = await s.text(); check("post survives reload", /Thread body two/.test(t), 0);
    // remove own post
    const c0 = (await L.sim("/__sim/counts")).counts["POST /rest/v1/rpc/hide_lounge_post"] || 0;
    await s.mclick("Remove", false); await sleep(1200); t = await s.text(); console.log("after remove click:", t.split(NL).filter((x) => /remove|sure|confirm|delete/i.test(x)).slice(0, 4).join(" | "), "| dialogs:", JSON.stringify(s.opts.dialogs || []));
    const c1 = (await L.sim("/__sim/counts")).counts["POST /rest/v1/rpc/hide_lounge_post"] || 0;
    check("remove calls the hide function", c1 === c0 + 1, [c0, c1]);
    check("removed post leaves the feed", !/Thread body two/.test(await s.text()), 0);
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0); })();
