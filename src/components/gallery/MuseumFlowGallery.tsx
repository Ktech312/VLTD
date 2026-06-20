"use client";

import Link from "next/link";
import { useState } from "react";

import FavoriteButton from "@/components/FavoriteButton";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

function itemMeta(item: VaultItem) {
  return [item.subtitle, item.number, item.grade].filter(Boolean).join(" - ");
}

function itemImage(item: VaultItem) {
  return getPrimaryImageUrl(item) || item.imageFrontUrl || item.imageBackUrl || "";
}

function ActionIcon({
  type,
  filled = false,
}: {
  type: "heart" | "comment" | "share";
  filled?: boolean;
}) {
  if (type === "comment") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.4 8.4 0 0 1-8.8 8.2 9.6 9.6 0 0 1-3.8-.8L3 20l1.2-4.1a8.1 8.1 0 0 1-1-4.1A8.4 8.4 0 0 1 12 3.7a8.4 8.4 0 0 1 9 7.8Z" />
      </svg>
    );
  }

  if (type === "share") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 8.6c0 5-8.8 10.1-8.8 10.1S3.2 13.6 3.2 8.6A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.3Z" />
    </svg>
  );
}

function ActionButton({
  label,
  children,
  onClick,
  active = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "inline-flex h-11 w-11 items-center justify-center rounded-full border transition",
        active
          ? "border-rose-200/50 bg-rose-400/15 text-rose-100"
          : "border-white/14 bg-white/[0.04] text-white/82 hover:border-cyan-200/35 hover:text-cyan-100",
      ].join(" ")}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export default function MuseumFlowGallery({
  title,
  items,
  hrefPrefix,
  className = "",
}: {
  title: string;
  items: VaultItem[];
  hrefPrefix?: string;
  className?: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");

  const safeItems = items.filter(Boolean);
  const selectedItem = safeItems[Math.min(selectedIndex, Math.max(safeItems.length - 1, 0))];

  const totalValue = safeItems.reduce((sum, item) => {
    const value = typeof item.currentValue === "number" && Number.isFinite(item.currentValue) ? item.currentValue : 0;
    return sum + value;
  }, 0);

  async function shareItem(item: VaultItem) {
    const url = typeof window !== "undefined" ? `${window.location.href.split("#")[0]}#item-${item.id}` : "";
    const text = `${item.title} in ${title}`;

    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ title: item.title, text, url });
        setMessage("Share sheet opened.");
        return;
      }

      const clipboard = typeof window !== "undefined" ? window.navigator.clipboard : undefined;
      if (clipboard && url) {
        await clipboard.writeText(url);
        setMessage("Share link copied.");
      }
    } catch {
      setMessage("Share cancelled.");
    }
  }

  function toggleLike(itemId: string) {
    setLikedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  if (!selectedItem) {
    return (
      <section className={["rounded-[28px] border border-white/10 bg-black/18 p-8 text-center text-[color:var(--muted)]", className].join(" ")}>
        This gallery does not currently contain visible items.
      </section>
    );
  }

  const selectedImage = itemImage(selectedItem);
  const selectedMeta = itemMeta(selectedItem);
  const selectedLiked = likedIds.has(selectedItem.id);
  const formattedValue =
    totalValue > 0
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(totalValue)
      : "Private";

  return (
    <section className={["mx-auto max-w-6xl", className].join(" ")}>
      <div className="overflow-hidden rounded-[30px] border border-white/12 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,rgba(16,20,28,0.94),rgba(8,10,14,0.96))] shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
        <div className="border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">MUSEUM COLLECTION</div>
              <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{title}</h2>
            </div>

            <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-sm">
              <div className="min-w-[86px] px-4 py-3">
                <div className="text-[10px] text-[color:var(--muted2)]">Posts</div>
                <div className="mt-1 font-semibold">{safeItems.length}</div>
              </div>
              <div className="min-w-[86px] border-x border-white/10 px-4 py-3">
                <div className="text-[10px] text-[color:var(--muted2)]">Likes</div>
                <div className="mt-1 font-semibold">{likedIds.size}</div>
              </div>
              <div className="min-w-[86px] px-4 py-3">
                <div className="text-[10px] text-[color:var(--muted2)]">Value</div>
                <div className="mt-1 font-semibold">{formattedValue}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-6">
          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">GALLERY STACK</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">Tap a card to bring it forward.</div>
              </div>
              <div className="rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/76 ring-1 ring-white/10">
                {selectedIndex + 1} / {safeItems.length}
              </div>
            </div>

            <div className="flex snap-x gap-0 overflow-x-auto pb-5 pt-2 [scrollbar-width:thin]">
              {safeItems.map((item, index) => {
                const image = itemImage(item);
                const active = index === selectedIndex;

                return (
                  <button
                    id={`item-${item.id}`}
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className={[
                      "group relative min-h-[270px] w-[176px] shrink-0 snap-center rounded-[24px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(232,236,238,0.9))] p-3 text-left text-slate-950 shadow-[0_18px_35px_rgba(0,0,0,0.22)] transition duration-300 sm:w-[196px]",
                      index > 0 ? "-ml-16 sm:-ml-20" : "",
                      active
                        ? "z-30 -translate-y-2 scale-[1.03] border-cyan-200/60"
                        : "z-10 border-white/45 hover:z-20 hover:-translate-y-1 hover:scale-[1.01]",
                    ].join(" ")}
                    style={{ transform: `${active ? "translateY(-8px) scale(1.03)" : ""} rotate(${(index % 5) - 2}deg)` }}
                    aria-pressed={active}
                  >
                    <div className="aspect-[4/5] overflow-hidden rounded-[18px] bg-slate-200 p-2 ring-1 ring-slate-900/10">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={item.title} className="h-full w-full object-contain" draggable={false} loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>
                      )}
                    </div>
                    <div className="mt-3 line-clamp-2 text-sm font-black leading-tight">{item.title}</div>
                    <div className="mt-1 line-clamp-1 text-xs text-slate-500">{itemMeta(item) || ""}</div>
                    <div className="mt-3 flex items-center gap-3 text-slate-500">
                      <ActionIcon type="heart" filled={likedIds.has(item.id)} />
                      <ActionIcon type="comment" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/12 bg-white/[0.05] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="aspect-[4/5] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(0,0,0,0.22))] p-4 ring-1 ring-white/10">
              {selectedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedImage} alt={selectedItem.title} className="h-full w-full object-contain" draggable={false} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">No image</div>
              )}
            </div>

            <div className="mt-4">
              <div className="line-clamp-2 text-xl font-semibold text-white">{selectedItem.title}</div>
              <div className="mt-1 min-h-5 text-sm text-[color:var(--muted)]">{selectedMeta || ""}</div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ActionButton label={selectedLiked ? "Unlike item" : "Like item"} active={selectedLiked} onClick={() => toggleLike(selectedItem.id)}>
                  <ActionIcon type="heart" filled={selectedLiked} />
                </ActionButton>
                <ActionButton label="Comment" onClick={() => setMessage("Comments are coming soon.")}>
                  <ActionIcon type="comment" />
                </ActionButton>
                <ActionButton label="Share item" onClick={() => void shareItem(selectedItem)}>
                  <ActionIcon type="share" />
                </ActionButton>
              </div>

              <FavoriteButton
                contentType="item"
                contentId={String(selectedItem.id)}
                metadata={{ title: selectedItem.title, subtitle: selectedItem.subtitle, image: selectedImage || "" }}
                label="Save item"
                compact
                showMessage={false}
              />
            </div>

            {hrefPrefix ? (
              <Link
                href={`${hrefPrefix}/${selectedItem.id}`}
                className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/12 transition hover:bg-white/[0.12]"
              >
                Open Exhibit
              </Link>
            ) : null}

            {message ? (
              <div className="mt-3 rounded-2xl bg-black/22 px-3 py-2 text-xs text-[color:var(--muted)] ring-1 ring-white/10">
                {message}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}
