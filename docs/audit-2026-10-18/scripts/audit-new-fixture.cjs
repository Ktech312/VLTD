// node audit-new-fixture.cjs <tag>   -> creates a private synthetic QA collector (manifest qa_audit_<tag>.json) with the standard populated Vault.
// node audit-new-fixture.cjs <tag> --drop   -> removes it by exact manifest ids and recounts.
// Afterwards run your scripts with:  AUDIT_MANIFEST=<this folder>/qa_audit_<tag>.json node yourscript.cjs
const { spawnSync } = require("child_process"); const path = require("path"); const fs = require("fs");
const tag = process.argv[2]; if (!tag || !/^[a-z0-9]+$/.test(tag)) { console.error("usage: node audit-new-fixture.cjs <tag> [--drop]"); process.exit(2); }
const MF = path.join(__dirname, `qa_audit_${tag}.json`);
const run = (script) => { const r = spawnSync(process.execPath, [path.join(__dirname, script)], { env: { ...process.env, AUDIT_MANIFEST: MF }, encoding: "utf8" }); process.stdout.write(r.stdout || ""); process.stderr.write(r.stderr || ""); if (r.status !== 0) { console.error(script, "failed"); process.exit(r.status || 1); } };
if (process.argv.includes("--drop")) { run("journey-cleanup.cjs"); console.log("manifest kept as", MF + ".done (if clean)"); process.exit(0); }
if (fs.existsSync(MF)) { console.error("manifest already exists:", MF); process.exit(2); }
run("journey-setup.cjs"); run("visual-fixture.cjs"); run("audit-fixture.cjs");
const m = JSON.parse(fs.readFileSync(MF, "utf8")); console.log("MANIFEST", MF, "| owner", m.email, "| personal", m.personalId.slice(0, 8), "| business", m.businessId.slice(0, 8));
