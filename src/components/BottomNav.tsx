"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── Icons ─────────────────────────────────────────────── */

function IconVault({ active }: { active: boolean }) {
  const c = active ? "#F5B548" : "#D8C897";
  const fill = active ? "rgba(245,181,72,0.12)" : "none";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {/* Outer vault door circle */}
      <circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth="1.6" fill={fill} />
      {/* Inner dial ring */}
      <circle cx="12" cy="12" r="5.5" stroke={c} strokeWidth="1.4" />
      {/* 4 corner bolts */}
      <circle cx="12" cy="3.5" r="1.1" fill={c} />
      <circle cx="12" cy="20.5" r="1.1" fill={c} />
      <circle cx="3.5" cy="12" r="1.1" fill={c} />
      <circle cx="20.5" cy="12" r="1.1" fill={c} />
      {/* Center handle cross */}
      <path d="M12 9v6M9 12h6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      {/* Center knob */}
      <circle cx="12" cy="12" r="1.5" fill={c} />
    </svg>
  );
}

function IconExhibitions({ active }: { active: boolean }) {
  const c = active ? "#F5B548" : "#D8C897";
  const fill = active ? "rgba(245,181,72,0.14)" : "none";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {/* Track rail */}
      <path d="M4 4h16" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      {/* Spotlight head */}
      <rect x="9" y="4" width="6" height="4" rx="1.5" fill={fill} stroke={c} strokeWidth="1.5" />
      {/* Pivot arm */}
      <path d="M12 8v1.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
      {/* Light cone */}
      <path d="M7.5 20L12 9.5L16.5 20" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={active ? "rgba(245,181,72,0.08)" : "none"} />
      {/* Base line = stage floor */}
      <path d="M6 20h12" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconDiscover({ active }: { active: boolean }) {
  const c = active ? "#F5B548" : "#D8C897";
  const fill = active ? "rgba(245,181,72,0.10)" : "none";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {/* Compass outer ring */}
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" fill={fill} />
      {/* Cardinal tick marks */}
      <path d="M12 4.5V6.5M12 17.5V19.5M4.5 12H6.5M17.5 12H19.5"
        stroke={c} strokeWidth="1.4" strokeLinecap="round" />
      {/* North needle (filled = gold when active) */}
      <path d="M12 7.5L14 12H10Z"
        fill={active ? "#F5B548" : c} stroke={c} strokeWidth="0.5" />
      {/* South needle (hollow) */}
      <path d="M12 16.5L10 12H14Z"
        fill="none" stroke={c} strokeWidth="1.1" strokeLinejoin="round" />
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.2" fill={c} />
    </svg>
  );
}

function IconAlerts({ active }: { active: boolean }) {
  const c = active ? "#F5B548" : "#D8C897";
  const fill = active ? "rgba(245,181,72,0.14)" : "none";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M15 17H9a3 3 0 0 0 6 0Z" stroke={c} strokeWidth="1.75" />
      <path d="M4 17h16M12 3v1m0 0a7 7 0 0 1 7 7v3.5H5V11a7 7 0 0 1 7-7Z"
        stroke={c} strokeWidth="1.75" strokeLinecap="round"
        fill={fill} />
    </svg>
  );
}

/* ── Tab config ─────────────────────────────────────────── */

type Tab = {
  label: string;
  href: string;
  icon: React.ComponentType<{ active: boolean }>;
  exact?: boolean;
};

const TABS: (Tab | null)[] = [
  { label: "Exhibitions", href: "/museum",        icon: IconExhibitions, exact: false },
  { label: "Vault",       href: "/vault",         icon: IconVault,       exact: false },
  null, // gold + button (capture)
  { label: "Discover",   href: "/discover",       icon: IconDiscover,    exact: false },
  { label: "Alerts",     href: "/notifications",  icon: IconAlerts,      exact: false },
];

// Guest gallery routes (/museum/[id]/guest) should highlight Discover, not Galleries
function isGuestGalleryRoute(pathname: string) {
  const parts = pathname.split("/");
  return parts.length >= 4 && parts[1] === "museum" && parts[3] === "guest";
}

/* ── Component ──────────────────────────────────────────── */

export default function BottomNav() {
  const pathname = usePathname();
  const guestRoute = isGuestGalleryRoute(pathname ?? "");

  function active(tab: Tab) {
    if (guestRoute) {
      return tab.href === "/discover";
    }
    return tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden no-select"
      style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999 }}
      aria-label="Main navigation"
    >
      {/* Subtle top separator gradient */}
      <div className="h-px w-full" style={{
        background: "linear-gradient(90deg, transparent, rgba(245,181,72,0.18) 30%, rgba(245,181,72,0.18) 70%, transparent)"
      }} />

      <div
        className="backdrop-blur-2xl"
        style={{
          background: "rgba(10,10,10,1)",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
        }}
      >
        <div className="flex items-end justify-around px-2 pt-2.5 pb-1">
          {TABS.map((tab, i) => {
            /* ── Center gold + button ── */
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
                      background: "linear-gradient(145deg, #FFE08A 0%, #F5B548 30%, #C8941F 60%, #8B6914 100%)",
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

            /* ── Regular tab ── */
            const Icon = tab.icon;
            const isActive = active(tab);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex min-w-[56px] flex-col items-center gap-[3px] py-1 transition-opacity active:opacity-70"
              >
                <Icon active={isActive} />
                <span
                  className="text-[11px] font-semibold tracking-[0.04em] transition-colors"
                  style={{ color: isActive ? "#F5B548" : "#D8C897" }}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div
                    className="h-[3px] w-[3px] rounded-full"
                    style={{ background: "#F5B548", boxShadow: "0 0 6px rgba(245,181,72,0.8)" }}
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
