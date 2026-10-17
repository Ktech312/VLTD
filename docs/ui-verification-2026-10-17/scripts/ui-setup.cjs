// Synthetic QA account + fixtures for the Share / Home / item-page checks. Everything is created under one QA user and removed by ui-cleanup.cjs.
//   node ui-setup.cjs
const fs = require("fs");
const crypto = require("crypto");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
const MANIFEST = __dirname + "/qa_ui.json";

(async () => {
  if (fs.existsSync(MANIFEST)) throw new Error("qa_ui.json already exists: run ui-cleanup.cjs first");
  const email = `vltdadmin+qa-ui-${stamp}@gmail.com`;
  const password = "Qa!" + crypto.randomBytes(9).toString("base64url");
  const cu = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cu.error) throw cu.error;
  const userId = cu.data.user.id;
  const manifest = { email, password, userId, profileId: null, itemIds: [], galleryIds: [], stamp };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest));
  const pr = await admin.from("profiles").insert({ user_id: userId, username: "qa_ui_" + stamp, display_name: "QA Curator", profile_type: "personal", primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: true, is_public: false, avatar_url: "__preset:key" }).select("id").single();
  if (pr.error) throw new Error(pr.error.message);
  await admin.from("profiles").update({ tier: "FULL" }).eq("id", pr.data.id);
  manifest.profileId = pr.data.id;
  const P = pr.data.id;
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest));

  const img = (name, k = 0) => ({ id: `/collectibles/${name}.png#${k}`, storageKey: `/collectibles/${name}.png`, url: `/collectibles/${name}.png`, order: k, localOnly: false, role: k === 0 ? "primary" : "detail", isPrivateStorage: false });
  const now = Date.now();
  const mk = (n, o) => ({ id: `qa_ui_${stamp}_${n}`, profile_id: P, created_at: now - n * 3600e3, is_public: false, status: "COLLECTION", ...o });
  const withImgs = (names) => ({ image_front_url: `/collectibles/${names[0]}.png`, image_front_storage_path: `/collectibles/${names[0]}.png`, images_json: names.map((x, k) => img(x, k)) });
  const items = [
    // The mismatch case: only the stored code "comics", no label (what the editor showed as "comics" while the summary said "Collector's Choice").
    mk(1, { title: "QA Batman Absolute #1", universe: "POP_CULTURE", category: "comics", category_label: null, purchase_price: 49, ...withImgs(["comic-slab", "movie-poster"]) }),
    mk(2, { title: "QA Rookie Card Slab", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", subcategory_label: "Baseball", purchase_price: 120, current_value: 180, ...withImgs(["sports-slab"]) }),
    mk(3, { title: "QA Pressing LP", universe: "MUSIC", category: "AUDIO_FORMATS", category_label: "Audio Formats", subcategory_label: "Vinyl Records", purchase_price: 30, ...withImgs(["vinyl-record"]) }),
    mk(4, { title: "QA Guitar", universe: "MUSIC", category: "INSTRUMENTS_GEAR", category_label: "Instruments & Gear", subcategory_label: "Guitars", purchase_price: 400, ...withImgs(["guitar"]) }),
    mk(5, { title: "QA Poster", universe: "POP_CULTURE", category: "MOVIES_TV_FILM", category_label: "Movies / TV / Film", subcategory_label: "Posters", purchase_price: 25, current_value: 40, ...withImgs(["movie-poster"]) }),
    mk(6, { title: "QA Sold Card A", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", status: "SOLD", sold_price: 90, sold_at: now - 3 * 86400e3, sold_platform: "eBay", purchase_price: 40, ...withImgs(["sports-slab"]) }),
    mk(7, { title: "QA Sold Card B", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", status: "SOLD", sold_price: 150, sold_at: now - 40 * 86400e3, sold_platform: "Whatnot", purchase_price: 60, ...withImgs(["sports-slab"]) }),
  ];
  for (let i = 8; i <= 12; i++) items.push(mk(i, { title: `QA Filler ${i}`, universe: ["SPORTS", "TCG", "GAMES", "ART", "MISC"][i % 5], category: "COLLECTORS_CHOICE", category_label: "Collectors Choice", purchase_price: 10 + i }));
  const ir = await admin.from("vault_items").insert(items);
  if (ir.error) throw new Error("items: " + ir.error.message);
  manifest.itemIds = items.map((x) => x.id);

  const galleries = [];
  const covers = ["comic-slab", "sports-slab", "vinyl-record", "movie-poster"];
  covers.forEach((c, i) => {
    const gid = crypto.randomUUID(); const order0 = [items[i].id];
    const section = { id: `sec_${i}`, title: "Exhibit 1", description: "", itemIds: order0, slotLayout: [...order0, null, null, null, null, null, null] };
    galleries.push({ id: gid, profile_id: P, title: `QA Exhibition ${i + 1}`, description: "synthetic", visibility: i === 0 ? "LOCKED" : "PUBLIC", state: "ACTIVE", cover_image: `/collectibles/${c}.png`, layout: { itemIds: order0, themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [section] }, exhibition_layout: { itemIds: order0, sections: [section] }, public_token: `qaui${stamp}${i}`, alias_enabled: false });
  });
  const gr = await admin.from("galleries").insert(galleries);
  if (gr.error) throw new Error("galleries: " + gr.error.message);
  manifest.galleryIds = galleries.map((g) => g.id);
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest));
  console.log("created", { user: userId.slice(0, 8), profile: P.slice(0, 8), items: items.length, galleries: galleries.length });
})().catch((e) => { console.error("SETUP ERROR", e.message || e); process.exit(2); });
