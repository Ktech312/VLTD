const { admin, man } = require("./journey-lib.cjs"); const m = man();
(async () => {
  const P = m.personalId, B = m.businessId, K = m.k.profileId, X = m.c.profileId; const profs = [P, B, K, X]; const users = [m.userId, m.k.userId, m.c.userId];
  const cnt = async (t, col, vals) => { const r = await admin.from(t).select(col, { count: "exact", head: true }).in(col, vals); return r.error ? "ERR:" + r.error.message.slice(0, 30) : r.count; };
  const out = {
    vault_items: await cnt("vault_items", "profile_id", profs), galleries: await cnt("galleries", "profile_id", profs), wishlist: await cnt("wishlist", "profile_id", profs),
    watchlist: await cnt("watchlist", "owner_profile_id", profs), shares: await cnt("wishlist_shares", "profile_id", profs), public_profiles: await cnt("public_profiles", "profile_id", profs),
    saved_events: await cnt("saved_events", "profile_id", profs), saved_articles: await cnt("saved_articles", "profile_id", profs), public_favorites: await cnt("public_favorites", "user_id", users),
    lounge_posts: await cnt("lounge_posts", "profile_id", profs), clubs: await cnt("clubs", "owner_profile_id", profs), conv_a: await cnt("conversations", "profile_a_id", profs), conv_b: await cnt("conversations", "profile_b_id", profs),
    collection_goals: await cnt("collection_goals", "profile_id", profs), profiles: await cnt("profiles", "id", profs),
  };
  console.log(JSON.stringify(out));
  const bug = await admin.from("bug_reports").select("id").ilike("message", "%[QA audit]%"); console.log("bug_reports with [QA audit]:", bug.data ? bug.data.length : bug.error.message);
  const au = []; for (const u of users) { const g = await admin.auth.admin.getUserById(u); au.push(g.data && g.data.user ? "exists" : "gone"); } console.log("auth users:", au.join(","));
  process.exit(0);
})();
