// Synthetic, clearly fictional collectible "photos" for the tutorial (no real brands, people or characters). Output: JPEGs + an MJPEG file used as a test camera feed.
const fs = require("fs");
const path = require("path");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const OUT = path.join(__dirname, "assets"); fs.mkdirSync(OUT, { recursive: true });
const W = 900, H = 1200;
const bg = (extra = "", c0 = "#4a3d33", c1 = "#1c1613") => `<defs><radialGradient id="t" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></radialGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity=".55"/></filter>${extra}</defs><rect width="${W}" height="${H}" fill="url(#t)"/>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const svgs = {
  // 1. sports card (fictional player, fictional brand)
  "sports-card": `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${bg()}
  <g filter="url(#sh)" transform="rotate(-2 450 600)"><rect x="150" y="150" width="600" height="900" rx="26" fill="#f3efe2"/>
  <rect x="180" y="180" width="540" height="620" rx="12" fill="#1d4e89"/>
  <circle cx="450" cy="420" r="150" fill="#f4a259"/><rect x="360" y="520" width="180" height="250" rx="40" fill="#e9eef5"/>
  <path d="M180 640 Q450 520 720 640 L720 800 L180 800Z" fill="#163a66"/>
  <circle cx="450" cy="470" r="64" fill="#e8b48c"/><rect x="190" y="190" width="150" height="46" rx="8" fill="#d62828"/><text x="265" y="223" font-family="Arial Black,Arial" font-size="26" fill="#fff" text-anchor="middle">ROOKIE</text>
  <rect x="180" y="820" width="540" height="190" fill="#f3efe2"/><text x="450" y="885" font-family="Georgia,serif" font-size="46" font-weight="bold" fill="#1d1d1d" text-anchor="middle">JAVIER ALVAREZ</text>
  <text x="450" y="930" font-family="Arial" font-size="28" fill="#444" text-anchor="middle">GUARD · HARDWOOD HEROES 1992</text><text x="690" y="990" font-family="Arial Black" font-size="34" fill="#d62828" text-anchor="end">#14</text></g></svg>`,
  // 2. trading-card-game card (fictional game)
  "tcg-card": `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${bg("", "#1f6a66", "#08201f")}
  <g filter="url(#sh)" transform="rotate(1.5 450 600)"><rect x="150" y="140" width="600" height="840" rx="34" fill="#c99a2e"/><rect x="170" y="160" width="560" height="800" rx="24" fill="#2b1b4d"/>
  <text x="200" y="215" font-family="Georgia,serif" font-size="40" font-weight="bold" fill="#f7e7b4">Aurora Dragon</text><text x="700" y="215" font-family="Arial Black" font-size="38" fill="#ffd166" text-anchor="end">HP 120</text>
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00d2ff"/><stop offset=".5" stop-color="#b967ff"/><stop offset="1" stop-color="#ff7eb3"/></linearGradient></defs>
  <rect x="200" y="245" width="500" height="360" rx="14" fill="url(#g)"/><path d="M260 540 L350 330 L430 460 L520 290 L640 540Z" fill="#14213d" opacity=".85"/><circle cx="560" cy="360" r="46" fill="#fff" opacity=".85"/>
  <rect x="200" y="630" width="500" height="250" rx="10" fill="#f7e7b4"/><text x="225" y="685" font-family="Arial" font-size="30" font-weight="bold" fill="#222">Prism Breath</text><text x="225" y="730" font-family="Arial" font-size="24" fill="#333">Flip a coin. If heads, 60 damage.</text>
  <text x="225" y="775" font-family="Arial" font-size="24" fill="#333">Discard one energy from this card.</text>
  <text x="680" y="925" font-family="Arial Black" font-size="30" fill="#ffd166" text-anchor="end">045/200 ★ HOLO RARE</text></g></svg>`,
  // 3. boxed toy (landscape-ish packaging, portrait canvas)
  "toy-figure": `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${bg("", "#7a2f3c", "#2a0d14")}
  <g filter="url(#sh)" transform="rotate(-1 450 600)"><rect x="130" y="170" width="640" height="860" rx="14" fill="#f7f3e9"/><rect x="130" y="170" width="640" height="130" rx="14" fill="#e63946"/>
  <text x="450" y="255" font-family="Arial Black" font-size="62" fill="#fff" text-anchor="middle">RETRO ROBOTS</text>
  <rect x="190" y="330" width="520" height="560" rx="18" fill="#a8dadc"/><rect x="190" y="330" width="520" height="560" rx="18" fill="none" stroke="#457b9d" stroke-width="6"/>
  <rect x="340" y="400" width="220" height="170" rx="22" fill="#8d99ae"/><circle cx="395" cy="480" r="26" fill="#ffd166"/><circle cx="505" cy="480" r="26" fill="#ffd166"/><rect x="400" y="530" width="100" height="14" rx="7" fill="#2b2d42"/>
  <rect x="300" y="590" width="300" height="190" rx="18" fill="#6c757d"/><rect x="230" y="600" width="50" height="150" rx="20" fill="#8d99ae"/><rect x="620" y="600" width="50" height="150" rx="20" fill="#8d99ae"/><rect x="340" y="780" width="70" height="90" fill="#8d99ae"/><rect x="490" y="780" width="70" height="90" fill="#8d99ae"/>
  <rect x="380" y="630" width="140" height="70" rx="10" fill="#e63946"/><text x="450" y="965" font-family="Arial" font-size="34" font-weight="bold" fill="#333" text-anchor="middle">SERIES 2 · 6-INCH ACTION FIGURE</text><text x="450" y="1005" font-family="Arial" font-size="24" fill="#555" text-anchor="middle">SKU RR-0207 · Sealed</text></g></svg>`,
  // 4. comic book cover
  "comic-cover": `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${bg("", "#2d4a85", "#0b1226")}
  <g filter="url(#sh)" transform="rotate(2 450 600)"><rect x="160" y="130" width="580" height="880" fill="#f4d35e"/><rect x="178" y="148" width="544" height="844" fill="#0d1b2a"/>
  <rect x="178" y="148" width="544" height="150" fill="#ee964b"/><text x="450" y="255" font-family="Impact,Arial Black" font-size="76" fill="#0d1b2a" text-anchor="middle">MIDNIGHT COURIER</text>
  <circle cx="450" cy="560" r="190" fill="#1b263b"/><path d="M450 400 L520 500 L600 520 L540 590 L560 690 L450 640 L340 690 L360 590 L300 520 L380 500Z" fill="#f4d35e"/>
  <rect x="290" y="760" width="320" height="26" fill="#ee964b"/><text x="450" y="860" font-family="Arial Black" font-size="46" fill="#f4d35e" text-anchor="middle">ISSUE #1</text><text x="450" y="910" font-family="Arial" font-size="26" fill="#cbd5e1" text-anchor="middle">COVER A · FIRST PRINTING</text>
  <rect x="190" y="160" width="86" height="46" fill="#d62828"/><text x="233" y="192" font-family="Arial Black" font-size="26" fill="#fff" text-anchor="middle">12¢</text></g></svg>`,
  // 5. an unwanted, accidental shot (floor / blurred)
  "accidental": `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5c5348"/><stop offset="1" stop-color="#2a2622"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="14"/></filter></defs>
  <rect width="${W}" height="${H}" fill="url(#f)"/><g filter="url(#b)"><rect x="80" y="760" width="420" height="260" rx="30" fill="#8a7f70"/><circle cx="700" cy="300" r="140" fill="#a39a8a"/></g><text x="450" y="1110" font-family="Arial" font-size="30" fill="#b5ab9b" text-anchor="middle">(accidental, blurry photo)</text></svg>`,
};
(async () => {
  for (const [k, svg] of Object.entries(svgs)) {
    await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(path.join(OUT, k + ".jpg"));
  }
  // test-camera feeds: one MJPEG per item (720x960, 10 identical frames; Chrome loops the file)
  for (const k of ["sports-card", "tcg-card", "toy-figure", "comic-cover"]) {
    const frame = await sharp(path.join(OUT, k + ".jpg")).resize(720, 960, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer();
    fs.writeFileSync(path.join(OUT, `feed-${k}.mjpeg`), Buffer.concat(Array.from({ length: 10 }, () => frame)));
  }
  console.log(fs.readdirSync(OUT).join(", "));
})();
