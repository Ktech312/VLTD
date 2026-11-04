// node matrix.cjs <visitor|viewer> [--base=...] : opens every recorded link as that role; writes evidence/matrix-<role>-<label>.json
const L = require("./shr-lib.cjs");
const { session, admin, sleep, man, fs, EVID } = L;
(async () => {
  const kind = process.argv[2];
  const label = (process.argv.find((a) => a.startsWith("--label=")) || "--label=local").slice(8);
  const only = process.argv.filter((a) => !a.startsWith("--")).slice(3);
  const m = man();
  const cases = JSON.parse(fs.readFileSync(EVID + "/cases.json", "utf8"));
  const prof = (await admin.from("profiles").select("id,username,display_name,user_id").eq("id", m.personalId).maybeSingle()).data;
  const forbidden = { realName: prof.display_name, handle: prof.username, email: m.email, profileId: prof.id, userId: prof.user_id, notes: "PRIVNOTE-ZQ", source: "PRIVSRC-ZQ", purchaseLoc: "PRIVLOC-ZQ", order: "PRIVORD-ZQ", shelf: "PRIVSHELF-ZQ", serial: "PRIVSER-ZQ", priceNotes: "PRIVPN-ZQ", purchasePrice5555: "5555", value7777: "7777" };
  const out = {};
  {
    for (const [key, c] of Object.entries(cases)) {
      if (only.length && !only.includes(key)) continue;
      const S = await session(kind, { height: 1200 });
      try {
      let token = c.link && c.link.split("/").pop();
      let tokenFrom = "share panel";
      if (!token) { token = (await admin.from("galleries").select("public_token").eq("id", c.gid).maybeSingle()).data.public_token; tokenFrom = "database (the Share panel offered no link)"; }
      await S.visit("/museum/share/" + token);
      await sleep(2500);
      const text = (await S.text()).replace(/\s+/g, " ");
      const bodies = S.net.map((r) => r.body || "").join("\n");
      const hits = {};
      for (const [k, v] of Object.entries(forbidden)) { const inText = text.includes(v), inNet = bodies.includes(v); if (inText || inNet) hits[k] = { text: inText, net: inNet }; }
      const rpc = S.net.filter((r) => /get_gallery_by_share_token/.test(r.url) && r.body).map((r) => r.body.slice(0, 40));
      out[key] = { tokenFrom, headline: text.slice(text.indexOf("SHARED EXHIBITION") >= 0 ? text.indexOf("SHARED EXHIBITION") : 0, 400).slice(0, 330), rpcReturnedRow: rpc.length > 0 && rpc.some((x) => x.startsWith("[{")), hits };
      await S.shotTo(`matrix-${kind}-${label}-${key}`);
      console.log(key.padEnd(11), "|", out[key].rpcReturnedRow ? "row " : "none", "|", JSON.stringify(hits), "|", out[key].headline.slice(0, 150));
      } finally { await S.close(); }
    }
  }
  fs.writeFileSync(`${EVID}/matrix-${kind}-${label}.json`, JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
