"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── Tab config ─────────────────────────────────────────── */

type Tab = {
  label: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
  exact?: boolean;
};

/* ── Icon helpers ──────────────────────────────────────── */

const GOLD  = "#F5B548";
const DIM   = "rgba(245,214,160,0.78)";   // warm light gold — legible on the black nav in BOTH themes

function sz(active: boolean) { return active ? 2.2 : 1.75; }

// Rope stanchions: two posts with ball tops + sagging rope = museum exhibit
function IconExhibitions({ active }: { active: boolean }) {
  const c = active ? GOLD : DIM;
  const sw = sz(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {/* Ball tops */}
      <circle cx="6"  cy="6.2" r="1.5" stroke={c} strokeWidth={sw * 0.8} />
      <circle cx="18" cy="6.2" r="1.5" stroke={c} strokeWidth={sw * 0.8} />
      {/* Posts */}
      <line x1="6"  y1="7.9" x2="6"  y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <line x1="18" y1="7.9" x2="18" y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      {/* Bases */}
      <line x1="3.4" y1="19" x2="8.6"  y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <line x1="15.4" y1="19" x2="20.6" y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      {/* Sagging rope between posts */}
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
      {/* Door face */}
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={c} strokeWidth={sw} />
      {/* Wheel spokes — through the rim, like a vault handle */}
      <line x1="12"  y1="6.2"  x2="12"   y2="17.8" stroke={c} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <line x1="6.2" y1="12"   x2="17.8" y2="12"   stroke={c} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <line x1="7.9" y1="7.9"  x2="16.1" y2="16.1" stroke={c} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <line x1="16.1" y1="7.9" x2="7.9"  y2="16.1" stroke={c} strokeWidth={sw * 0.8} strokeLinecap="round" />
      {/* Wheel rim */}
      <circle cx="12" cy="12" r="4.2" stroke={c} strokeWidth={sw * 0.9} fill="rgba(10,10,10,0.001)" />
      {/* Hub */}
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
      {/* North pointer – bright */}
      <polygon points="12,5.5 14,11.5 12,10.5 10,11.5" fill={c} />
      {/* South pointer – muted */}
      <polygon points="12,18.5 14,12.5 12,13.5 10,12.5" fill={c} opacity="0.4" />
    </svg>
  );
}

// Bell: dome + base bar + clapper
function IconAlerts({ active }: { active: boolean }) {
  const c = active ? GOLD : DIM;
  const sw = sz(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {/* Dome */}
      <path
        d="M5.5 16 L5.5 11 C5.5 7.2 8.4 4.5 12 4.5 C15.6 4.5 18.5 7.2 18.5 11 L18.5 16"
        stroke={c} strokeWidth={sw} strokeLinecap="round" fill="none"
      />
      {/* Cap / hanger at top */}
      <path d="M10 4.5 Q12 2.5 14 4.5" stroke={c} strokeWidth={sw} strokeLinecap="round" fill="none" />
      {/* Base bar */}
      <line x1="4" y1="16" x2="20" y2="16" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      {/* Clapper */}
      <line x1="12" y1="16" x2="12" y2="19" stroke={c} strokeWidth={sw * 0.85} strokeLinecap="round" />
      <circle cx="12" cy="19.5" r="0.85" fill={c} />
    </svg>
  );
}

/* ── Tabs ────────────────────────────────────────────────── */

const TABS: (Tab | null)[] = [
  {
    label: "Exhibits",
    href: "/museum",
    icon: (a) => <IconExhibitions active={a} />,
    exact: false,
  },
  {
    label: "Vault",
    href: "/vault",
    icon: (a) => <IconVault active={a} />,
    exact: false,
  },
  null, // gold + centre button
  {
    label: "Discover",
    href: "/discover",
    icon: (a) => <IconDiscover active={a} />,
    exact: false,
  },
  {
    label: "Alerts",
    href: "/notifications",
    icon: (a) => <IconAlerts active={a} />,
    exact: false,
  },
];

function isGuestGalleryRoute(pathname: string) {
  const parts = pathname.split("/");
  return parts.length >= 4 && parts[1] === "museum" && parts[3] === "guest";
}

/* ── Component ──────────────────────────────────────────── */

export default function BottomNav() {
  const pathname = usePathname();
  const guestRoute = isGuestGalleryRoute(pathname ?? "");

  function active(tab: Tab) {
    if (guestRoute) return tab.href === "/discover";
    return tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
  }

  return (
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
          {TABS.map((tab, i) => {
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
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="#1A0F00"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </Link>
              );
            }

            /* Regular tab */
            const isActive = active(tab);

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
  );
}
