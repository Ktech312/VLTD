"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";

/* ── Tab config ─────────────────────────────────────────── */

type Tab = {
  label: string;
  href: string;
  icon: AppIconName;
  exact?: boolean;
};

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

/* ── Tabs ────────────────────────────────────────────────── */

const MORE_TAB = "__more__";

const TABS: (Tab | null)[] = [
  { label: "Exhibitions", href: "/museum",   icon: "exhibitions", exact: false },
  { label: "Vault",    href: "/vault",    icon: "vault",       exact: false },
  null, // gold + centre button
  { label: "Discover", href: "/discover", icon: "discover",    exact: false },
  { label: "More",     href: MORE_TAB,    icon: "more",        exact: false },
];

// The rest of the categories, reachable from the "More" sheet. Same style
// as the nav icons — no emoji / generic icons.
const MORE_LINKS: { label: string; href: string; icon: AppIconName }[] = [
  { label: "Curator Home",   href: "/dashboard",       icon: "dashboard" },
  { label: "Insights",       href: "/portfolio",       icon: "chart" },
  { label: "Events",         href: "/events",          icon: "events" },
  { label: "Alerts",         href: "/notifications",   icon: "notifications" },
  { label: "Command Center", href: "/more",            icon: "settings" },
  { label: "VLT Lounge",     href: "/community-board", icon: "sofa" },
  { label: "Activity",       href: "/activity",        icon: "activity" },
  { label: "Learn",          href: "/learn",           icon: "learn" },
  { label: "Account",        href: "/account",         icon: "account" },
];

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

export default function BottomNav() {
  const pathname = usePathname();
  const guestRoute = isGuestGalleryRoute(pathname ?? "");
  const [moreOpen, setMoreOpen] = useState(false);

  function active(tab: Tab) {
    if (tab.href === MORE_TAB) return moreOpen;
    if (guestRoute) return tab.href === "/discover";
    return tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom,0px),10px)] md:hidden no-select"
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999 }}
      aria-label="Main navigation"
    >
      {/* More menu — rendered as an absolute panel ABOVE the nav bar, anchored to
          the nav (which is correctly positioned). This sidesteps the page-shell
          route-transition transform that breaks position:fixed on descendants. */}
      {moreOpen && (
        <>
          {/* Backdrop: extends from the top of the nav upward over the screen */}
          <div
            onClick={() => setMoreOpen(false)}
            style={{ position: "absolute", bottom: "100%", left: 0, right: 0, height: "100vh", background: "rgba(0,0,0,0.55)", zIndex: 1 }}
          />
          {/* Sheet: sits directly above the nav bar */}
          <div
            className="vltd-keep-color"
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              right: 0,
              zIndex: 2,
              background: "var(--theme-nav-bg, rgba(14,14,16,0.98))",
              borderTop: "1px solid var(--theme-nav-border, rgba(203,208,213,0.20))",
              borderTopLeftRadius: "24px",
              borderTopRightRadius: "24px",
              padding: "16px",
              ...keepColor(DIM),
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: "var(--theme-border, rgba(255,255,255,0.2))" }} />
            <div className="vltd-keep-color mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]" style={keepColor(DIM)}>
              More
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MORE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl py-3.5 active:opacity-70"
                  style={{ background: "var(--theme-elevated, rgba(255,255,255,0.04))", border: "1px solid var(--theme-border, rgba(255,255,255,0.08))" }}
                >
                  <AppIcon name={l.icon} size={24} className="vltd-keep-color" style={keepColor(DIM)} />
                  <span className="vltd-keep-color text-center text-[11px] font-medium leading-tight" style={keepColor(DIM)}>
                    {l.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      <div
        className="mx-auto max-w-[390px] backdrop-blur-2xl"
        style={{
          background: "var(--theme-nav-bg, linear-gradient(180deg, rgba(9,10,12,0.98), rgba(0,0,0,0.99)))",
          border: "1px solid var(--theme-nav-border, rgba(203,208,213,0.44))",
          borderRadius: "30px",
          boxShadow: "0 18px 46px rgba(0,0,0,0.62), 0 0 0 1px rgba(0,0,0,0.85), inset 0 1px 0 rgba(237,239,241,0.10)",
          padding: "6px 8px 7px",
        }}
      >
        <div className="flex items-end justify-around gap-1">
          {TABS.map((tab) => {
            /* Centre gold + button */
            if (tab === null) {
              return (
                <Link
                  key="capture"
                  href="/capture"
                  aria-label="Add item to vault"
                  className="relative flex flex-col items-center"
                  style={{ marginTop: "-22px", marginLeft: "2px", marginRight: "2px" }}
                >
                  {/* Redesigned 2026-09-30: was a multi-layer beveled chrome
                      orb (6-stop box-shadow, radial highlight) that read as
                      skeuomorphic next to the flat monochrome tab icons
                      around it. One flat accent fill, one restrained shadow,
                      same visual family as the rest of the nav. */}
                  <div
                    className="flex h-[54px] w-[54px] items-center justify-center rounded-full"
                    style={{
                      background: "var(--theme-gold-gradient, linear-gradient(135deg,#8C9298,#C8CDD2))",
                      boxShadow: "0 0 0 3px #0B0B0B, 0 6px 18px rgba(0,0,0,0.45)",
                    }}
                  >
                    <AppIcon name="addItem" size={22} strokeWidth={2.5} className="vltd-keep-color" style={keepColor("#0B0B0B")} />
                  </div>
                </Link>
              );
            }

            const isActive = active(tab);

            /* "More" — toggles the sheet (not a route) */
            if (tab.href === MORE_TAB) {
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-label="More categories"
                  className="flex min-w-[56px] flex-col items-center gap-[5px] rounded-[22px] px-2 py-1.5 transition-opacity active:opacity-70"
                  style={{
                    border: isActive ? "1px solid var(--theme-gold-border, rgba(203,208,213,0.44))" : "1px solid transparent",
                    background: isActive ? "var(--theme-gold-subtle, rgba(203,208,213,0.08))" : "transparent",
                  }}
                >
                  {/* Active state is background pill + icon/label accent
                      color only (2026-09-30) -- the previous blue drop-shadow
                      glow (rgba(64,146,255,...)) was a leftover from before
                      this app settled on the platinum/gold accent system and
                      didn't match it. */}
                  <AppIcon
                    name={tab.icon}
                    variant="navBottom"
                    active={isActive}
                    size={32}
                    className="vltd-keep-color"
                    style={keepColor(isActive ? GOLD : DIM)}
                  />
                  <span
                    className="vltd-keep-color whitespace-nowrap text-[10.5px] font-semibold tracking-[0.01em] transition-colors"
                    style={keepColor(isActive ? GOLD : DIM)}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            }

            /* Regular tab */
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex min-w-[56px] flex-col items-center gap-[5px] rounded-[22px] px-2 py-1.5 transition-opacity active:opacity-70"
                style={{
                  border: isActive ? "1px solid var(--theme-gold-border, rgba(203,208,213,0.44))" : "1px solid transparent",
                  background: isActive ? "var(--theme-gold-subtle, rgba(203,208,213,0.08))" : "transparent",
                }}
              >
                <AppIcon
                  name={tab.icon}
                  variant="navBottom"
                  active={isActive}
                  size={32}
                  className="vltd-keep-color"
                  style={keepColor(isActive ? GOLD : DIM)}
                />
                <span
                  className="vltd-keep-color whitespace-nowrap text-[10.5px] font-semibold tracking-[0.01em] transition-colors"
                  style={keepColor(isActive ? GOLD : DIM)}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div
                    className="h-[3px] w-[3px] rounded-full"
                    style={{ background: GOLD, boxShadow: "0 0 6px rgba(203,208,213,0.8)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
