"use client";

import Link from "next/link";
import { useState } from "react";

import { ActionMenu } from "@/components/ui/ActionMenu";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";
import WantForm from "@/components/wants/WantForm";
import { acquiredOf, formatMoney, needsRemovalRecord, quantityOf, releaseLabel, withStatus } from "@/lib/wantsCore";
import type { WatchlistItem } from "@/lib/watchlistModel";
import type { WishlistItem } from "@/lib/wishlistModel";

const line = "rgba(203,208,213,0.18)";

const UNIVERSE_TAG: Record<string, string> = { POP_CULTURE: "Pop", SPORTS: "Sport", TCG: "TCG", MUSIC: "Music", JEWELRY_APPAREL: "Style", GAMES: "Game", BUILT_BOTANY: "Make", MISC: "Other", AUTOMOTIVE: "Auto", ART: "Art" };
function tagFor(w: { category?: string; universe?: string }): string {
  return (w.category && w.category.trim() ? w.category.trim() : UNIVERSE_TAG[w.universe ?? ""] ?? "Item").slice(0, 5);
}

function Thumb({ src, label }: { src?: string; label: string }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[6px] border text-[9px] font-semibold uppercase tracking-[0.06em]" style={{ borderColor: line, background: "var(--theme-elevated, #1c2228)", color: "var(--muted2, #8d949b)" }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        label.slice(0, 5)
      )}
    </span>
  );
}

function SourceLink({ url, children }: { url?: string; children: React.ReactNode }) {
  if (!url) return null;
  if (url.startsWith("/")) return <Link href={url} className="underline underline-offset-2" style={{ color: "var(--theme-gold)" }}>{children}</Link>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: "var(--theme-gold)" }}>{children} <AppIcon name="externalLink" size={11} className="inline" /></a>;
}

function Stepper({ want, onStatus, onAcquire }: { want: WishlistItem; onStatus: (s: "want" | "preordered") => void; onAcquire: () => void }) {
  const status = want.status ?? "want";
  if (status === "acquired") return <span className="rounded-full border px-3 py-1 text-[12px] font-semibold text-emerald-400" style={{ borderColor: "rgba(84,201,138,0.5)" }}>Acquired</span>;
  if (status === "skipped") return <span className="rounded-full border px-3 py-1 text-[12px]" style={{ borderColor: line, color: "var(--muted)" }}>Skipped</span>;
  const seg = (key: string, label: string, on: boolean, click: () => void, title: string) => (
    <button key={key} type="button" onClick={click} aria-pressed={on} title={title} className="min-h-[30px] max-md:min-h-11 px-2.5 text-[12px] font-medium transition" style={{ background: on ? "rgba(82,214,244,0.14)" : "transparent", color: on ? "var(--info, #52d6f4)" : "var(--muted)", borderRight: `1px solid ${line}` }}>
      {label}
    </button>
  );
  return (
    <span className="inline-flex overflow-hidden rounded-[8px] border" style={{ borderColor: line }} role="group" aria-label={`Status of ${want.title}`}>
      {seg("want", "Wanted", status === "want", () => onStatus("want"), "Still wanted")}
      {seg("pre", "Preordered", status === "preordered", () => onStatus("preordered"), "You arranged it with a shop yourself. VLTD places no order.")}
      <button type="button" onClick={onAcquire} className="min-h-[30px] max-md:min-h-11 px-2.5 text-[12px] font-medium" style={{ color: "var(--muted)" }} title="You have it: add it to your Vault">Acquired</button>
    </span>
  );
}

export default function WantRow({
  want,
  open,
  onToggle,
  onChange,
  onAcquire,
  onRemove,
  ruleName,
}: {
  want: WishlistItem;
  open: boolean;
  onToggle: () => void;
  onChange: (next: WishlistItem) => void;
  onAcquire: (w: WishlistItem) => void;
  onRemove: (id: string) => void;
  ruleName?: string;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const qty = quantityOf(want);
  const got = acquiredOf(want);
  const status = want.status ?? "want";
  const price = typeof want.price === "number" ? <>{formatMoney(want.price)}<span className="block text-[11px]" style={{ color: "var(--muted)" }}>{qty > 1 ? "each" : "expected"}{typeof want.targetPrice === "number" ? ` · target ${formatMoney(want.targetPrice)}` : ""}</span></> : <span style={{ color: "var(--muted)" }}>Price unknown{typeof want.targetPrice === "number" ? <span className="block text-[11px]">target {formatMoney(want.targetPrice)}</span> : null}</span>;
  const release = releaseLabel(want);
  const unknownDate = release === "Date unknown";
  const sub = [want.series, want.edition].filter(Boolean).join(" · ") || want.subject || "";
  const qtyChip = qty > 1 || got > 0 ? `${got > 0 ? `${got} of ${qty}` : `x${qty}`}` : null;
  const menu = (
    <ActionMenu
      ariaLabel={`More for ${want.title}`}
      align="right"
      width={220}
      items={[
        { key: "details", label: open ? "Close details" : "Details and edit", onClick: onToggle },
        status === "skipped"
          ? { key: "restore", label: "Restore to wishlist", onClick: () => onChange(withStatus(want, "want")) }
          : { key: "skip", label: "Skip (keep the record)", onClick: () => onChange(withStatus(want, "skipped")) },
        ...(want.sourceUrl && !want.sourceUrl.startsWith("/") ? [{ key: "open", label: "Open source link", onClick: () => window.open(want.sourceUrl, "_blank", "noopener,noreferrer") }] : []),
        { key: "remove", label: "Remove from list…", onClick: () => { if (!open) onToggle(); setConfirmRemove(true); } },
      ]}
      triggerClassName="grid h-9 w-9 place-items-center rounded-[8px] border"
      triggerStyle={{ borderColor: line }}
      triggerChildren={<AppIcon name="more" size={16} />}
    />
  );
  const titleButton = (
    <button type="button" onClick={onToggle} aria-expanded={open} className="block w-full min-w-0 text-left">
      <span className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--theme-text-primary, var(--fg))" }}>{want.title}</span>
      {sub ? <span className="block truncate text-[12px]" style={{ color: "var(--muted)" }}>{sub}</span> : null}
      {ruleName ? <span className="block truncate text-[11px]" style={{ color: "var(--muted2)" }}>From following {ruleName}</span> : null}
    </button>
  );
  const chips = (
    <span className="flex flex-wrap gap-1.5">
      {want.category ? <span className="rounded-[5px] border px-1.5 text-[11px]" style={{ borderColor: line }}>{want.category}</span> : null}
      {qtyChip ? <span className="rounded-[5px] border px-1.5 text-[11px]" style={{ borderColor: line, fontVariantNumeric: "tabular-nums" }}>{qtyChip}</span> : null}
      {want.priority === "high" && status !== "skipped" ? <span className="rounded-[5px] border px-1.5 text-[11px]" style={{ borderColor: "rgba(224,166,76,0.5)", color: "#e0a64c" }}>High</span> : null}
    </span>
  );
  return (
    <div className="rounded-[8px] border" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: open ? "rgba(82,214,244,0.4)" : line, opacity: status === "skipped" ? 0.8 : 1 }} data-testid="want-row" data-status={status}>
      <div className="hidden min-h-[60px] items-center gap-3 px-3 py-2 md:grid md:grid-cols-[44px_minmax(0,1fr)_150px_120px_120px_auto_36px]">
        <Thumb src={want.imageUrl} label={tagFor(want)} />
        {titleButton}
        {chips}
        <span className={`text-[12.5px] ${unknownDate ? "" : ""}`} style={{ color: unknownDate ? "var(--muted)" : undefined }}>{release}</span>
        <span className="text-right text-[12.5px]" style={{ fontVariantNumeric: "tabular-nums" }}>{price}</span>
        <Stepper want={want} onStatus={(s) => onChange(withStatus(want, s))} onAcquire={() => onAcquire(want)} />
        {menu}
      </div>
      <div className="flex flex-col gap-2 px-3 py-2.5 md:hidden">
        <div className="flex items-start gap-3">
          <Thumb src={want.imageUrl} label={tagFor(want)} />
          <div className="min-w-0 flex-1">{titleButton}<div className="mt-1">{chips}</div></div>
          {menu}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-2 text-[12.5px]" style={{ borderColor: line }}>
          <span style={{ color: unknownDate ? "var(--muted)" : undefined }}>{release}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{price}</span>
          <Stepper want={want} onStatus={(s) => onChange(withStatus(want, s))} onAcquire={() => onAcquire(want)} />
        </div>
      </div>
      {open ? (
        <div className="border-t px-3 py-3" style={{ borderColor: line }}>
          <WantForm key={`${want.id}-${want.updatedAt ?? 0}`} initial={want} compact submitLabel="Save changes" onSubmit={(next) => onChange(next)} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3 text-[12px]" style={{ borderColor: line, color: "var(--muted)" }}>
            <span>Preordered means you arranged it yourself with a shop. VLTD has placed no order.{want.sourceUrl ? <> <SourceLink url={want.sourceUrl}>Source link</SourceLink></> : null}</span>
            {confirmRemove ? (
              <span className="flex items-center gap-2"><span>{needsRemovalRecord(want) ? "Remove it? A Following check will not add it back." : "Remove it for good?"}</span><PillButton size="compact" variant="danger" onClick={() => onRemove(want.id)}>Remove</PillButton><PillButton size="compact" onClick={() => setConfirmRemove(false)}>Keep</PillButton></span>
            ) : (
              <PillButton size="compact" onClick={() => setConfirmRemove(true)}>Remove…</PillButton>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Something being watched: someone else's public item. It is a reference, never an owned record. */
export function WatchingRow({ item, onAdd, onStop, added }: { item: WatchlistItem; onAdd: () => void; onStop: () => void; added: boolean }) {
  const source = item.profileId ? `/v/${encodeURIComponent(item.profileId)}` : undefined;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[8px] border px-3 py-2" style={{ background: "var(--theme-card, rgba(15,25,45,0.85))", borderColor: line }} data-testid="watching-row">
      <Thumb src={item.imageFrontUrl} label="Watch" />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold">{item.title}</span>
        <span className="block truncate text-[12px]" style={{ color: "var(--muted)" }}>Someone else&apos;s item{item.collectorName ? ` · ${item.collectorName}` : ""}{item.currentValue ? ` · listed value ${formatMoney(item.currentValue)}` : ""} · <SourceLink url={source}>Source</SourceLink></span>
      </div>
      <span className="rounded-[5px] border px-1.5 text-[11px] font-semibold" style={{ borderColor: "rgba(82,214,244,0.5)", color: "var(--info, #52d6f4)" }}>Watching</span>
      <PillButton size="compact" onClick={onAdd} disabled={added}>{added ? "In my wants" : "Add to my wants"}</PillButton>
      <PillButton size="compact" onClick={onStop} ariaLabel={`Stop watching ${item.title}`}>Stop watching</PillButton>
    </div>
  );
}
