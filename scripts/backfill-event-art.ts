// One-off (and safe to repeat): looks up each upcoming banner event's own share picture and fills collector_events.image_url where it is empty,
// the same step the daily refresh now runs. It never replaces a picture that is there. Writes a record of what it filled so it can be undone.
//   npx tsx --env-file=.env.local scripts/backfill-event-art.ts [--dry] [out.json]
import fs from "node:fs";
import { getServiceClient } from "../src/lib/serverAdmin";
import { fillBannerArt, fetchEventArt } from "../src/lib/events/eventArt";

async function main() {
  const svc = getServiceClient();
  if (!svc) throw new Error("no service client (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const dry = process.argv.includes("--dry");
  const out = process.argv.find((a) => a.endsWith(".json"));
  if (dry) {
    const nowIso = new Date().toISOString();
    const { data } = await svc.from("collector_events").select("slug, website_url, image_url").eq("enabled", true).gte("ends_at", nowIso).order("starts_at").limit(30);
    for (const e of data ?? []) {
      const art = e.image_url ? "(already has one)" : e.website_url ? await fetchEventArt(e.website_url) : null;
      console.log(String(e.slug).slice(0, 48).padEnd(48), "|", art ?? "-");
    }
    return;
  }
  const result = await fillBannerArt(svc);
  console.log(JSON.stringify({ checked: result.checked, filled: result.filled, classified: result.classified, errors: result.errors }));
  if (out) fs.writeFileSync(out, JSON.stringify({ ranAt: new Date().toISOString(), ...result }, null, 1));
}
void main();
