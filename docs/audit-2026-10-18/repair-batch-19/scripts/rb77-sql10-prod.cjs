// SQL package 10 on PRODUCTION (RB77), database level. NO AI provider is involved anywhere: only the reservation functions, a signed-in QA member, and the server's own (service-role) key.
// Proves on the real database, through separate HTTP requests (separate database connections):
//   * only the server can reserve or complete; a signed-in member, even during an in-flight reservation, cannot refund, complete or re-reserve;
//   * a repeated request id spends once, including 10 identical requests sent at the same instant;
//   * 14 different requests at the same instant against an allowance of 3 reserve exactly 3;
//   * the server's refund works once only, a released id can be retried, a finished scan cannot be refunded;
//   * cycle rollover: a member's status read of a lapsed cycle writes nothing and answers with the rolled numbers; the server's next reservation rolls the cycle with no carry-over;
//     a refund never reaches into a newer cycle.
// The QA profile's own counters/override/ledger rows are the only things changed; they are reset at the end and removed with the QA account.
//   AUDIT_MANIFEST=<manifest> node rb77-sql10-prod.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const J = require(path.join(SD, "journey-lib.cjs"));
const { admin, man } = T;
const m = man(); const P = m.personalId; const U = m.userId || m.ownerId || null;
const LABEL = process.argv[2] || "run";
const r = T.R("RB77");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] };
const ck = (ok, control, expected, actual) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: "database", control, expected, actual: String(actual).slice(0, 400), evidence: "", impact: "ai spend", repro: "" }); };
const uuid = () => require("crypto").randomUUID();

const row = (res) => (Array.isArray(res.data) ? res.data[0] : res.data) || null;
const state = async () => (await admin.from("profiles").select("bulk_scans_used,bulk_scans_cycle_start,bulk_scan_limit_override,created_at").eq("id", P).single()).data;
const ledger = async (id) => (await admin.from("ai_scan_requests").select("state,cycle_start,user_id,kind").eq("profile_id", P).eq("request_id", id).maybeSingle()).data;
const reserve = (id, kind = "item") => admin.rpc("reserve_ai_scan", { p_user: userId, p_profile: P, p_request: id, p_kind: kind });
const complete = (id, ok) => admin.rpc("complete_ai_scan", { p_profile: P, p_request: id, p_succeeded: ok });
const reset = (limit, used = 0, start = null) => admin.from("profiles").update({ bulk_scan_limit_override: limit, bulk_scans_used: used, bulk_scans_cycle_start: start }).eq("id", P);
let userId;

(async () => {
  try {
    const member = J.createClient(J.env.NEXT_PUBLIC_SUPABASE_URL, J.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const si = await member.auth.signInWithPassword({ email: m.email, password: m.password });
    if (si.error) throw si.error;
    userId = si.data.user.id;
    const anon = J.createClient(J.env.NEXT_PUBLIC_SUPABASE_URL, J.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

    // ───── the package is installed and closed to everyone but the server
    let x = await reserve(uuid());
    ck(!x.error && row(x) && row(x).outcome === "reserved", "the server can reserve (SQL 10 is installed: reserve_ai_scan exists and answers)", "reserved", JSON.stringify(x.error || row(x)));
    await reset(5, 0);
    const probe = uuid();
    for (const [who, client] of [["a signed-in member", member], ["an anonymous caller", anon]]) {
      const a = await client.rpc("reserve_ai_scan", { p_user: userId, p_profile: P, p_request: uuid(), p_kind: "item" });
      ck(!!a.error && /permission denied|not authorized|only the server/i.test(a.error.message || ""), `${who} cannot reserve (refused by the database)`, "refused", JSON.stringify(a.error && a.error.message));
      const b = await client.rpc("complete_ai_scan", { p_profile: P, p_request: probe, p_succeeded: false });
      ck(!!b.error && /permission denied|not authorized|only the server/i.test(b.error.message || ""), `${who} cannot complete or refund (refused by the database)`, "refused", JSON.stringify(b.error && b.error.message));
      const c = await client.rpc("ai_scan_numbers", { p_profile: P });
      ck(!!c.error, `${who} cannot call the number helper`, "refused", JSON.stringify(c.error && c.error.message));
    }
    const peek = await member.from("ai_scan_requests").select("request_id").eq("profile_id", P);
    ck(!!peek.error || (peek.data || []).length === 0, "a signed-in member cannot read the reservation table", "no rows / refused", JSON.stringify(peek.error ? peek.error.message : peek.data));
    const old = await member.rpc("consume_bulk_scan", { p_profile: P, p_count: 1 });
    const afterOld = await state();
    ck(afterOld.bulk_scans_used === 0, "(pre-existing) a member's own consume_bulk_scan still cannot move the counter", "0", JSON.stringify([old.error && old.error.message, afterOld.bulk_scans_used]));

    // ───── a reservation in flight cannot be touched by the member
    await reset(5, 0);
    const flight = uuid();
    x = await reserve(flight);
    ck(row(x).outcome === "reserved" && row(x).used === 1, "reserve one scan: allowance 5, 1 used (a provider call would now be 'in flight')", "reserved, used 1", JSON.stringify(row(x)));
    const tryRefund = await member.rpc("complete_ai_scan", { p_profile: P, p_request: flight, p_succeeded: false });
    const tryDone = await member.rpc("complete_ai_scan", { p_profile: P, p_request: flight, p_succeeded: true });
    const tryAgain = await member.rpc("reserve_ai_scan", { p_user: userId, p_profile: P, p_request: flight, p_kind: "item" });
    const tamper = await member.from("ai_scan_requests").update({ state: "released" }).eq("profile_id", P).eq("request_id", flight);
    const tamperCounter = await member.from("profiles").update({ bulk_scans_used: 0 }).eq("id", P);
    const mid = await state(); const led = await ledger(flight);
    ck(!!tryRefund.error && !!tryDone.error && !!tryAgain.error, "during the in-flight reservation the member's direct refund, completion and re-reservation are all refused", "3 refusals", JSON.stringify([tryRefund.error && tryRefund.error.message, tryDone.error && tryDone.error.message, tryAgain.error && tryAgain.error.message].map((s) => String(s).slice(0, 40))));
    ck(led && led.state === "reserved" && mid.bulk_scans_used === 1 && !tamper.data, "the reservation and the counter are untouched by those attempts and by direct edits (still reserved, still 1 used)", "reserved / 1", JSON.stringify([led && led.state, mid.bulk_scans_used]));
    void tamperCounter;
    x = await complete(flight, true);
    ck(row(x).outcome === "done" && row(x).used === 1, "the server then completes it: scan stays spent", "done, used 1", JSON.stringify(row(x)));
    x = await complete(flight, false);
    const afterDone = await state();
    ck(row(x).outcome === "done" && afterDone.bulk_scans_used === 1, "a finished scan cannot be refunded afterwards (even by the server)", "done, still 1", JSON.stringify([row(x), afterDone.bulk_scans_used]));
    x = await complete(flight, true);
    ck(row(x).outcome === "done" && (await state()).bulk_scans_used === 1, "completing twice changes nothing", "done, 1", JSON.stringify(row(x)));

    // ───── duplicate protection, including at the same instant
    await reset(5, 0);
    const dup = uuid();
    const first = await reserve(dup);
    const second = await reserve(dup);
    ck(row(first).outcome === "reserved" && row(second).outcome === "duplicate" && (await state()).bulk_scans_used === 1, "a repeated request id spends once (reserved, then duplicate; 1 used)", "reserved, duplicate, 1", JSON.stringify([row(first).outcome, row(second).outcome]));
    await reset(5, 0);
    const same = uuid();
    const burst = await Promise.all(Array.from({ length: 10 }, () => reserve(same)));
    const outcomes = burst.map((b) => (b.error ? "error:" + b.error.message.slice(0, 30) : row(b).outcome));
    const nRes = outcomes.filter((o) => o === "reserved").length;
    ck(nRes === 1 && outcomes.filter((o) => o === "duplicate").length === 9 && (await state()).bulk_scans_used === 1, "10 identical requests at the same instant: exactly one reserved, nine duplicates, 1 used", "1 / 9 / 1", JSON.stringify([nRes, outcomes.filter((o) => o === "duplicate").length, (await state()).bulk_scans_used]));

    // ───── the last scans cannot be spent twice
    await reset(3, 0);
    const many = await Promise.all(Array.from({ length: 14 }, () => reserve(uuid())));
    const oc = many.map((b) => (b.error ? "error" : row(b).outcome));
    const got = oc.filter((o) => o === "reserved").length;
    const st = await state();
    ck(got === 3 && oc.filter((o) => o === "limit").length === 11 && st.bulk_scans_used === 3, "14 different requests at the same instant against an allowance of 3: exactly 3 reserved, 11 refused as over the limit, counter 3", "3 / 11 / 3", JSON.stringify([got, oc.filter((o) => o === "limit").length, st.bulk_scans_used]));
    await reset(1, 0);
    let wins = 0, bad = 0;
    for (let i = 0; i < 6; i++) {
      await reset(1, 0);
      const pair = await Promise.all([reserve(uuid()), reserve(uuid())]);
      const o = pair.map((b) => (b.error ? "error" : row(b).outcome)).sort().join("+");
      if (o === "limit+reserved") wins++; else bad++;
    }
    ck(wins === 6 && bad === 0, "two requests racing for the one scan left, 6 rounds: exactly one wins every time", "6 of 6", `${wins} of 6`);

    // ───── refunds: server only, once only, and a released id can be retried
    await reset(5, 0);
    const rid = uuid();
    await reserve(rid);
    const refunds = await Promise.all(Array.from({ length: 8 }, () => complete(rid, false)));
    const ro = refunds.map((b) => (b.error ? "error" : row(b).outcome));
    const afterRefund = await state();
    ck(afterRefund.bulk_scans_used === 0 && ro.every((o) => o === "released"), "provider failed: 8 refunds at the same instant give the scan back exactly once (counter 0, all answers 'released')", "0 used", JSON.stringify([afterRefund.bulk_scans_used, [...new Set(ro)]]));
    x = await reserve(rid);
    ck(row(x).outcome === "reserved" && (await state()).bulk_scans_used === 1, "the released request id can be retried and is charged once (1 used)", "reserved, 1", JSON.stringify(row(x)));
    await complete(rid, true);
    const unknown = await complete(uuid(), false);
    ck(row(unknown).outcome === "unknown" && (await state()).bulk_scans_used === 1, "refunding a request the server never reserved does nothing", "unknown, 1", JSON.stringify(row(unknown)));

    // ───── cycle rollover
    const prof = await state();
    const LAPSED = "2020-01-01";
    await admin.from("ai_scan_requests").delete().eq("profile_id", P);
    await reset(5, 4, LAPSED);
    const stuck = await state();
    ck(stuck.bulk_scans_used === 4 && String(stuck.bulk_scans_cycle_start) === LAPSED, "setup: a lapsed cycle (started 2020-01-01) with 4 used", "4 / 2020-01-01", JSON.stringify(stuck));
    const stat = await member.rpc("bulk_scan_status", { p_profile: P });
    const srow = row(stat);
    const afterRead = await state();
    ck(!stat.error && srow && srow.used === 0 && String(srow.cycle_start) !== LAPSED, "a member's status read of the lapsed cycle answers with the NEW cycle and 0 used", "0 used, new cycle", JSON.stringify(stat.error || srow));
    ck(afterRead.bulk_scans_used === 4 && String(afterRead.bulk_scans_cycle_start) === LAPSED, "and writes NOTHING: the stored row is exactly as it was (4 used, old cycle), so nothing can be carried over by a read", "unchanged", JSON.stringify(afterRead));
    const rolled = await reserve(uuid());
    const afterRoll = await state();
    ck(row(rolled).outcome === "reserved" && row(rolled).used === 1 && afterRoll.bulk_scans_used === 1 && String(afterRoll.bulk_scans_cycle_start) === String(srow.cycle_start), "the server's next reservation rolls the cycle: 1 used in the new cycle (the old 4 are NOT carried over)", "1 used, new cycle", JSON.stringify([row(rolled), afterRoll]));
    // a refund must never reach into a newer cycle: pretend the reservation was taken in an older cycle
    await reset(5, 2, null);
    const oldId = uuid();
    await reserve(oldId);
    await admin.from("ai_scan_requests").update({ cycle_start: LAPSED }).eq("profile_id", P).eq("request_id", oldId);
    const beforeX = await state();
    x = await complete(oldId, false);
    const afterX = await state();
    ck(row(x).outcome === "released" && afterX.bulk_scans_used === beforeX.bulk_scans_used, "a refund for a reservation taken in an OLDER cycle changes nothing in the current one (released, counter unchanged)", "released, unchanged", JSON.stringify([row(x), beforeX.bulk_scans_used, afterX.bulk_scans_used]));
    // other readers of the status function still refused
    const strangerRead = await anon.rpc("bulk_scan_status", { p_profile: P });
    ck(!!strangerRead.error, "an anonymous caller cannot read the allowance status", "refused", JSON.stringify(strangerRead.error && strangerRead.error.message));
    out.profile = { created_at: prof.created_at };
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); console.error("RUNNER ERROR", e); }
  finally {
    try { await admin.from("ai_scan_requests").delete().eq("profile_id", P); await admin.from("profiles").update({ bulk_scan_limit_override: null, bulk_scans_used: 0, bulk_scans_cycle_start: null }).eq("id", P); } catch { /* removed with the account anyway */ }
    fs.writeFileSync(path.join(EV, `rb77-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
