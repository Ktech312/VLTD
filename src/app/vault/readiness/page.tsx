"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { computeReadiness } from "@/components/ListingReadinessPanel";
import { getPrimaryImageUrl, loadItems, type VaultItem } from "@/lib/vaultModel";

// ─── helpers ──────────────────────────────────────────────────────────────────

function levelLabel(level: string) {
  if (level === "ready") return "Ready";
  if (level === "almost") return "Almost";
  return "Needs work";
}

function levelColor(level: string) {
  if (level === "ready") return "#4ade80";
  if (level === "almost") return "var(--theme-gold)";
  return "#f87171";
}

function levelBg(level: string) {
  if (level === "ready") return "rgba(74,222,128,0.12)";
  if (level === "almost") return "rgba(203,208,213,0.10)";
  return "rgba(248,113,113,0.10)";
}

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score, level }: { score: number; level: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${score}%`, background: levelColor(level) }}
      />
    </div>
  );
}

// ─── ItemRow ─────────────────────────────────────────────────────────────────

function ItemRow({ item }: { item: VaultItem }) {
  const result = computeReadiness(item);
  const imageUrl = getPrimaryImageUrl(item) || "";
  const missingRequired = result.checks.filter((c) => c.required && !c.passed);
  const missingOptional = result.checks.filter((c) => !c.required && !c.passed);

  return (
    <div
      className="rounded-2xl ring-1 overflow-hidden transition hover:ring-[color:var(--theme-gold)]"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <Link href={`/vault/item/${item.id}`} className="shrink-0">
          <div
            className="rounded-xl overflow-hidden"
            style={{ width: 56, height: 56, background: "var(--pill)" }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl opacity-30">🗝️</div>
            )}
          </div>
        </Link>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <Link href={`/vault/item/${item.id}`}>
            <div className="truncate text-sm font-semibold" style={{ color: "var(--fg)" }}>
              {item.title || "Untitled item"}
            </div>
          </Link>
          {item.askingPrice ? (
            <div className="text-xs font-bold mt-0.5" style={{ color: "var(--theme-gold)" }}>
              ${item.askingPrice.toLocaleString()}
            </div>
          ) : (
            <div className="text-xs mt-0.5" style={{ color: "#f87171" }}>No price set</div>
          )}
          <div className="mt-1.5">
            <ScoreBar score={result.score} level={result.level} />
          </div>
        </div>

        {/* Badge */}
        <div
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: levelBg(result.level), color: levelColor(result.level) }}
        >
          {levelLabel(result.level)}
        </div>
      </div>

      {/* Missing items */}
      {(missingRequired.length > 0 || missingOptional.length > 0) && (
        <div
          className="flex flex-wrap gap-1.5 px-3 pb-3 border-t pt-2"
          style={{ borderColor: "var(--border)" }}
        >
          {missingRequired.map((c) => (
            <Link
              key={c.key}
              href={c.actionHref ?? `/vault/item/${item.id}`}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition hover:brightness-110"
              style={{ background: "rgba(248,113,113,0.10)", color: "#f87171", borderColor: "rgba(248,113,113,0.25)" }}
            >
              + {c.label}
            </Link>
          ))}
          {missingOptional.map((c) => (
            <Link
              key={c.key}
              href={c.actionHref ?? `/vault/item/${item.id}`}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition hover:brightness-110"
              style={{ background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}
            >
              + {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type LevelFilter = "all" | "ready" | "almost" | "incomplete";

export default function ReadinessPage() {
  const [filter, setFilter] = useState<LevelFilter>("all");

  const forSaleItems = useMemo(() => {
    const all = loadItems({ includeAllProfiles: false });
    return all.filter((i) => i.status === "FOR_SALE");
  }, []);

  const withScores = useMemo(
    () =>
      forSaleItems.map((item) => ({ item, result: computeReadiness(item) }))
        .sort((a, b) => b.result.score - a.result.score),
    [forSaleItems]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return withScores;
    return withScores.filter((x) => x.result.level === filter);
  }, [withScores, filter]);

  const readyCount = withScores.filter((x) => x.result.level === "ready").length;
  const almostCount = withScores.filter((x) => x.result.level === "almost").length;
  const incompleteCount = withScores.filter((x) => x.result.level === "incomplete").length;

  const TABS: { key: LevelFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: forSaleItems.length },
    { key: "ready", label: "Ready", count: readyCount },
    { key: "almost", label: "Almost", count: almostCount },
    { key: "incomplete", label: "Needs work", count: incompleteCount },
  ];

  return (
    <div className="" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link href="/vault" className="text-sm" style={{ color: "var(--muted)" }}>Vault</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Listing Readiness</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold" style={{ color: "var(--fg)" }}>Listing Readiness</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Check which of your for-sale listings are market-ready.
          </p>

          {/* Stats */}
          {forSaleItems.length > 0 && (
            <div className="mt-4 flex items-center gap-6">
              <div>
                <span className="text-lg font-bold" style={{ color: "#4ade80" }}>{readyCount}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>ready</span>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: "var(--theme-gold)" }}>{almostCount}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>almost</span>
              </div>
              <div>
                <span className="text-lg font-bold" style={{ color: "#f87171" }}>{incompleteCount}</span>
                <span className="ml-1.5 text-xs" style={{ color: "var(--muted)" }}>needs work</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {forSaleItems.length === 0 ? (
          <div
            className="rounded-2xl px-6 py-14 text-center ring-1"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="text-4xl">🏷️</div>
            <div className="mt-4 text-base font-semibold" style={{ color: "var(--fg)" }}>
              No for-sale listings yet
            </div>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Mark items as "For Sale" in your vault to see their listing readiness here.
            </p>
            <Link
              href="/vault"
              className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
              style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}
            >
              Go to Vault →
            </Link>
          </div>
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex gap-1 rounded-xl p-1 mb-4" style={{ background: "var(--pill)" }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                  style={
                    filter === t.key
                      ? { background: "var(--theme-gold)", color: "#0B0B0B" }
                      : { color: "var(--muted)" }
                  }
                >
                  {t.label}
                  {t.count > 0 && <span className="ml-1.5 opacity-70">{t.count}</span>}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: "var(--muted)" }}>
                No listings in this category.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(({ item }) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
