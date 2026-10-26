const fs = require("fs"), path = require("path");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const OUT = path.join(__dirname, "assets");
const ORDER = ["sports-card", "tcg-card", "toy-figure", "comic-cover", "accidental"];
(async () => {
  const bufs = []; const means = {};
  for (const k of ORDER) {
    const img = sharp(path.join(OUT, k + ".jpg")).resize(720, 960, { fit: "cover" });
    const frame = await img.clone().jpeg({ quality: 80 }).toBuffer();
    const st = await img.clone().resize(4, 4, { fit: "fill" }).raw().toBuffer(); // mean colour of the whole frame
    means[k] = [...st];
    for (let i = 0; i < 90; i++) bufs.push(frame);
  }
  fs.writeFileSync(path.join(OUT, "feed-all.mjpeg"), Buffer.concat(bufs));
  fs.writeFileSync(path.join(OUT, "feed-means.json"), JSON.stringify(means));
  console.log(fs.statSync(path.join(OUT, "feed-all.mjpeg")).size, JSON.stringify(means));
})();
