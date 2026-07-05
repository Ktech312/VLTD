"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GalleryHorizontal, Vault, Globe, Bell } from "lucide-react";

/* ── Tab config ─────────────────────────────────────────── */

type Tab = {
  label: string;
  href: string;
  icon: React.ComponentType<{ active: boolean }>;
  exact?: boolean;
};

function NavIcon({
  Icon,
  active,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  active: boolean;
}) {
  return (
    <Icon
      size={22}
      strokeWidth={active ? 2.2 : 1.75}
      color={active ? "#F5B548" : "#C8B885"}
    />
  );
}

const TABS: (Tab | null)[] = [
  {
    label: "Exhibitions",
    href: "/museum",
    icon: ({ active }) => <NavIcon Icon={GalleryHorizontal} active={active} />,
    exact: false,
  },
  {
    label: "Vault",
    href: "/vault",
    icon: ({ active }) => <NavIcon Icon={Vault} active={active} />,
    exact: false,
  },
  null, // gold + button (capture)
  {
    label: "Discover",
    href: "/discover",
    icon: ({ active }) => <NavIcon Icon={Globe} active={active} />,
    exact: false,
  },
  {
    label: "Alerts",
    href: "/notifications",
    icon: ({ active }) => <NavIcon Icon={Bell} active={active} />,
    exact: false,
  },
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
                  style={{ color: isActive ? "#F5B548" : "#C8B885" }}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div
                    className="h-[3px] w-[3px] rounded-full"
                    style={{
                      background: "#F5B548",
                      boxShadow: "0 0 6px rgba(245,181,72,0.8)",
                    }}
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
