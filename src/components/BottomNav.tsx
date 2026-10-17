"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

import AddItemActions from "@/components/AddItemActions";
import { AppIcon } from "@/components/ui/AppIcon";
import { PRIMARY_NAV, isPrimaryNavActive, showMobileAddItem } from "@/lib/primaryNav";

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

/* ── Component ──────────────────────────────────────────── */

/**
 * Under 768px: the five primary destinations in the approved order (Home, Vault, Exhibitions, Lounge,
 * Discover), plus one labeled Add Item action that floats just above the bar on the main pages and
 * respects the phone's bottom safe area. On those pages the other Add Item buttons are hidden on mobile.
 */
export default function BottomNav() {
  const pathname = usePathname() ?? "";
  const guestRoute = isGuestGalleryRoute(pathname);
  const showAdd = showMobileAddItem(pathname) && !guestRoute;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom,0px),10px)] md:hidden no-select"
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999 }}
      aria-label="Main navigation"
    >
      {/* Persistent Add Item: sits directly above the bar, inside the nav so the safe area is already respected.
          It leaves room (68px) for the round bug-report button at the right; on a 320px screen the row is wider than
          that space, so there it moves to the edge margin and the bug-report button moves up above it (BugReporter). */}
      {showAdd ? (
        <div className="absolute bottom-full right-[68px] mb-2 max-[339px]:right-3" data-mobile-add-item>
          <AddItemActions placement="above" />
        </div>
      ) : null}

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
        <div className="flex items-end justify-between gap-0.5">
          {PRIMARY_NAV.map((tab) => {
            const isActive = guestRoute ? tab.href === "/discover" : isPrimaryNavActive(tab, pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className="flex min-h-[44px] min-w-0 flex-1 flex-col items-center gap-[4px] rounded-[22px] px-1 py-1.5 transition-opacity active:opacity-70"
                style={{
                  border: isActive ? "1px solid var(--theme-gold-border, rgba(203,208,213,0.44))" : "1px solid transparent",
                  background: isActive ? "var(--theme-gold-subtle, rgba(203,208,213,0.08))" : "transparent",
                }}
              >
                <AppIcon
                  name={tab.icon}
                  variant="navBottom"
                  active={isActive}
                  size={30}
                  className="vltd-keep-color"
                  style={keepColor(isActive ? GOLD : DIM)}
                />
                <span
                  className="vltd-keep-color whitespace-nowrap text-[10.5px] font-semibold tracking-[0.01em] transition-colors max-[359px]:text-[9.5px] max-[359px]:tracking-normal"
                  style={keepColor(isActive ? GOLD : DIM)}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
