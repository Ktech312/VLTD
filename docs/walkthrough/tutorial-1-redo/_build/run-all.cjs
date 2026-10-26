// Final capture run: resets the synthetic collector, then runs every scene in order. Output: manifests + PNGs in the work folder (see lib.cjs).
const cp = require("child_process"); const path = require("path");
const run = (f) => { console.log("== " + f); cp.execFileSync(process.execPath, [path.join(__dirname, f)], { stdio: "inherit", env: process.env }); };
run("reset-qa.cjs"); run("capture-extras.cjs");
run("reset-qa.cjs"); run("capture-quick-desktop.cjs");
run("reset-qa.cjs"); run("capture-additem-desktop.cjs");
run("reset-qa.cjs"); run("capture-phone.cjs");
run("reset-qa.cjs");
console.log("ALL CAPTURES DONE");
