// read-only: show the non-empty columns of my fixture rows whose title starts with argv[2]
const T = require("./audit-s-add-lib.cjs");
(async () => {
  const pre = process.argv[2] || "AUD ADD Full";
  for (const p of T.mine()) {
    const r = (await T.admin.from("vault_items").select("*").eq("profile_id", p).like("title", pre + "%")).data || [];
    for (const x of r) { const o = {}; for (const [k, v] of Object.entries(x)) { if (v !== null && v !== "" && !(Array.isArray(v) && !v.length) && !/^(images_json|tags)$/.test(k)) o[k] = typeof v === "string" ? v.slice(0, 40) : v; } console.log(JSON.stringify(o)); }
  }
})();
