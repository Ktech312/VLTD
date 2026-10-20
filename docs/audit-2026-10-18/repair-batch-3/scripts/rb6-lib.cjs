// Shared helpers for the repair batch 3 production checks (area RB6). Synthetic fixture only; no AI spend; nothing real is touched.
const T = require("./audit-s-add-lib.cjs");
const { R, admin, sleep, man, fs, AUD, session } = require("./audit-lib.cjs");
const r = R("RB6");
const EV = AUD + "/repair-batch-3/evidence"; fs.mkdirSync(EV, { recursive: true });
const save = (name, obj) => fs.writeFileSync(`${EV}/${name}.json`, JSON.stringify(obj, null, 1));
const body = (S) => S.evaluate("document.body.innerText.replace(/\\s+/g,' ')");
const click = T.click, typeInto = T.typeInto, poll = T.poll;
const btn = (re) => `[...document.querySelectorAll('button,a,label,[role=button]')].find((b) => ${String(re)}.test((b.textContent || '').trim().replace(/\\s+/g, ' ')) && b.getBoundingClientRect().width > 1)`;
const AI_PATTERNS = [{ urlPattern: "*/api/ai/*" }, { urlPattern: "*supabase.co/auth/v1/*" }];

// Network.setBlockedURLs: the request never leaves the browser (connection failure), reads included.
const blockTable = (S, table, on) => S.send("Network.setBlockedURLs", { urls: on ? [`*supabase.co/rest/v1/${table}*`] : [] });
const blockTables = (S, tables, on) => S.send("Network.setBlockedURLs", { urls: on ? tables.map((t) => `*supabase.co/rest/v1/${t}*`) : [] });

// "Interrupted response": the request REACHES the account and is applied, but the answer is lost on the way back (first `max` matches).
function lostAnswer(S, tableRe, methods, max = 1) {
  S.lostHits = 0;
  return S.send("Fetch.enable", { patterns: [{ urlPattern: "*supabase.co/rest/v1/*", requestStage: "Response" }, ...AI_PATTERNS] }).then(() => {
    S.fetchOverride = (p) => {
      if (p.responseStatusCode === undefined) return false;
      if (tableRe.test(p.request.url) && methods.includes(p.request.method) && S.lostHits < max) {
        S.lostHits++;
        S.send("Fetch.failRequest", { requestId: p.requestId, errorReason: "ConnectionReset" }).catch(() => {});
        return true;
      }
      S.send("Fetch.continueResponse", { requestId: p.requestId }).catch(() => {});
      return true;
    };
  });
}
function endLostAnswer(S) { S.fetchOverride = null; return S.send("Fetch.enable", { patterns: AI_PATTERNS }).catch(() => {}); }

// The account REFUSES the write (403), without reaching the table.
function refuseWrites(S, tableRe, methods) {
  S.refusedHits = 0;
  return S.addFetchPatterns([`*supabase.co/rest/v1/*`]).then(() => {
    S.fetchOverride = (p) => {
      if (p.responseStatusCode !== undefined) return false;
      if (!p.request.url.includes("supabase.co/rest/v1/")) return false;
      if (tableRe.test(p.request.url) && methods.includes(p.request.method)) {
        S.refusedHits++;
        S.send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 403, responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "access-control-allow-origin", value: "*" }], body: Buffer.from(JSON.stringify({ code: "42501", message: "permission denied for table", details: null, hint: null })).toString("base64") }).catch(() => {});
        return true;
      }
      S.send("Fetch.continueRequest", { requestId: p.requestId }).catch(() => {});
      return true;
    };
  });
}
function endRefuse(S) { S.fetchOverride = null; return S.send("Fetch.enable", { patterns: AI_PATTERNS }).catch(() => {}); }

const shot = (S, name) => S.jshot("rb6-" + name);
module.exports = { T, r, R, admin, sleep, man, fs, AUD, session, EV, save, body, click, typeInto, poll, btn, blockTable, blockTables, lostAnswer, endLostAnswer, refuseWrites, endRefuse, shot };
