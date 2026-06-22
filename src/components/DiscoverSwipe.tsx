"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { addToWatchlist, isWatchlisted, type WatchlistItem } from "@/lib/watchlistModel";
import { getSeedAvatarUrlForProfile, isRenderableAvatarUrl } from "@/lib/seedAvatar";
import { getAppreciationCounts, getAppreciatedSet } from "@/lib/appreciations";
import { VibeButton } from "@/components/social/VibeButton";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function getActiveProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

/* ── Types ─────────────────────────────────────────────────── */

type FlipCard = {
  id: string;
  title: string;
  subtitle?: string;
  grade?: string;
  currentValue?: number;
  imageFrontUrl?: string;
  profileId: string;
  collectorName: string;
  collectorAvatarUrl: string;
  vibeCount: number;
  viewerVibed: boolean;
};

/* ── Helpers ────────────────────────────────────────────────── */

function fmtValue(v?: number) {
  if (!v || !Number.isFinite(v) || v <= 0) return null;
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/* ── Swipe card ─────────────────────────────────────────────── */

type CardProps = {
  card: FlipCard;
  onSwipe: (dir: "left" | "right") => void;
  active: boolean;
  viewerProfileId: string;
};

function SwipeCard({ card, onSwipe, active, viewerProfileId }: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const dragging = useRef(false);
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<"left" | "right" | null>(null);
  const savedRef = useRef(isWatchlisted(card.id));

  const THRESHOLD = 80;

  function onPointerDown(e: React.PointerEvent) {
    if (!active) return;
    dragging.current = true;
    startX.current = e.clientX;
    currentX.current = e.clientX;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    currentX.current = e.clientX;
    setDx(currentX.current - startX.current);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const delta = currentX.current - startX.current;
    if (Math.abs(delta) >= THRESHOLD) {
      const dir = delta > 0 ? "right" : "left";
      setFlying(dir);
      setTimeout(() => onSwipe(dir), 320);
    } else {
      setDx(0);
    }
  }

  const rotate = flying === "right" ? 25 : flying === "left" ? -25 : dx * 0.05;
  const translateX = flying === "right" ? 600 : flying === "left" ? -600 : dx;
  const opacity = flying ? 0 : 1;

  const showSave = dx > 40;
  const showSkip = dx < -40;

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
      style={{
        transform: `translateX(${translateX}px) rotate(${rotate}deg)`,
        opacity,
        transition: dragging.current ? "none" : flying ? "transform 0.32s ease-in, opacity 0.32s ease-in" : "transform 0.18s ease-out",
        touchAction: "none",
      }}
    >
      <div
        className="h-full w-full overflow-hidden rounded-[28px] shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Image */}
        <div className="relative h-[55%] w-full overflow-hidden bg-black/30">
          {card.imageFrontUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imageFrontUrl}
              alt={card.title}
              className="h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl opacity-30">📦</div>
          )}

          {/* Swipe overlays */}
          {showSave && (
            <div className="absolute inset-0 flex items-center justify-center rounded-t-[28px]"
              style={{ background: "rgba(34,197,94,0.25)" }}>
              <div className="rotate-[-15deg] rounded-2xl border-4 border-[rgb(34,197,94)] px-5 py-2 text-2xl font-black"
                style={{ color: "rgb(34,197,94)" }}>
                SAVE
              </div>
            </div>
          )}
          {showSkip && (
            <div className="absolute inset-0 flex items-center justify-center rounded-t-[28px]"
              style={{ background: "rgba(248,113,113,0.25)" }}>
              <div className="rotate-[15deg] rounded-2xl border-4 border-[rgb(248,113,113)] px-5 py-2 text-2xl font-black"
                style={{ color: "rgb(248,113,113)" }}>
                SKIP
              </div>
            </div>
          )}

          {/* Watchlisted badge */}
          {savedRef.current && (
            <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "rgba(245,181,72,0.9)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#0B0B0B">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex h-[45%] flex-col justify-between p-5">
          <div>
            <div className="line-clamp-2 text-xl font-black leading-tight" style={{ color: "var(--fg)" }}>
              {card.title}
            </div>
            {card.subtitle && (
              <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{card.subtitle}</div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {card.grade && (
                <span className="rounded-full px-3 py-1 text-xs font-bold ring-1"
                  style={{ background: "rgba(245,181,72,0.12)", color: "var(--theme-gold, #F5B548)", borderColor: "rgba(245,181,72,0.3)" }}>
                  {card.grade}
                </span>
              )}
              {fmtValue(card.currentValue) && (
                <span className="rounded-full px-3 py-1 text-xs font-bold ring-1"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--fg)", borderColor: "var(--border)" }}>
                  {fmtValue(card.currentValue)}
                </span>
              )}
            </div>
          </div>

          {/* Collector + Vibe */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {card.collectorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.collectorAvatarUrl} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-white/20" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  style={{ background: "var(--pill)" }}>🗝️</div>
              )}
              <span className="text-xs truncate" style={{ color: "var(--muted)" }}>{card.collectorName}</span>
            </div>
            <div onPointerDown={(e) => e.stopPropagation()}>
              <VibeButton
                itemId={card.id}
                profileId={viewerProfileId}
                isOwner={Boolean(viewerProfileId) && card.profileId === viewerProfileId}
                initialCount={card.vibeCount}
                initialVibed={card.viewerVibed}
                size="compact"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function DiscoverSwipe({ open, onClose }: Props) {
  const [cards, setCards] = useState<FlipCard[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [lastAction, setLastAction] = useState<"save" | "skip" | null>(null);
  const [done, setDone] = useState(false);

  // Fetch public items when opened
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setIndex(0);
    setDone(false);
    setLastAction(null);

    async function fetchCards() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setLoading(false); return; }

      const { data: items } = await supabase
        .from("vault_items")
        .select("id, title, subtitle, grade, current_value, image_front_url, profile_id")
        .eq("is_public", true)
        .not("image_front_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(40);

      if (!items || items.length === 0) { setLoading(false); return; }

      const profileIds = [...new Set(items.map((i) => String(i.profile_id)).filter(Boolean))];
      const profileMap = new Map<string, { name: string; avatarUrl: string }>();

      if (profileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("public_profiles")
          .select("profile_id, display_name, avatar_url")
          .in("profile_id", profileIds);

        (profiles ?? []).forEach((p) => {
          profileMap.set(String(p.profile_id), {
            name: String(p.display_name || "Collector"),
            avatarUrl: typeof p.avatar_url === "string" && isRenderableAvatarUrl(p.avatar_url)
              ? p.avatar_url
              : getSeedAvatarUrlForProfile({ profileId: String(p.profile_id), displayName: String(p.display_name || "") }),
          });
        });
      }

      const itemIds = items.map((item) => String(item.id));
      const viewerProfileId = getActiveProfileId();
      const [vibeCounts, vibedSet] = await Promise.all([
        getAppreciationCounts(itemIds),
        getAppreciatedSet(itemIds, viewerProfileId),
      ]);

      const mapped: FlipCard[] = items.map((item) => {
        const profile = profileMap.get(String(item.profile_id));
        const id = String(item.id);
        return {
          id,
          title: String(item.title ?? "Untitled"),
          subtitle: typeof item.subtitle === "string" ? item.subtitle : undefined,
          grade: typeof item.grade === "string" ? item.grade : undefined,
          currentValue: typeof item.current_value === "number" ? item.current_value : undefined,
          imageFrontUrl: typeof item.image_front_url === "string" ? item.image_front_url : undefined,
          profileId: String(item.profile_id ?? ""),
          collectorName: profile?.name ?? "Collector",
          collectorAvatarUrl: profile?.avatarUrl ?? "",
          vibeCount: vibeCounts.get(id) ?? 0,
          viewerVibed: vibedSet.has(id),
        };
      });

      setCards(mapped);
      setLoading(false);
    }

    void fetchCards();
  }, [open]);

  const handleSwipe = useCallback((dir: "left" | "right") => {
    const card = cards[index];
    if (!card) return;

    if (dir === "right") {
      const item: WatchlistItem = {
        id: card.id,
        title: card.title,
        subtitle: card.subtitle,
        grade: card.grade,
        currentValue: card.currentValue,
        imageFrontUrl: card.imageFrontUrl,
        profileId: card.profileId,
        collectorName: card.collectorName,
        savedAt: Date.now(),
      };
      addToWatchlist(item);
      setSavedIds((prev) => new Set([...prev, card.id]));
      setLastAction("save");
    } else {
      setLastAction("skip");
    }

    const nextIndex = index + 1;
    if (nextIndex >= cards.length) {
      setTimeout(() => setDone(true), 100);
    } else {
      setIndex(nextIndex);
    }
  }, [cards, index]);

  function handleButton(dir: "left" | "right") {
    handleSwipe(dir);
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handleSwipe("left");
      if (e.key === "ArrowRight") handleSwipe("right");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleSwipe, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-3">
        <div>
          <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--muted2)" }}>DISCOVER</div>
          <div className="text-xl font-black" style={{ color: "var(--theme-gold, #F5B548)" }}>THE FLIP</div>
        </div>
        <div className="flex items-center gap-3">
          {!loading && !done && cards.length > 0 && (
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {index + 1} / {cards.length}
            </span>
          )}
          {savedIds.size > 0 && (
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: "rgba(245,181,72,0.14)", color: "var(--theme-gold, #F5B548)", border: "1px solid rgba(245,181,72,0.28)" }}>
              ♥ {savedIds.size} saved
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full ring-1 transition"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--muted)" }}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Card area */}
      <div className="relative flex-1 px-5 pb-2">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-3xl animate-pulse">🃏</div>
              <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>Loading items…</div>
            </div>
          </div>
        )}

        {!loading && done && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="text-4xl">✨</div>
            <div className="text-xl font-black" style={{ color: "var(--fg)" }}>You&apos;ve seen it all</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>
              {savedIds.size > 0
                ? `${savedIds.size} item${savedIds.size !== 1 ? "s" : ""} saved to your watchlist.`
                : "Nothing saved this round — flip again anytime."}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setIndex(0); setDone(false); setLastAction(null); }}
                className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 transition"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--fg)" }}
              >
                Flip Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-5 py-2.5 text-sm font-semibold transition"
                style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B" }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {!loading && !done && cards.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <div className="text-3xl">📭</div>
              <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>No public items found yet.</div>
            </div>
          </div>
        )}

        {/* Card stack — render current + next (for depth effect) */}
        {!loading && !done && cards.length > 0 && (
          <>
            {/* Next card (behind) */}
            {cards[index + 1] && (
              <div className="absolute inset-5 scale-[0.96] rounded-[28px] ring-1"
                style={{ background: "var(--surface)", borderColor: "var(--border)", transformOrigin: "bottom center" }} />
            )}
            {/* Active card */}
            <SwipeCard
              key={cards[index].id}
              card={cards[index]}
              onSwipe={handleSwipe}
              active={true}
              viewerProfileId={getActiveProfileId()}
            />
          </>
        )}
      </div>

      {/* Action buttons */}
      {!loading && !done && cards.length > 0 && (
        <div className="shrink-0 flex items-center justify-center gap-8 px-5 pb-8 pt-3">
          {/* Skip */}
          <button
            type="button"
            onClick={() => handleButton("left")}
            className="grid h-[60px] w-[60px] place-items-center rounded-full ring-2 transition active:scale-95"
            style={{ background: "rgba(248,113,113,0.10)", borderColor: "rgba(248,113,113,0.40)", color: "rgba(248,113,113,0.90)" }}
            aria-label="Skip"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Save / Watchlist */}
          <button
            type="button"
            onClick={() => handleButton("right")}
            className="grid h-[60px] w-[60px] place-items-center rounded-full ring-2 transition active:scale-95"
            style={{ background: "rgba(245,181,72,0.12)", borderColor: "rgba(245,181,72,0.45)", color: "#F5B548" }}
            aria-label="Save to watchlist"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      )}

      {/* Hint */}
      {!loading && !done && cards.length > 0 && (
        <div className="shrink-0 pb-5 text-center text-[11px]" style={{ color: "var(--muted2)" }}>
          Swipe right to save · Swipe left to skip
        </div>
      )}
    </div>
  );
}
