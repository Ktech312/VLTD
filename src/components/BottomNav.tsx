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

// The rest of the categories, reachable from the "More" slide-up.
const MORE_LINKS: { label: string; href: string; emoji: string }[] = [
  { label: "Home",           href: "/dashboard",       emoji: "🏠" },
  { label: "Insights",       href: "/portfolio",       emoji: "📊" },
  { label: "Events",         href: "/events",          emoji: "📅" },
  { label: "Alerts",         href: "/notifications",   emoji: "🔔" },
  { label: "Command Center", href: "/more",            emoji: "🎛️" },
  { label: "VLT Lounge",     href: "/community-board", emoji: "🛋️" },
  { label: "Account",        href: "/account",         emoji: "⚙️" },
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
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden no-select"
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999 }}
        aria-label="Main navigation"
      >
        {/* Top separator */}
        <div
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(245,181,72,0.18) 30%, rgba(245,181,72,0.18) 70%, transparent)",
          }}
        />

        <div
          className="backdrop-blur-2xl"
          style={{
            background: "rgba(10,10,10,1)",
            paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
          }}
        >
          <div className="flex items-end justify-around px-2 pt-2.5 pb-1">
            {TABS.map((tab) => {
              /* Centre gold + button */
              if (tab === null) {
                return (
                  <Link
                    key="capture"
                    href="/capture"
                    aria-label="Add item to vault"
                    className="relative flex flex-col items-center"
                    style={{ marginTop: "-20px" }}
                  >
                    <div
                      className="flex h-[58px] w-[58px] items-center justify-center rounded-full"
                      style={{
                        background:
                          "linear-gradient(145deg, #FFE08A 0%, #F5B548 30%, #C8941F 60%, #8B6914 100%)",
                        boxShadow: [
                          "0 0 0 3px #0B0B0B",
                          "0 0 0 4px rgba(245,181,72,0.35)",
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

              /* "More" — opens the slide-up sheet (not a route) */
              if (tab.href === MORE_TAB) {
                return (
                  <button
                    key="more"
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    aria-label="More categories"
                    className="flex min-w-[56px] flex-col items-center gap-[3px] py-1 transition-opacity active:opacity-70"
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
                  className="flex min-w-[56px] flex-col items-center gap-[3px] py-1 transition-opacity active:opacity-70"
                >
                  {tab.icon(isActive)}
                  <span
                    className="text-[11px] font-semibold tracking-[0.04em] transition-colors"
                    style={{ color: isActive ? GOLD : DIM }}
                  >
                    {tab.label}
                  </span>
                  {isActive && (
                    <div
                      className="h-[3px] w-[3px] rounded-full"
                      style={{ background: GOLD, boxShadow: "0 0 6px rgba(245,181,72,0.8)" }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Slide-up "More" sheet */}
      {moreOpen && (
        <div
          className="fixed inset-0 md:hidden"
          style={{ zIndex: 10000 }}
          onClick={() => setMoreOpen(false)}
          role="dialog"
          aria-label="More categories"
        >
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-4"
            style={{
              background: "rgba(14,14,16,0.98)",
              borderTop: "1px solid rgba(245,181,72,0.20)",
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 24px)",
            }}
            onClick={(e) => e.stopPropagation()}
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
                  <span className="text-2xl leading-none">{l.emoji}</span>
                  <span className="text-center text-[11px] font-medium" style={{ color: DIM }}>
                    {l.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
