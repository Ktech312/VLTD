const T = require("./audit-s-add-lib.cjs");
const { session, sleep, controls } = T;
const dump = async (S, tag) => { console.log("=== " + tag); console.log((await T.text(S)).slice(0, 500)); console.log(JSON.stringify((await controls(S)).filter((c) => c.visible && c.kind !== "link" && !/^(Search|Help|Account menu|Report a bug|Install|Dismiss|Unlocked for next item|Locked for next item)$/.test(c.label) && c.kind !== "input" && c.kind !== "select").map((c) => c.kind + ":" + c.label + (c.disabled ? "(d)" : "")))); };
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const png = T.mkPng(T.tmp("v1.png"), 640, 480, [30, 160, 90]);
    await S.visit("/vault/add"); await sleep(1500);
    await dump(S, "initial");
    await T.click(S, T.btnExpr("Take a new picture")); await sleep(2500);
    await dump(S, "after take a new picture (no camera)"); await S.jshot("probe-add-cam");
    await S.send("Page.reload"); await sleep(2500);
    S.dialogMode = "accept";
    const r = await T.chooseViaButton(S, T.btnExpr("Upload a photo from a file"), png); console.log(JSON.stringify(r)); await sleep(3500);
    await dump(S, "after upload"); await S.jshot("probe-add-uploaded");
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
