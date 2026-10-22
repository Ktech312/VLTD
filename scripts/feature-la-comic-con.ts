// One-off, run 2026-10-22 at the owner's request: mark the existing LA Comic Con row Featured and fill its picture (the banner's featured-first rule then shows it).
//   npx tsx --env-file=.env.local scripts/feature-la-comic-con.ts <evidence.json>
import fs from "node:fs";
import { getServiceClient } from "../src/lib/serverAdmin";
import { fillBannerArt } from "../src/lib/events/eventArt";

async function main() {
  const svc = getServiceClient();
  if (!svc) throw new Error("no service client");
  const slug = "freshcomics-la-comic-con-2026";
  const before = (await svc.from("collector_events").select("slug,name,starts_at,ends_at,city,state_region,country,website_url,image_url,is_featured,enabled").eq("slug", slug).single()).data;
  if (!before) throw new Error("row not found");
  const { error } = await svc.from("collector_events").update({ is_featured: true }).eq("slug", slug);
  if (error) throw error;
  const art = await fillBannerArt(svc);
  const after = (await svc.from("collector_events").select("slug,name,starts_at,ends_at,city,state_region,country,website_url,image_url,is_featured,enabled").eq("slug", slug).single()).data;
  const out = { ranAt: new Date().toISOString(), before, after, art: { checked: art.checked, filled: art.filled, filledSlugs: art.filledSlugs, errors: art.errors } };
  console.log(JSON.stringify(out, null, 1));
  const file = process.argv.find((a) => a.endsWith(".json"));
  if (file) fs.writeFileSync(file, JSON.stringify(out, null, 1));
}
void main();
