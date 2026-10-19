// probe: /capture after attaching a photo (controls + text), and what Take photo does with no camera
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, controls } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const png = T.mkPng(T.tmp("probe.png"), 640, 480);
    await S.visit("/capture");
    // find which file input is "Upload"
    const ins = await S.evaluate("[...document.querySelectorAll('input[type=file]')].map((e, i) => ({ i, accept: e.accept, capture: e.getAttribute('capture'), multiple: e.multiple }))");
    console.log("file inputs", JSON.stringify(ins));
    await T.clickText(S, "^(?:.*\\|)?Take photo$"); await sleep(2500);
    console.log("AFTER Take photo:", (await T.text(S)).slice(0, 600));
    console.log(JSON.stringify((await controls(S)).filter((c) => c.visible).map((c) => c.kind + ":" + c.label).slice(0, 60)));
    await S.jshot("probe-takephoto");
    await S.visit("/capture");
    await T.uploadFiles(S, "input[type=file]", png, 0); await sleep(3000);
    console.log("AFTER upload:", (await T.text(S)).slice(0, 700));
    console.log(JSON.stringify((await controls(S)).filter((c) => c.visible).map((c) => c.kind + ":" + c.label + (c.disabled ? "(d)" : ""))));
    await S.jshot("probe-uploaded");
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
