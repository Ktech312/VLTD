// node pics.cjs <galleryId>: owner uploads a cover and a background picture with the builder's own file controls.
const L = require("./shr-lib.cjs");
const { sleep, fs, path } = L;
const zlib = require("zlib");
function png(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = (rgb[0] + x) % 255; raw[o + 1] = (rgb[1] + y) % 255; raw[o + 2] = rgb[2]; } }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (buf) => { let r = 0xffffffff; for (const b of buf) r = crcT[(r ^ b) & 0xff] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
async function setFile(S, sel, file) {
  const q = await S.send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(sel)})`, returnByValue: false });
  if (!q.result.objectId) throw new Error("no input " + sel);
  const nd = await S.send("DOM.describeNode", { objectId: q.result.objectId });
  await S.send("DOM.setFileInputFiles", { files: [file], backendNodeId: nd.node.backendNodeId });
}
(async () => {
  const gid = process.argv[2];
  const TMP = "C:/Users/EK/AppData/Local/Temp/claude/fb7ccbdc5d42cbe5/9dc294fb-36aa-4ddd-9f9a-7c5977b5df96/scratchpad";
  fs.mkdirSync(TMP, { recursive: true });
  const O = await L.session("owner", { height: 1400 });
  try {
    await O.visit("/museum/" + gid);
    await O.waitFor("document.querySelector('#gallery-cover-upload')", 180000, "builder");
    await O.send("DOM.enable");
    const cover = path.join(TMP, "shr-cover.png"), bg = path.join(TMP, "shr-bg.png");
    png(cover, 300, 400, [40, 90, 160]); png(bg, 94, 270, [200, 60, 20]);
    await setFile(O, "#gallery-cover-upload", cover);
    await sleep(9000);
    console.log("cover status:", await O.evaluate(`document.body.innerText.includes('Cover artwork uploaded')`));
    await setFile(O, "#shelf-upload-" + gid, bg);
    await sleep(9000);
    console.log("net:", O.net.filter((r) => /storage|galleries/.test(r.url)).map((r) => r.status + " " + r.url.slice(0, 100)).join("\n"));
    await sleep(4000);
    await O.shotTo("pics-owner");
    const row = (await L.admin.from("galleries").select("cover_image,layout").eq("id", gid).maybeSingle()).data;
    console.log("cover_image:", String(row.cover_image).slice(0, 120), "| shelfBackground:", String(row.layout && row.layout.shelfBackground).slice(0, 120));
  } finally { await O.close(); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
