// Which beats (scenes) use which capture, per video group, and labelled contact sheets of every capture used (desktop and phone separately).
const fs = require("fs"), path = require("path");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const M = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/master";
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const p = require(M + "/project.json");
const groups = { desktop: p.desktop, phone: p.phone, "combined-phone-section": (p.combinedPhoneSection ? p.combinedPhoneSection.beats : []).map((id) => [...p.phone].find((b) => b.id === id)).filter(Boolean) };
p.shorts.forEach((s) => (groups["short-" + s.id] = s.beats)); p.promos.forEach((s) => (groups["promo-" + s.id] = s.beats));
const use = {}; // capture -> [group:beat]
for (const [g, beats] of Object.entries(groups)) for (const b of beats) if (b && b.capture) (use[b.capture] = use[b.capture] || []).push(`${g}:${b.id}`);
fs.writeFileSync(path.join(OUT, "capture-usage.json"), JSON.stringify(use, null, 1));
console.log("unique captures:", Object.keys(use).length, " beat uses:", Object.values(use).reduce((s, a) => s + a.length, 0));
const fileOf = (cap) => { const [sc, id] = cap.split("/"); const m = require(`${M}/captures/${sc}/manifest.json`); const st = m.steps.find((s) => s.id === id); return `${M}/captures/${sc}/${st.file}`; };
(async () => {
  for (const kind of ["desktop", "phone"]) {
    const caps = Object.keys(use).filter((c) => (kind === "phone") === /phone/.test(c.split("/")[0]));
    const cols = kind === "desktop" ? 4 : 8, tw = kind === "desktop" ? 400 : 190, th = kind === "desktop" ? 250 : 410, lab = 34;
    const perSheet = cols * (kind === "desktop" ? 5 : 3);
    for (let s = 0; s * perSheet < caps.length; s++) {
      const part = caps.slice(s * perSheet, (s + 1) * perSheet); const rows = Math.ceil(part.length / cols); const comps = [];
      for (let i = 0; i < part.length; i++) {
        const left = (i % cols) * (tw + 4), top = Math.floor(i / cols) * (th + lab + 4);
        comps.push({ input: await sharp(fileOf(part[i])).resize(tw, th, { fit: "contain", background: "#000" }).toBuffer(), left, top: top + lab });
        const svg = `<svg width="${tw}" height="${lab}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="4" y="14" font-size="12" fill="#fff" font-family="Arial">${part[i]}</text><text x="4" y="29" font-size="10" fill="#9cf" font-family="Arial">${use[part[i]].length} scene(s)</text></svg>`;
        comps.push({ input: Buffer.from(svg), left, top });
      }
      await sharp({ create: { width: cols * (tw + 4), height: rows * (th + lab + 4), channels: 3, background: "#444" } }).composite(comps).jpeg({ quality: 80 }).toFile(path.join(OUT, `${kind}-captures-${s + 1}.jpg`));
    }
  }
  console.log("sheets written");
})();
