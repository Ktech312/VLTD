// scripts/generateCharacterSeed.ts
// Run: npx ts-node scripts/generateCharacterSeed.ts
// Outputs: supabase/seed-characters.sql

import * as fs from "fs";
import * as path from "path";
import { SEED_CHARACTERS } from "../src/lib/seedCharacters";
import { SEED_CHARACTERS_PART2 } from "../src/lib/seedCharacters_part2";
import { SEED_CHARACTERS_PART3 } from "../src/lib/seedCharacters_part3";
import { SEED_CHARACTERS_PART4 } from "../src/lib/seedCharacters_part4";

const ALL_CHARACTERS = [
  ...SEED_CHARACTERS,
  ...SEED_CHARACTERS_PART2,
  ...SEED_CHARACTERS_PART3,
  ...SEED_CHARACTERS_PART4,
];

function sq(s: string | undefined | null): string {
  if (s == null) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}
function num(n: number | undefined | null): string {
  if (n == null) return "NULL";
  return String(n);
}
function bool(b: boolean | undefined): string {
  return b ? "true" : "false";
}

const now = Date.now();
const lines: string[] = [];

lines.push("-- VLTD Seed Characters — auto-generated");
lines.push("-- Run in Supabase SQL Editor → paste entire file");
lines.push(`-- Generated: ${new Date().toISOString()}`);
lines.push("");

// ── public_profiles ─────────────────────────────────────────
lines.push("-- ══════════════════════════════════════");
lines.push("-- PROFILES");
lines.push("-- ══════════════════════════════════════");
lines.push("INSERT INTO public_profiles (profile_id, display_name, avatar_emoji, updated_at)");
lines.push("VALUES");
const profileRows = ALL_CHARACTERS.map((c) =>
  `  (${sq(c.profileId)}, ${sq(c.displayName)}, ${sq(c.avatarEmoji)}, now())`
);
lines.push(profileRows.join(",\n"));
lines.push("ON CONFLICT (profile_id) DO UPDATE");
lines.push("  SET display_name = EXCLUDED.display_name,");
lines.push("      avatar_emoji = EXCLUDED.avatar_emoji,");
lines.push("      updated_at = now();");
lines.push("");

// ── vault_items ──────────────────────────────────────────────
lines.push("-- ══════════════════════════════════════");
lines.push("-- VAULT ITEMS");
lines.push("-- ══════════════════════════════════════");

for (const char of ALL_CHARACTERS) {
  lines.push(`-- ${char.displayName}`);
  lines.push(
    "INSERT INTO vault_items (id, profile_id, title, subtitle, universe, category, notes, current_value, purchase_price, is_public, status, created_at, is_new)"
  );
  lines.push("VALUES");
  const itemRows = char.items.map((item, i) => {
    const createdAt = now - (char.items.length - i) * 3600000;
    return (
      `  (${sq(item.id)}, ${sq(char.profileId)}, ${sq(item.title)}, ${sq(item.subtitle)}, ` +
      `${sq(item.universe)}, ${sq(item.category)}, ${sq(item.notes)}, ` +
      `${num(item.currentValue)}, ${num(item.purchasePrice)}, ` +
      `${bool(item.isPublic)}, ${sq(item.status)}, ${createdAt}, false)`
    );
  });
  lines.push(itemRows.join(",\n"));
  lines.push("ON CONFLICT (id) DO UPDATE");
  lines.push("  SET title = EXCLUDED.title,");
  lines.push("      current_value = EXCLUDED.current_value,");
  lines.push("      is_public = EXCLUDED.is_public;");
  lines.push("");
}

// ── galleries ────────────────────────────────────────────────
lines.push("-- ══════════════════════════════════════");
lines.push("-- GALLERIES");
lines.push("-- ══════════════════════════════════════");

for (const char of ALL_CHARACTERS) {
  for (const gallery of char.galleries) {
    const itemIdsJson = JSON.stringify(gallery.itemIds).replace(/'/g, "''");
    const layout = JSON.stringify({ type: "CURATED", sections: [] }).replace(/'/g, "''");
    const exhibitionLayout = JSON.stringify({
      type: "CURATED",
      sections: [
        {
          id: `section_${gallery.id}_1`,
          title: gallery.title,
          description: gallery.description,
          itemIds: gallery.itemIds,
        },
      ],
    }).replace(/'/g, "''");

    lines.push(`INSERT INTO galleries (`);
    lines.push(`  id, profile_id, title, description, item_ids,`);
    lines.push(`  visibility, state, layout, exhibition_layout,`);
    lines.push(`  theme_pack, display_mode, shelf_overlay_style,`);
    lines.push(`  created_at, updated_at`);
    lines.push(`) VALUES (`);
    lines.push(`  ${sq(gallery.id)}, ${sq(char.profileId)}, ${sq(gallery.title)}, ${sq(gallery.description)},`);
    lines.push(`  '${itemIdsJson}',`);
    lines.push(`  'PUBLIC', 'PUBLISHED', '${layout}', '${exhibitionLayout}',`);
    lines.push(`  ${sq(gallery.themePack)}, 'shelf', 'none',`);
    lines.push(`  ${now}, ${now}`);
    lines.push(`) ON CONFLICT (id) DO UPDATE`);
    lines.push(`  SET title = EXCLUDED.title,`);
    lines.push(`      updated_at = EXCLUDED.updated_at;`);
    lines.push(``);
  }
}

lines.push("-- Seed complete.");

const outPath = path.join(__dirname, "../supabase/seed-characters.sql");
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`✓ Written to ${outPath}`);
console.log(`  ${ALL_CHARACTERS.length} characters`);
console.log(`  ${ALL_CHARACTERS.reduce((s, c) => s + c.items.length, 0)} items`);
console.log(`  ${ALL_CHARACTERS.reduce((s, c) => s + c.galleries.length, 0)} galleries`);
