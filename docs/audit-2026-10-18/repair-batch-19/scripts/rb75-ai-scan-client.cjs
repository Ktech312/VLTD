// What the BROWSER now does when a person presses "Identify with AI" (RB75), on the real production page, with the AI route's network call INTERCEPTED in the page so it can never reach
// the server or the provider (nothing is spent). Proves: the sign-in token, the profile and a request id are sent; a double press is one request; the server's refusal reaches the
// person as a plain sentence; and the browser makes NO allowance-spending call of its own (no consume_bulk_scan), so a scan can never be charged twice.
//   AUDIT_MANIFEST=<manifest> node rb75-ai-scan-client.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, man, mkPng, tmp, uploadFiles } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB75");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] };
const ck = (ok, control, expected, actual) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: "/capture", control, expected, actual: String(actual).slice(0, 400), evidence: "", impact: "ai spend", repro: "" }); };

const INSTALL = `(() => {
  window.__scan = [];
  const real = window.fetch;
  window.fetch = async function (input, init) {
    const url = String(input && input.url || input);
    if (url.indexOf('/api/ai/analyze-item') >= 0) {
      const form = init && init.body;
      const h = new Headers(init && init.headers);
      window.__scan.push({ auth: (h.get('authorization') || '').startsWith('Bearer ') && (h.get('authorization') || '').length > 40, profileId: form && form.get('profileId'), requestId: form && form.get('requestId'), hasImage: !!(form && form.get('image') && form.get('image').size > 0) });
      await new Promise((r) => setTimeout(r, 400));
      return new Response(JSON.stringify({ error: "You've used all 3 of your AI scans for this cycle (they reset Nov 24). Fill this one in by hand.", code: "limit", remaining: 0, limit: 3, used: 3 }), { status: 429, headers: { 'content-type': 'application/json' } });
    }
    return real.apply(this, arguments);
  };
  return true;
})()`;

(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  const urls = [];
  S.c.on((e) => { if (e.method === "Network.requestWillBeSent") urls.push(e.params.request.url); });
  try {
    await S.visit("/capture"); await sleep(5000);
    await S.evaluate(INSTALL);
    const png = mkPng(tmp("rb75-scan.png"), 700, 700);
    const up = await uploadFiles(S, 'input[type="file"]', [png], 0);
    ck(up, "setup: a photo was added on the Capture page", "added", String(up));
    await sleep(2500);
    // two quick presses on "Identify with AI"
    const press = `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 0 && /Identify with AI/.test(x.textContent)); if (!b) return false; b.click(); b.click(); return true; })()`;
    const pressed = await S.evaluate(press);
    ck(pressed, "the Identify with AI button is there and was pressed twice in a row", "pressed", String(pressed));
    await sleep(3500);
    const sent = await S.evaluate("window.__scan");
    ck(sent.length === 1, "two presses on the same photo sent ONE request", "1 request", JSON.stringify(sent.length));
    ck(sent[0] && sent[0].auth && sent[0].profileId === P && /^[0-9a-f-]{36}$/.test(String(sent[0].requestId)) && sent[0].hasImage, "that request carried the sign-in token, the active profile, a request id and the photo", "all four", JSON.stringify({ ...sent[0], requestId: String(sent[0] && sent[0].requestId).slice(0, 8) + "..." }));
    const t = await S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')");
    ck(/used all 3 of your AI scans/.test(t), "the server's refusal reaches the person as a plain sentence on the page", "the sentence is shown", t.slice(0, 200));
    const charged = urls.filter((u) => /consume_bulk_scan/.test(u));
    ck(urls.length > 20 && charged.length === 0, `the browser made NO allowance-spending call of its own (the server owns the charge); ${urls.length} requests were watched`, "0 consume_bulk_scan calls", JSON.stringify(charged));
    out.shot = await S.jshot(`rb75-${LABEL}-capture-refusal`);
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); console.error("RUNNER ERROR", e); }
  finally {
    try { await S.close(); } catch { /* done */ }
    fs.writeFileSync(path.join(EV, `rb75-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
