"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton, pillClassName } from "@/components/ui/PillButton";
import FavoriteButton from "@/components/FavoriteButton";
import { FollowButton } from "@/components/social/FollowButton";
import { VibeButton } from "@/components/social/VibeButton";
import { ReportDialog } from "@/components/PublicSafetyControls";
import ShareDialog from "@/components/share/ShareDialog";
import { isFollowing } from "@/lib/follows";

export type ActionBarCollector = {
  /** Who Follow points at. Omit it (or set followable false) when the identity is hidden: then there is nothing to follow. */
  profileId?: string;
  name: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  /** Opens the collector's profile card (existing behaviour of the byline). */
  onOpen?: () => void;
  followable?: boolean;
};

/**
 * The compact action bar for an item or an exhibition:
 *   someone else's public item        collector + Follow  ·  Vibe · Share · Save · •••
 *   someone else's public exhibition  collector + Follow  ·         Share · Save · •••
 *   your own content                  Share only (editing, auctions and other owner tools stay where they were)
 * It reuses the existing Follow, Vibe, Favorites, share-link and Report systems; it adds none of its own.
 */
export default function ContentActionBar({
  kind,
  contentId,
  title,
  previewUrl,
  shareUrl,
  canShare,
  shareRestriction,
  isOwner,
  viewerProfileId,
  collector,
  vibe,
  saveMetadata,
  canSave = true,
  canReport = true,
  onExport,
  shareFooter,
  className = "",
}: {
  kind: "item" | "exhibition";
  contentId: string;
  title: string;
  previewUrl?: string;
  shareUrl: string;
  canShare: boolean;
  shareRestriction?: string;
  isOwner: boolean;
  viewerProfileId: string;
  collector?: ActionBarCollector | null;
  /** Items only: the Vibe count and the viewer's state. Exhibitions have no Vibes. */
  vibe?: { count: number; vibed: boolean; ownerProfileId?: string };
  saveMetadata?: Record<string, unknown>;
  canSave?: boolean;
  canReport?: boolean;
  onExport?: () => void;
  shareFooter?: React.ReactNode;
  className?: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [signInHref, setSignInHref] = useState("/login");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const shareRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    setSignInHref(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, []);

  const followTarget = !isOwner && collector?.followable !== false && collector?.profileId ? collector.profileId : "";
  useEffect(() => {
    let active = true;
    setFollowing(null);
    if (!followTarget) return;
    if (!viewerProfileId) {
      setFollowing(false);
      return;
    }
    void isFollowing(viewerProfileId, followTarget).then((value) => {
      if (active) setFollowing(value);
    });
    return () => {
      active = false;
    };
  }, [followTarget, viewerProfileId]);

  // close the ••• menu on an outside press
  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menuOpen]);

  const showMenu = !isOwner && canReport;
  const kindWord = kind === "item" ? "item" : "exhibition";

  function closeMenu(returnFocus = true) {
    setMenuOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  return (
    <div
      role="toolbar"
      aria-label={`Actions for this ${kindWord}`}
      className={["vltd-glass-dock flex flex-wrap items-center gap-x-3 gap-y-2.5 px-3 py-2.5", collector ? "justify-between" : "justify-end", className].filter(Boolean).join(" ")}
    >
      {collector ? (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-lg leading-none ring-1 ring-white/25">
            {collector.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={collector.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <span aria-hidden="true">{collector.avatarEmoji || "🗝️"}</span>
            )}
          </span>
          {collector.onOpen ? (
            <button
              type="button"
              onClick={collector.onOpen}
              title={`About ${collector.name}`}
              className="inline-flex min-h-[44px] min-w-0 max-w-[180px] items-center truncate rounded-md text-left text-sm font-semibold text-[color:var(--fg)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 md:min-h-9 sm:max-w-[240px]"
            >
              {collector.name}
            </button>
          ) : (
            <span className="min-w-0 max-w-[180px] truncate text-sm font-semibold text-[color:var(--fg)] sm:max-w-[240px]">{collector.name}</span>
          )}
          {followTarget && following !== null ? (
            <FollowButton viewerProfileId={viewerProfileId} targetProfileId={followTarget} initialFollowing={following} signInHref={signInHref} key={`${followTarget}:${viewerProfileId}:${following}`} />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {kind === "item" && vibe ? (
          <VibeButton
            itemId={contentId}
            profileId={viewerProfileId}
            isOwner={isOwner}
            initialCount={vibe.count}
            initialVibed={vibe.vibed}
            signInHref={signInHref}
          />
        ) : null}

        <button
          ref={shareRef}
          type="button"
          onClick={() => setShareOpen(true)}
          aria-label={`Share this ${kindWord}`}
          aria-haspopup="dialog"
          title={`Share this ${kindWord}`}
          className={pillClassName("default")}
        >
          <AppIcon name="share" size={16} strokeWidth={1.9} />
          Share
        </button>

        {!isOwner && canSave ? (
          <FavoriteButton
            contentType={kind === "item" ? "item" : "gallery"}
            contentId={contentId}
            metadata={{ title, image: previewUrl ?? "", ...(saveMetadata ?? {}) }}
            label="Save"
          />
        ) : null}

        {showMenu ? (
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              title="More actions"
              className={pillClassName(menuOpen ? "active" : "default", false, "w-11 px-0! md:w-9")}
            >
              <AppIcon name="more" size={18} />
            </button>
            {menuOpen ? (
              <div
                ref={menuRef}
                id={menuId}
                role="menu"
                aria-label="More actions"
                onKeyDown={(event) => {
                  const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
                  const at = items.indexOf(document.activeElement as HTMLElement);
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    closeMenu();
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    items[(at + 1) % items.length]?.focus();
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    items[(at - 1 + items.length) % items.length]?.focus();
                  } else if (event.key === "Tab") {
                    setMenuOpen(false);
                  }
                }}
                className="vltd-dark-surface absolute right-0 top-full z-40 mt-2 min-w-[190px] rounded-2xl p-1.5 text-sm shadow-[0_18px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/15"
                style={{ background: "rgba(17,21,27,0.98)" }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 text-left font-medium text-red-200 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none md:min-h-[38px]"
                >
                  <AppIcon name="warning" size={16} />
                  Report this {kindWord}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <ShareDialog
        open={shareOpen}
        onClose={() => {
          setShareOpen(false);
          // Safari and phones do not focus a button when it is pressed, so the panel cannot always find its way back by itself.
          window.setTimeout(() => shareRef.current?.focus(), 0);
        }}
        kind={kind}
        title={title}
        previewUrl={previewUrl}
        url={shareUrl}
        canShare={canShare}
        restriction={shareRestriction}
        onExport={onExport}
        footer={shareFooter}
      />
      <ReportDialog open={reportOpen} onClose={() => { setReportOpen(false); window.setTimeout(() => triggerRef.current?.focus(), 0); }} contentType={kind === "item" ? "item" : "gallery"} contentId={contentId} contentTitle={title} />
    </div>
  );
}
