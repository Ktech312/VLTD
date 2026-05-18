"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── Icons ─────────────────────────────────────────────── */

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      style={{ color: active ? "#F5B548" : "#A0956B" }}>
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
        fill={active ? "rgba(245,181,72,0.14)" : "none"}
      />
      <path
        d="M9 21V13h6v8"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function IconExhibitions({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      style={{ color: active ? "#F5B548" : "#A0956B" }}>
      <path d="M3 21h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4 21V10M20 21V10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 3 2 10h20L12 3Z" stroke="currentColor" strokeWidth="1.75"
        strokeLinejoin="round" fill={active ? "rgba(245,181,72,0.12)" : "none"} />
      <path d="M9 21v-5h6v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconDiscover({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      style={{ color: active ? "#F5B548" : "#A0956B" }}>
      <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.10)" : "none"} />
      <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M13.5 8.5 10 13l-2-2" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
        opacity={active ? "1" : "0.6"} />
    </svg>
  );
}

function IconActivity({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      style={{ color: active ? "#F5B548" : "#A0956B" }}>
      <rect x="3" y="14" width="3" height="7" rx="1"
        fill={active ? "rgba(245,181,72,0.20)" : "rgba(160,149,107,0.20)"}
        stroke="currentColor" strokeWidth="1.75" />
      <rect x="8.5" y="10" width="3" height="11" rx="1"
        fill={active ? "rgba(245,181,72,0.20)" : "rgba(160,149,107,0.20)"}
        stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="6" width="3" height="15" rx="1"
        fill={active ? "rgba(245,181,72,0.28)" : "rgba(160,149,107,0.14)"}
        stroke="currentColor" strokeWidth="1.75" />
      <rect x="19.5" y="11" width="3" height="10" rx="1"
        fill={active ? "rgba(245,181,72,0.20)" : "rgba(160,149,107,0.20)"}
        stroke="currentColor" strokeWidth="1.75" />
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
  { label: "Home",     href: "/",         icon: IconHome,        exact: true  },
  { label: "Vault",    href: "/vault",    icon: IconDiscover,    exact: false },
  null, // gold + button (capture)
  { label: "Discover", href: "/discover", icon: IconExhibitions, exact: false },
  { label: "Activity", href: "/portfolio", icon: IconActivity,   exact: false },
];

/* ── Component ──────────────────────────────────────────── */

export default function BottomNav() {
  const pathname = usePathname();

  function active(tab: Tab) {
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
          background: "rgba(11,11,11,0.96)",
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
                  {/* Outer glow ring */}
                  <div
                    className="flex h-[58px] w-[58px] items-center justify-center rounded-full"
                    style={{
                      background: "linear-gradient(145deg, #FFE08A 0%, #F5B548 30%, #C8941F 60%, #8B6914 100%)",
                      boxShadow: [
                        "0 0 0 3px #0B0B0B",           /* gap between ring and bg */
                        "0 0 0 4px rgba(245,181,72,0.35)", /* subtle outer ring */
                        "0 8px 28px rgba(245,181,72,0.55)", /* warm bloom */
                        "0 2px 8px rgba(0,0,0,0.60)",       /* depth shadow */
                        "inset 0 1px 0 rgba(255,255,255,0.40)", /* top highlight */
                        "inset 0 -2px 4px rgba(0,0,0,0.30)",   /* bottom depth */
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
                  className="text-[10px] font-semibold tracking-[0.04em] transition-colors"
                  style={{ color: isActive ? "#F5B548" : "#A0956B" }}
                >
                  {tab.label}
                </span>
                {/* Active dot indicator */}
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
