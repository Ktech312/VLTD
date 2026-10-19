// ADD audit, suite 10b: Quick Add barcode/QR button with Chrome's synthetic camera (no barcode in view).
process.env.CHROME_EXTRA = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, rec, click } = T;
const btn = (label) => `document.querySelector('button[aria-label="${label}"]')`;
const state = (S) => S.evaluate("({ idle: !!document.querySelector('button[aria-label=\"Scan a barcode or QR code\"]'), cancel: !!document.querySelector('button[aria-label=\"Cancel scan\"]'), msg: (document.body.innerText.match(/(Scanning|No code found)[^\\n]{0,60}/) || [''])[0] })");
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/quick"); await sleep(4500);
    await click(S, btn("Scan a barcode or QR code")); await sleep(1500);
    const a = await state(S);
    await rec(S, a.cancel && /Scanning/.test(a.msg), { page: "/vault/quick | owner (synthetic camera)", control: "Scan a barcode or QR code", expected: "Shows a scanning state with the button turned into Cancel scan", actual: JSON.stringify(a), impact: "usability", repro: "Quick Add, press the barcode button" });
    await sleep(9000);
    const b = await state(S);
    await rec(S, b.idle && /No code found/.test(b.msg), { page: "/vault/quick | owner (synthetic camera, no barcode in view)", control: "Scan a barcode or QR code (timeout)", expected: "After about 8 s says no code was found and is ready to scan again", actual: JSON.stringify(b), impact: "usability", repro: "Start a scan with nothing to read, wait 10 s" });
    await click(S, btn("Scan a barcode or QR code")); await sleep(1500); await click(S, btn("Cancel scan")); await sleep(1000);
    const c = await state(S);
    await rec(S, c.idle && !c.cancel, { page: "/vault/quick | owner (synthetic camera)", control: "Cancel scan", expected: "Stops scanning and returns to the idle button", actual: JSON.stringify(c), impact: "usability", repro: "Start a scan, press Cancel scan" });
    // shutter still works after a scan
    await click(S, btn("Take picture")); await sleep(1500);
    const n = await S.evaluate("(() => { const m = document.body.innerText.match(/Finished \\((\\d+)\\)/); return m ? Number(m[1]) : 0; })()");
    await rec(S, n === 1, { page: "/vault/quick | owner (synthetic camera)", control: "Take picture after a scan attempt", expected: "The shutter still captures", actual: "captured = " + n, impact: "blocked workflow", repro: "Scan with nothing, then press the shutter" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-scan2-error"); } catch {} }
  finally { await S.close(); }
})();
