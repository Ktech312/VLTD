"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import CollectionValuationScoreCard from "@/components/CollectionValuationScoreCard";
import { getCollectionValuationScore } from "@/lib/collectionValuationScore";
import { getCollectorStrength } from "@/lib/collectorStrength";
import { GALLERY_EVENT, loadGalleries, type Gallery } from "@/lib/galleryModel";
import { formatMoney, getCollectionMetrics } from "@/lib/portfolioMetrics";
import { loadItems, type VaultItem } from "@/lib/vaultModel";

const ACTIVE_PROFILE_EVENT = "vltd:active-profile";

function itemImage(item: VaultItem) {
  return item.imageFrontUrl || item.imageBackUrl || "";
}

function totalItemCost(item: VaultItem) {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

function PillLink({
  href,
  children,
  active = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  const base =
    "inline-flex min-h-[38px] items-center justify-center rounded-full px-4 py-2 text-sm font-medium ring-1 transition vltd-pill-main";
  const styles = active
    ? "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] vltd-pill-main-glow hover:bg-[color:var(--pill-hover)]"
    : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]";
  return (
    <Link href={href} className={[base, styles].join(" ")}>
      {children}
    </Link>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-sm text-[color:var(--muted)]">{hint}</div> : null}
    </div>
  );
}

function QuietCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{children}</div>
    </div>
  );
}

function TinyBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
      {children}
    </span>
  );
}

export default function CollectorProfilePage() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);

  useEffect(() => {
    function refresh() {
      setGalleries(loadGalleries());
      setItems(loadItems());
    }

    refresh();

    function onGalleryChange() {
      refresh();
    }

    function onActiveProfileChange() {
      refresh();
    }

    window.addEventListener(GALLERY_EVENT, onGalleryChange);
    window.addEventListener(ACTIVE_PROFILE_EVENT, onActiveProfileChange);

    return () => {
      window.removeEventListener(GALLERY_EVENT, onGalleryChange);
      window.removeEventListener(ACTIVE_PROFILE_EVENT, onActiveProfileChange);
    };
  }, []);

  const collection = useMemo(() => getCollectionMetrics(items), [items]);
  const valuationScore = useMemo(
    () => getCollectionValuationScore(collection),
    [collection]
  );
  const collectorStrength = useMemo(
    () => getCollectorStrength(collection, valuationScore, galleries.length),
    [collection, valuationScore, galleries.length]
  );

  const stats = useMemo(() => {
    const totalViews = galleries.reduce(
      (sum, gallery) => sum + (gallery.analytics?.views ?? 0),
      0
    );
    const activeGalleries = galleries.filter((gallery) => gallery.state === "ACTIVE").length;
    const curatorNotes = galleries.reduce(
      (sum, gallery) => sum + (gallery.itemNotes?.length ?? 0),
      0
    );

    return {
      totalViews,
      activeGalleries,
      curatorNotes,
    };
  }, [galleries]);

  const featuredGalleries = useMemo(
    () =>
      [...galleries]
        .sort((a, b) => (b.analytics?.views ?? 0) - (a.analytics?.views ?? 0))
        .slice(0, 3),
    [galleries]
  );

  const strongestSource = collection.topSourceSegments[0];
  const strongestCategory = collection.topValueSegments[0];
  const topPerformer = collection.intelligence.topPerformer;
  const highestValue = collection.intelligence.highestValue;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">

        <section className="vltd-panel-main relative overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-5 py-5 shadow-[0_18px_54px_rgba(0,0,0,0.3)] sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),rgba(255,255,255,0)_28%),radial-gradient(circle_at_75%_0%,rgba(255,205,120,0.06),rgba(255,205,120,0)_22%)]" />

          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                COLLECTOR PROFILE
              </div>

              <h1 className="mt-2 text-3xl font-semibold sm:text-[2.2rem]">
                Collection Identity
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
                A cleaner read of the active collector’s strength, collection depth, museum
                activity, and strongest portfolio signals.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <TinyBadge>{collection.totalItems} items</TinyBadge>
                <TinyBadge>{galleries.length} galleries</TinyBadge>
                <TinyBadge>{stats.activeGalleries} active</TinyBadge>
                <TinyBadge>{stats.totalViews} gallery views</TinyBadge>
                <TinyBadge>{stats.curatorNotes} curator notes</TinyBadge>
              </div>
            </div>

            <div className="vltd-panel-soft rounded-[22px] bg-black/16 p-5 ring-1 ring-white/8">
              <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                COLLECTOR STRENGTH
              </div>
              <div className="mt-2 text-3xl font-semibold">{collectorStrength.score}</div>
              <div className="mt-1 text-sm font-medium text-[color:var(--fg)]">
                {collectorStrength.band}
              </div>
              <div className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                {collectorStrength.summary}
              </div>
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="ITEMS" value={collection.totalItems} hint="Vault pieces tracked" />
            <StatCard label="GALLERIES" value={galleries.length} hint="Museum presentations" />
            <StatCard label="ACTIVE" value={stats.activeGalleries} hint="Currently active" />
            <StatCard
              label="TOTAL VALUE"
              value={formatMoney(collection.totalValue)}
              hint="Current collection value"
            />
            <StatCard
              label="ROI"
              value={`${collection.roi >= 0 ? "+" : ""}${collection.roi.toFixed(1)}%`}
              hint="Value vs cost basis"
            />
            <StatCard label="VIEWS" value={stats.totalViews} hint="Audience engagement" />
          </div>
        </section>

        <div className="mt-6">
          <CollectionValuationScoreCard score={valuationScore} />
        </div>

        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="vltd-panel-main rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <SectionHeader
              eyebrow="PROFILE SUMMARY"
              title="What stands out"
              description="The fastest way to understand the collection without digging through every gallery."
            />

            <div className="mt-5 grid gap-4">
              <QuietCard title="Primary concentration">
                {strongestCategory
                  ? `The collection is most concentrated in ${strongestCategory.label}, representing ${strongestCategory.count} items and ${formatMoney(strongestCategory.value)} in current value.`
                  : "No primary concentration is visible yet."}
              </QuietCard>

              <QuietCard title="Acquisition identity">
                {strongestSource
                  ? `The strongest acquisition source is ${strongestSource.label}, with ${strongestSource.count} items contributing ${formatMoney(strongestSource.value)} in collection value.`
                  : "Acquisition source identity will appear as purchase sources are filled in."}
              </QuietCard>

              <QuietCard title="Curatorial readiness">
                {stats.curatorNotes > 0
                  ? `${stats.curatorNotes} curator notes are already written across the museum.`
                  : "Curator notes have not been built out yet."}
              </QuietCard>

              <div className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-sm font-semibold">Collector highlights</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {collectorStrength.highlights.length > 0 ? (
                    collectorStrength.highlights.map((highlight) => (
                      <TinyBadge key={highlight}>{highlight}</TinyBadge>
                    ))
                  ) : (
                    <div className="text-sm text-[color:var(--muted)]">
                      Collector highlights will strengthen as the collection matures.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="vltd-panel-main rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <SectionHeader
              eyebrow="TOP SIGNALS"
              title="Best current indicators"
              description="The strongest single-item and museum-level signals for the active profile."
            />

            <div className="mt-5 grid gap-3">
              <QuietCard title="Top performer">
                <div className="font-semibold text-[color:var(--fg)]">
                  {topPerformer?.title || "No data yet"}
                </div>
                <div className="mt-1">
                  {topPerformer
                    ? `Performance leader in the active collection. Current value ${formatMoney(Number(topPerformer.currentValue ?? 0))}.`
                    : "Performance leader appears once item values are tracked."}
                </div>
              </QuietCard>

              <QuietCard title="Highest value piece">
                <div className="font-semibold text-[color:var(--fg)]">
                  {highestValue?.title || "No data yet"}
                </div>
                <div className="mt-1">
                  {highestValue
                    ? `Largest value anchor in the collector profile at ${formatMoney(Number(highestValue.currentValue ?? 0))}.`
                    : "Highest-value anchor appears once values are tracked."}
                </div>
              </QuietCard>

              <QuietCard title="Museum footprint">
                <div className="font-semibold text-[color:var(--fg)]">
                  {galleries.length} galleries • {stats.totalViews} views
                </div>
                <div className="mt-1">
                  Public exhibition output and audience engagement for the active profile.
                </div>
              </QuietCard>
            </div>
          </div>
        </section>

        <section className="vltd-panel-main mt-6 rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <SectionHeader
            eyebrow="FEATURED GALLERIES"
            title="Most viewed galleries"
            description="Your strongest public museum presentations, sorted by attention."
          />

          {featuredGalleries.length === 0 ? (
            <div className="mt-4 text-sm text-[color:var(--muted)]">
              No galleries available yet.
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {featuredGalleries.map((gallery) => (
                <Link
                  key={gallery.id}
                  href={`/museum/${gallery.id}`}
                  className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)] transition hover:-translate-y-0.5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold">{gallery.title}</div>
                      <div className="mt-1 text-sm text-[color:var(--muted)]">
                        {gallery.itemIds.length} items • {gallery.analytics?.views ?? 0} views
                      </div>
                      <div className="mt-3 text-sm text-[color:var(--muted)]">
                        {gallery.description?.trim()
                          ? gallery.description
                          : "Museum-style presentation from the vault."}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <TinyBadge>{gallery.state}</TinyBadge>
                      <TinyBadge>{gallery.visibility}</TinyBadge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="vltd-panel-main mt-6 rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <SectionHeader
            eyebrow="FEATURED ITEMS"
            title="Top value pieces"
            description="The strongest value anchors in the current active collection."
          />

          {collection.topItems.length === 0 ? (
            <div className="mt-4 text-sm text-[color:var(--muted)]">
              No vault items available yet.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {collection.topItems.map((item) => (
                <article
                  key={item.id}
                  className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]"
                >
                  <div className="flex gap-4">
                    <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-black/20">
                      {itemImage(item) ? (
                        <img
                          src={itemImage(item)}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[color:var(--muted)]">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-lg font-semibold">{item.title}</div>
                      <div className="mt-1 text-sm text-[color:var(--muted)]">
                        {[item.subtitle, item.number, item.grade].filter(Boolean).join(" • ") ||
                          "—"}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <TinyBadge>Value {formatMoney(Number(item.currentValue ?? 0))}</TinyBadge>
                        <TinyBadge>Cost {formatMoney(totalItemCost(item))}</TinyBadge>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}