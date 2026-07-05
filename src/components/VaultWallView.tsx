"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { useResolvedVaultImage } from "@/lib/useResolvedVaultImages";
import { type VaultItem } from "@/lib/vaultModel";

/* ── Types ─────────────────────────────────────────────────────── */

type SaleInfo = { id: string; soldPrice?: number; soldAt?: number };

interface VaultWallViewProps {
  items: VaultItem[];
  saleMap: Record<string, SaleInfo | undefined>;
}

/* ── Constants ─────────────────────────────────────────────────── */

const UNIVERSE_ORDER: UniverseKey[] = [
  "POP_CULTURE", "SPORTS", "TCG", "MUSIC",
  "JEWELRY_APPAREL", "GAMES", "BUILT_BOTANY", "ART", "AUTOMOTIVE", "MISC",
];

const SHORT_LABEL: Record<UniverseKey, string> = {
  POP_CULTURE:     "Pop Culture",
  SPORTS:          "Sports",
  TCG:             "TCG",
  MUSIC:           "Music",
  JEWELRY_APPAREL: "Jewelry",
  GAMES:           "Games",
  BUILT_BOTANY:    "Botany",
  MISC:            "Misc",
  AUTOMOTIVE:      "Auto",
  ART:             "Art",
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

/* ── Small cover tile ──────────────────────────────────────────── */

function WallTile({
  item,
  size,
  isSold,
}: {
  item: VaultItem;
  size: number;
  isSold: boolean;
}) {
  const image = useResolvedVaultImage(item);
  const href = isSold ? `/vault/item/${item.id}?sold=1` : `/vault/item/${item.id}`;

  return (
    <Link
      href={href}
      title={item.title}
      className="group relative block overflow-hidden rounded-[6px] bg-black/30 ring-1 ring-white/8 transition hover:ring-gold/40 hover:scale-[1.04]"
      style={{ aspectRatio: "2/3" }}
    >
      {image ? (
        <ProgressiveImage
          src={image}
          alt={item.title}
          className="h-full w-full"
          imageClassName="object-cover object-center"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold uppercase tracking-widest text-white/20">
          No<br />photo
        </div>
      )}

      {/* Hover overlay with title */}
      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <p
          className="w-full px-1 pb-1 text-center font-semibold text-white leading-tight"
          style={{ fontSize: Math.max(8, size * 1.4) + "px" }}
        >
          {item.title}
        </p>
      </div>

      {isSold && (
        <span className="absolute left-1 top-1 rounded-full bg-amber-500/90 px-1 py-px text-[7px] font-bold text-black">
          SOLD
        </span>
      )}
    </Link>
  );
}

/* ── Main component ────────────────────────────────────────────── */

export default function VaultWallView({ items, saleMap }: VaultWallViewProps) {
  const [universe, setUniverse] = useState<"ALL" | UniverseKey>("ALL");
  const [cols, setCols] = useState(7);
  const [query, setQuery] = useState("");
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* universe inference (same logic as vault page) */
  function inferUniverse(item: VaultItem): UniverseKey {
    const raw = typeof item.universe === "string" ? item.universe.trim().toUpperCase() : "";
    if (raw && UNIVERSE_LABEL[raw as UniverseKey]) return raw as UniverseKey;
    return "MISC";
  }

  /* Filtered + sorted items */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => {
        if (universe !== "ALL" && inferUniverse(item) !== universe) return false;
        if (q) {
          const text = [item.title, item.subtitle, item.number, item.notes, item.categoryLabel]
            .filter(Boolean).join(" ").toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? "")));
  }, [items, universe, query]);

  /* Group by first letter */
  const grouped = useMemo(() => {
    const map: Record<string, VaultItem[]> = {};
    for (const item of filtered) {
      const first = (item.title ?? "").trim().toUpperCase()[0] ?? "#";
      const key = /[A-Z]/.test(first) ? first : "#";
      (map[key] ??= []).push(item);
    }
    return map;
  }, [filtered]);

  /* Which letters actually have items */
  const activeLetters = useMemo(() => new Set(Object.keys(grouped)), [grouped]);

  function jumpTo(letter: string) {
    letterRefs.current[letter]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* Universe counts */
  const universeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: items.length };
    for (const item of items) {
      const u = inferUniverse(item);
      counts[u] = (counts[u] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  return (
    <div className="mt-3 max-w-[1500px] mx-auto px-3">
      {/* ── Controls bar ── */}
      <div
        className="sticky top-0 z-20 rounded-[14px] px-3 py-2.5 mb-3"
        style={{
          background: "var(--theme-card, rgba(10,18,36,0.96))",
          border: "1px solid var(--theme-border, rgba(245,181,72,0.12))",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Row 1: search + slider */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 rounded-full bg-white/8 px-3 text-[13px] ring-1 ring-white/12 focus:outline-none focus:ring-gold/40 w-40"
          />

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] text-white/40">Size</span>
            <input
              type="range"
              min={3}
              max={12}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
              className="w-28 accent-gold"
            />
            <span className="text-[11px] text-white/40 w-4">{cols}</span>
          </div>

          <span className="text-[11px] text-white/40">
            {filtered.length} items
          </span>
        </div>

        {/* Row 2: universe pills */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          <button
            type="button"
            onClick={() => setUniverse("ALL")}
            className={[
              "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition",
              universe === "ALL"
                ? "bg-gold/20 text-gold ring-gold/40"
                : "bg-white/6 text-white/55 ring-white/12 hover:text-white/80",
            ].join(" ")}
          >
            All ({universeCounts.ALL ?? 0})
          </button>
          {UNIVERSE_ORDER.map((key) => {
            const count = universeCounts[key] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setUniverse(key)}
                className={[
                  "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition",
                  universe === key
                    ? "bg-gold/20 text-gold ring-gold/40"
                    : "bg-white/6 text-white/55 ring-white/12 hover:text-white/80",
                ].join(" ")}
              >
                {SHORT_LABEL[key]} ({count})
              </button>
            );
          })}
        </div>

        {/* Row 3: A-Z nav */}
        <div className="mt-2 flex gap-0.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {LETTERS.map((letter) => {
            const active = activeLetters.has(letter);
            return (
              <button
                key={letter}
                type="button"
                disabled={!active}
                onClick={() => jumpTo(letter)}
                className={[
                  "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold transition",
                  active
                    ? "text-white/80 hover:bg-gold/20 hover:text-gold"
                    : "text-white/18 cursor-default",
                ].join(" ")}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Cover grid ── */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-[13px] text-white/30">No items match.</div>
      ) : (
        <div className="space-y-6 pb-16">
          {LETTERS.map((letter) => {
            const group = grouped[letter];
            if (!group?.length) return null;
            return (
              <div
                key={letter}
                ref={(el) => { letterRefs.current[letter] = el; }}
              >
                <div className="mb-2 text-[11px] font-bold tracking-[0.2em] text-white/30">
                  {letter}
                </div>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {group.map((item) => (
                    <WallTile
                      key={item.id}
                      item={item}
                      size={cols}
                      isSold={Boolean(saleMap[item.id])}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
