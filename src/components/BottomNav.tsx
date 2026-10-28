"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { AppIcon } from "@/components/ui/AppIcon";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { MORE_ITEMS, PHONE_NAV, activeMoreKey, isPrimaryNavActive } from "@/lib/primaryNav";

/* ── Icon helpers ──────────────────────────────────────────
   2026-09-30: these were hardcoded regardless of theme (GOLD stayed
   platinum, DIM stayed warm cream) while the bar itself was ALSO always
   black -- on a real phone in light mode, the global light-theme text
   rules then forced these inline colors dark too (see vltd-keep-color
   below), landing on near-black icons against the still-black bar.
   Theme-aware now: dark mode keeps the same look via each var's dark
   default; light mode gets a light nav surface with dark icons. */
const GOLD = "var(--theme-gold, #C8CDD2)";
const DIM = "var(--theme-text-secondary, rgba(240,226,198,0.94))";

function isGuestGalleryRoute(pathname: string) {
  const parts = pathname.split("/");
  return parts.length >= 4 && parts[1] === "museum" && parts[3] === "guest";
}

// theme-override.css's legacy light-mode rule still force-darkens any bare
// span/div/label text color (documented follow-up: narrow that rule once
// the wider codebase migrates off hardcoded colors). vltd-keep-color is the
// existing, purpose-built escape hatch for exactly this -- an element that
// legitimately wants ITS OWN theme-correct color instead of the blanket
// one. Every nav icon/label/indicator uses it so the real --theme-gold/
// --theme-text-secondary values set above can't be clobbered back to a
// single flat dark color regardless of active state.
function keepColor(color: string): CSSProperties {
  return { color, ["--vltd-keep-color" as string]: color };
}

// The choices behind the round Add button (the same four ways in that the Add row had on desktop).
//   Add Item -> /capture (the camera screen)      Quick Add -> /vault/quick (snap now, fill in later)
//   Single item / Batch -> the upload choices
// Nothing here starts identification: AI runs only from an "Identify with AI" action on the screens these open.
const ADD_ITEMS: ActionMenuItem[] = [
  { key: "add", label: "Add Item", description: "Camera, then the details", href: "/capture" },
  { key: "quick", label: "Quick Add", description: "Snap now, fill in later", href: "/vault/quick" },
  { key: "single", label: "Upload: single item", description: "All images go on 1 item", href: "/capture?openUpload=1" },
  { key: "batch", label: "Upload: batch", description: "Each image creates a new item", href: "/vault/bulk" },
];

const TAB_CLASS = "flex min-h-[44px] min-w-0 w-full flex-col items-center gap-[4px] rounded-[22px] px-1 py-1.5 transition-opacity active:opacity-70";

/* ── Component ──────────────────────────────────────────── */

/**
 * Under 768px: Home, Vault, a round Add button in the middle, Exhibitions and More. The Add button opens the add choices above the bar;
 * More opens the same menu as the desktop bar's More. Safe area at the bottom is respected.
 */
export default function BottomNav() {
  const pathname = usePathname() ?? "";
  const guestRoute = isGuestGalleryRoute(pathname);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => { if (alive) setSignedIn(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setSignedIn(!!session); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const moreKey = activeMoreKey(pathname);
  const moreActive = guestRoute || moreKey !== null;
  const moreItems: ActionMenuItem[] = MORE_ITEMS.filter((item) => signedIn || !item.signedInOnly).map((item) => ({
    key: item.key,
    label: item.label,
    description: item.description,
    href: item.href,
    current: guestRoute ? item.key === "discover" : moreKey === item.key,
  }));

  const tab = (item: (typeof PHONE_NAV)[number]) => {
    const isActive = !guestRoute && isPrimaryNavActive(item, pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={`${TAB_CLASS} flex-1`}
        style={{
          border: isActive ? "1px solid var(--theme-gold-border, rgba(203,208,213,0.44))" : "1px solid transparent",
          background: isActive ? "var(--theme-gold-subtle, rgba(203,208,213,0.08))" : "transparent",
        }}
      >
        <AppIcon name={item.icon} variant="navBottom" active={isActive} size={30} className="vltd-keep-color" style={keepColor(isActive ? GOLD : DIM)} />
        <span
          className="vltd-keep-color whitespace-nowrap text-[10.5px] font-semibold tracking-[0.01em] transition-colors max-[359px]:text-[9.5px] max-[359px]:tracking-normal"
          style={keepColor(isActive ? GOLD : DIM)}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      data-site-chrome="true"
      className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom,0px),10px)] md:hidden no-select"
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999 }}
      aria-label="Main navigation"
    >
      <div
        className="mx-auto max-w-[430px] backdrop-blur-2xl"
        style={{
          background: "var(--theme-nav-bg, linear-gradient(180deg, rgba(9,10,12,0.98), rgba(0,0,0,0.99)))",
          border: "1px solid var(--theme-nav-border, rgba(203,208,213,0.44))",
          borderRadius: "30px",
          boxShadow: "0 18px 46px rgba(0,0,0,0.62), 0 0 0 1px rgba(0,0,0,0.85), inset 0 1px 0 rgba(237,239,241,0.10)",
          padding: "6px 6px 7px",
        }}
      >
        <div className="flex items-center justify-between gap-0.5">
          {PHONE_NAV.slice(0, 2).map(tab)}

          {/* The round Add button, in the middle of the bar. */}
          <div className="flex min-w-0 flex-1 items-center justify-center" data-mobile-add-item>
            <ActionMenu
              ariaLabel="Add"
              placement="above"
              align="center"
              width={250}
              items={ADD_ITEMS}
              triggerClassName="vltd-keep-color flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
              triggerStyle={{
                background: "linear-gradient(145deg, #F1F3F5 0%, #C3C8CD 48%, #8E949A 100%)",
                border: "1px solid rgba(237,239,241,0.55)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.7)",
                color: "#0B0C0E",
                ["--vltd-keep-color" as string]: "#0B0C0E",
              }}
              triggerChildren={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              }
            />
          </div>

          {PHONE_NAV.slice(2).map(tab)}

          <div className="flex min-w-0 flex-1 [&>div]:w-full">
            <ActionMenu
              ariaLabel="More"
              placement="above"
              align="right"
              width={280}
              items={moreItems}
              triggerClassName={TAB_CLASS}
              triggerStyle={{
                border: moreActive ? "1px solid var(--theme-gold-border, rgba(203,208,213,0.44))" : "1px solid transparent",
                background: moreActive ? "var(--theme-gold-subtle, rgba(203,208,213,0.08))" : "transparent",
              }}
              triggerChildren={
                <>
                  <AppIcon name="more" variant="navBottom" active={moreActive} size={30} className="vltd-keep-color" style={keepColor(moreActive ? GOLD : DIM)} />
                  <span
                    className="vltd-keep-color whitespace-nowrap text-[10.5px] font-semibold tracking-[0.01em] transition-colors max-[359px]:text-[9.5px] max-[359px]:tracking-normal"
                    style={keepColor(moreActive ? GOLD : DIM)}
                  >
                    More
                  </span>
                </>
              }
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
