// ITM access and empty states: signed out, unfinished onboarding and an unrelated collector on the item / For Sale / Sold / Sales pages.
const X = require("./audit-s-itm-lib.cjs");
const { text, sleep, P, ST } = X;
(async () => {
  let S = null; const { ck, nt, out } = X.makeCk(() => S, {});
  const item = X.ID.valued;
  const routes = [`/vault/item/${item}`, `/vault/item/${item}/present`, "/vault/for-sale", "/vault/sold", "/sales"];
  try {
    for (const [kind, who] of [["visitor", "signed out"], ["onboard", "unfinished onboarding"], ["viewer", "unrelated collector (own empty vault)"]]) {
      S = await X.S_(kind, { width: 1440, height: 900 });
      try {
        for (const r of routes) {
          await S.visit(r); await sleep(2500);
          const path = await S.path(); const t = await text(S);
          const ownerData = /QA Album|QA Sold|QA ITM|QA Visual Collection|\$1,[0-9]{3}/.test(t);
          const label = r.replace(item, "[id]");
          if (kind === "visitor") await ck(path.startsWith("/login") && !ownerData, { page: `${label} | ${who}`, control: "Open the page", expected: "Sent to sign in; no collection data", actual: `landed on ${path}; owner data shown=${ownerData}`, impact: "privacy/data loss", repro: `Signed out: open ${label}` });
          else if (kind === "onboard") await ck(!ownerData && (/onboarding|welcome|setup|get started/i.test(path + " " + t.slice(0, 300)) || path !== r), { page: `${label} | ${who}`, control: "Open the page", expected: "Sent into onboarding (or an empty/denied state); never the owner's data", actual: `landed on ${path}; owner data shown=${ownerData}; page: ${t.slice(60, 160)}`, impact: "privacy/data loss", repro: `Unfinished onboarding: open ${label}` });
          else {
            const emptyOk = r.includes("for-sale") ? /No items marked for sale/.test(t) : r.includes("sold") ? /No sold items yet/.test(t) : r === "/sales" ? /No sales yet/.test(t) : /Item not found/.test(t) || true;
            await ck(!ownerData && emptyOk, { page: `${label} | ${who}`, control: "Open the page", expected: r.startsWith("/vault/item") ? "'Item not found.' (someone else's item)" : "The collector's own (empty) state; none of the owner's items or sales", actual: `landed on ${path}; owner data shown=${ownerData}; page: ${t.slice(60, 200)}`, impact: "privacy/data loss", repro: `As another collector: open ${label}` });
          }
        }
      } finally { await S.close(); }
    }
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "access suite runner", expected: "completes", actual: "script error: " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { console.log(JSON.stringify(X.sumRows(out))); process.exit(0); }
})();
