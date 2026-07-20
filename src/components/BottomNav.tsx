"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/* ── Tab config ─────────────────────────────────────────── */

type Tab = {
  label: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
  exact?: boolean;
};

/* ── Icon helpers ──────────────────────────────────────── */

const GOLD  = "#F5B548";
const DIM   = "rgba(240,226,198,0.94)";   // light warm cream — legible on the black nav

function sz(active: boolean) { return active ? 2.2 : 1.75; }

// Rope stanchions: two posts with ball tops + sagging rope = museum exhibit
function IconExhibitions({ active }: { active: boolean }) {
  const c = active ? GOLD : DIM;
  const sw = sz(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="6"  cy="6.2" r="1.5" stroke={c} strokeWidth={sw * 0.8} />
      <circle cx="18" cy="6.2" r="1.5" stroke={c} strokeWidth={sw * 0.8} />
      <line x1="6"  y1="7.9" x2="6"  y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <line x1="18" y1="7.9" x2="18" y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <line x1="3.4" y1="19" x2="8.6"  y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <line x1="15.4" y1="19" x2="20.6" y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <path d="M6.9 8.6 Q12 13.6 17.1 8.6" stroke={c} strokeWidth={sw * 0.85} strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Vault door: rounded door face + spoke wheel handle (echoes the VLTD key-wheel logo)
function IconVault({ active }: { active: boolean }) {
  const c = active ? GOLD : DIM;
  const sw = sz(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={c} strokeWidth={sw} />
      <line x1="12"  y1="6.2"  x2="12"   y2="17.8" stroke={c} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <line x1="6.2" y1="12"   x2="17.8" y2="12"   stroke={c} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <line x1="7.9" y1="7.9"  x2="16.1" y2="16.1" stroke={c} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <line x1="16.1" y1="7.9" x2="7.9"  y2="16.1" stroke={c} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <circle cx="12" cy="12" r="4.2" stroke={c} strokeWidth={sw * 0.9} fill="rgba(10,10,10,0.001)" />
      <circle cx="12" cy="12" r="1.3" fill={c} />
    </svg>
  );
}

// Compass: circle + diamond needle (N bright / S dim) = explore / discover
function IconDiscover({ active }: { active: boolean }) {
  const c = active ? GOLD : DIM;
  const sw = sz(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} />
      <polygon points="12,5.5 14,11.5 12,10.5 10,11.5" fill={c} />
      <polygon points="12,18.5 14,12.5 12,13.5 10,12.5" fill={c} opacity="0.4" />
    </svg>
  );
}

// Three dots = more / menu
function IconMore({ active }: { active: boolean }) {
  const c = active ? GOLD : DIM;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={c} aria-hidden="true">
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  );
}

/* ── Tabs ────────────────────────────────────────────────── */

const MORE_TAB = "__more__";

const TABS: (Tab | null)[] = [
  { label: "Exhibits", href: "/museum",   icon: (a) => <IconExhibitions active={a} />, exact: false },
  { label: "Vault",    href: "/vault",    icon: (a) => <IconVault active={a} />,       exact: false },
  null, // gold + centre button
  { label: "Discover", href: "/discover", icon: (a) => <IconDiscover active={a} />,    exact: false },
  { label: "More",     href: MORE_TAB,    icon: (a) => <IconMore active={a} />,         exact: false },
];

// Custom line-art glyphs for the More sheet — same style as the nav icons.
// No emoji / generic icons.
function Glyph({ paths }: { paths: React.ReactNode }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={DIM} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths}
    </svg>
  );
}

// The rest of the categories, reachable from the "More" sheet.
const MORE_LINKS: { label: string; href: string; icon: React.ReactNode }[] = [
  { label: "Curator Home",   href: "/dashboard",       icon: (<><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10.5V20h12v-9.5" /><path d="M9.7 20v-5h4.6v5" /></>) },
  { label: "Insights",       href: "/portfolio",       icon: (<><path d="M4 20h16" /><path d="M7.5 20v-4.5M12 20V8.5M16.5 20v-7.5" /></>) },
  { label: "Events",         href: "/events",          icon: (<><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>) },
  { label: "Alerts",         href: "/notifications",   icon: (<><path d="M6 16v-5a6 6 0 0 1 12 0v5" /><path d="M4.5 16h15" /><path d="M10.4 19a1.7 1.7 0 0 0 3.2 0" /></>) },
  { label: "Command Center", href: "/more",            icon: (<><path d="M4 8h8M16 8h4M4 16h4M12 16h8" /><circle cx="14" cy="8" r="2" /><circle cx="8" cy="16" r="2" /></>) },
  { label: "VLT Lounge",     href: "/community-board", icon: (<><path d="M4 14v-2.5A2.5 2.5 0 0 1 6.5 9h11A2.5 2.5 0 0 1 20 11.5V14" /><rect x="3.5" y="13.5" width="17" height="4.5" rx="1.3" /><path d="M6.5 18v1.6M17.5 18v1.6" /></>) },
  { label: "Activity",       href: "/activity",        icon: (<><path d="M3 12h3.5l2.5-6 4 12 2.5-6H21" /></>) },
  { label: "Learn",          href: "/learn",           icon: (<><path d="M12 6.5C10 5 6.5 4.8 3.5 5.5v12.5c3-.7 6.5-.5 8.5 1 2-1.5 5.5-1.7 8.5-1V5.5C17.5 4.8 14 5 12 6.5Z" /><path d="M12 6.5V19" /></>) },
  { label: "Account",        href: "/account",         icon: (<><circle cx="12" cy="8" r="3.2" /><path d="M5.8 19.5a6.2 6.2 0 0 1 12.4 0" /></>) },
];

function isGuestGalleryRoute(pathname: string) {
  const parts = pathname.split("/");
  return parts.length >= 4 && parts[1] === "museum" && parts[3] === "guest";
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
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              right: 0,
              zIndex: 2,
              background: "rgba(14,14,16,0.98)",
              borderTop: "1px solid rgba(245,181,72,0.20)",
              borderTopLeftRadius: "24px",
              borderTopRightRadius: "24px",
              padding: "16px",
            }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "rgba(240,226,198,0.6)" }}>
              More
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MORE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl py-3.5 active:opacity-70"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <Glyph paths={l.icon} />
                  <span className="text-center text-[11px] font-medium leading-tight" style={{ color: DIM }}>
                    {l.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mx-auto flex max-w-[390px] items-end justify-center px-1">
          {TABS.map((tab, idx) => {
            /* Centre gold + button */
            if (tab === null) {
              return (
                <Link
                  key="capture"
                  href="/capture"
                  aria-label="Add item to vault"
                  className="relative flex flex-col items-center"
                  style={{ marginTop: "-23px", marginLeft: "-8px", marginRight: "-8px", zIndex: 5 }}
                >
                  <div
                    className="flex h-[62px] w-[62px] items-center justify-center rounded-full"
                    style={{
                      background:
                        "linear-gradient(145deg, #FFE08A 0%, #F5B548 30%, #C8941F 60%, #8B6914 100%)",
                      boxShadow: [
                        "0 0 0 4px #050505",
                        "0 0 0 5px rgba(245,181,72,0.50)",
                        "0 8px 28px rgba(245,181,72,0.55)",
                        "0 2px 8px rgba(0,0,0,0.60)",
                        "inset 0 1px 0 rgba(255,255,255,0.40)",
                        "inset 0 -2px 4px rgba(0,0,0,0.30)",
                      ].join(", "),
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="#1A0F00" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </Link>
              );
            }

            const isActive = active(tab);
            const lobeStyle: React.CSSProperties = {
              width: 82,
              height: 60,
              marginLeft: idx === 0 ? 0 : -10,
              zIndex: isActive ? 3 : 2,
              border: `1px solid ${isActive ? "rgba(217,162,58,0.72)" : "rgba(217,162,58,0.38)"}`,
              borderRadius: 30,
              background: isActive
                ? "linear-gradient(180deg, rgba(16,14,10,0.99), rgba(0,0,0,0.99))"
                : "linear-gradient(180deg, rgba(8,8,9,0.99), rgba(0,0,0,0.99))",
              boxShadow: isActive
                ? "0 14px 34px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,241,168,0.12), inset 0 -1px 0 rgba(217,162,58,0.18)"
                : "0 12px 30px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,241,168,0.06)",
            };

            /* "More" — toggles the sheet (not a route) */
            if (tab.href === MORE_TAB) {
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-label="More categories"
                  className="flex flex-col items-center justify-center gap-[2px] px-2 transition-opacity active:opacity-70"
                  style={lobeStyle}
                >
                  {tab.icon(isActive)}
                  <span
                    className="text-[11px] font-semibold tracking-[0.04em] transition-colors"
                    style={{ color: isActive ? GOLD : DIM }}
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
                className="flex flex-col items-center justify-center gap-[2px] px-2 transition-opacity active:opacity-70"
                style={lobeStyle}
              >
                {tab.icon(isActive)}
                <span
                  className="text-[11px] font-semibold tracking-[0.04em] transition-colors"
                  style={{ color: isActive ? GOLD : DIM }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
