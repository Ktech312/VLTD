/**
 * cleanDemoItemLeak.ts
 *
 * One-time cleanup script for the "Freck bug":
 * removes demo items (demo_1 … demo_5) that leaked into real user vaults
 * via the loadItemsOrSeed / migrateMissingProfileIds race condition.
 *
 * SAFE: skips all fake/seed characters (profile IDs 00000000-…-0001 through -0022).
 * SAFE: dry-run by default — pass --execute to actually delete.
 *
 * Usage:
 *   npx ts-node -e scripts/cleanDemoItemLeak.ts          # dry run (shows what would be deleted)
 *   npx ts-node -e scripts/cleanDemoItemLeak.ts --execute # live delete
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "\n❌ Missing env vars.\n" +
    "   NEXT_PUBLIC_SUPABASE_URL  — in .env.local\n" +
    "   SUPABASE_SERVICE_ROLE_KEY — in .env.local (never commit this)\n"
  );
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────────

// IDs of the known demo items written by getDemoItems() / loadItemsOrSeed()
const DEMO_ITEM_IDS = ["demo_1", "demo_2", "demo_3", "demo_4", "demo_5"];

// Fake/seed character profile IDs — NEVER touch these
const SEED_PROFILE_IDS = new Set([
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000003",
  "00000000-0000-0000-0000-000000000004",
  "00000000-0000-0000-0000-000000000005",
  "00000000-0000-0000-0000-000000000006",
  "00000000-0000-0000-0000-000000000007",
  "00000000-0000-0000-0000-000000000008",
  "00000000-0000-0000-0000-000000000009",
  "00000000-0000-0000-0000-000000000010",
  "00000000-0000-0000-0000-000000000011",
  "00000000-0000-0000-0000-000000000012",
  "00000000-0000-0000-0000-000000000013",
  "00000000-0000-0000-0000-000000000014",
  "00000000-0000-0000-0000-000000000015",
  "00000000-0000-0000-0000-000000000016",
  "00000000-0000-0000-0000-000000000017",
  "00000000-0000-0000-0000-000000000018",
  "00000000-0000-0000-0000-000000000019",
  "00000000-0000-0000-0000-000000000020",
  "00000000-0000-0000-0000-000000000021",
  "00000000-0000-0000-0000-000000000022",
]);

const DRY_RUN = !process.argv.includes("--execute");

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔍 VLTD Demo Item Leak Cleanup");
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (pass --execute to delete)" : "⚠️  LIVE DELETE"}`);
  console.log(`   Target item IDs: ${DEMO_ITEM_IDS.join(", ")}\n`);

  // Use service role key so we can query across all profiles
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch all rows matching any demo item ID
  const { data: rows, error } = await supabase
    .from("vault_items")
    .select("id, profile_id, title, created_at")
    .in("id", DEMO_ITEM_IDS);

  if (error) {
    console.error("❌ Fetch failed:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("✅ No demo items found in any real user vault. Nothing to do.");
    return;
  }

  // Partition: real users vs. seed characters
  const toDelete: typeof rows = [];
  const skipped: typeof rows = [];

  for (const row of rows) {
    const profileId = String(row.profile_id ?? "");
    if (SEED_PROFILE_IDS.has(profileId)) {
      skipped.push(row);
    } else {
      toDelete.push(row);
    }
  }

  // Report what we found
  console.log(`Found ${rows.length} demo item row(s) total:`);
  console.log(`  ${toDelete.length} in REAL user vaults → will ${DRY_RUN ? "be listed (dry run)" : "DELETE"}`);
  console.log(`  ${skipped.length} in seed character vaults → SKIPPING\n`);

  if (toDelete.length > 0) {
    console.log("Real user rows to delete:");
    for (const row of toDelete) {
      console.log(`  item_id=${row.id}  profile_id=${row.profile_id}  title="${row.title}"  created_at=${row.created_at}`);
    }
    console.log("");
  }

  if (skipped.length > 0) {
    console.log("Seed character rows (skipped):");
    for (const row of skipped) {
      console.log(`  item_id=${row.id}  profile_id=${row.profile_id}  title="${row.title}"`);
    }
    console.log("");
  }

  if (DRY_RUN) {
    console.log("🟡 Dry run complete — no changes made.");
    console.log("   Re-run with --execute to apply deletes.\n");
    return;
  }

  if (toDelete.length === 0) {
    console.log("✅ Nothing to delete in real user vaults.");
    return;
  }

  // Delete — one batch, only the real-user rows
  const idsToDelete = toDelete.map((r) => r.id);
  const profilesAffected = [...new Set(toDelete.map((r) => r.profile_id))];

  // Delete per profile to be extra safe (avoids accidentally touching seed profiles
  // even if SEED_PROFILE_IDS ever gets out of date)
  let totalDeleted = 0;
  for (const profileId of profilesAffected) {
    if (SEED_PROFILE_IDS.has(String(profileId))) {
      console.warn(`⚠️  Skipping profile ${profileId} — matches seed list.`);
      continue;
    }

    const { error: delError, count } = await supabase
      .from("vault_items")
      .delete({ count: "exact" })
      .in("id", idsToDelete)
      .eq("profile_id", profileId);

    if (delError) {
      console.error(`❌ Delete failed for profile ${profileId}:`, delError.message);
    } else {
      console.log(`✅ Deleted ${count ?? "?"} row(s) for profile ${profileId}`);
      totalDeleted += count ?? 0;
    }
  }

  console.log(`\n✅ Done — ${totalDeleted} demo item(s) removed from real user vaults.\n`);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
