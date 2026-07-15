"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getOnboardingStatus } from "@/lib/auth";

const ACTIVE_PROFILE_TYPE_CACHE_KEY = "vltd_active_profile_type_v1";
const ACTIVE_PROFILE_EVENT = "vltd:active-profile";

type AccountSection = {
  href: string;
  label: string;
  businessOnly?: boolean;
  match?: (path: string) => boolean;
};

const sections: AccountSection[] = [
  {
    href: "/account",
    label: "Account",
    match: (path) => path === "/account",
  },
  { href: "/account/workspace", label: "Workspace", businessOnly: true },
  { href: "/account/team", label: "Team", businessOnly: true },
  { href: "/account/roles", label: "Roles", businessOnly: true },
  { href: "/account/security", label: "Security" },
  { href: "/account/billing", label: "Billing" },
];

function readCachedProfileType(): boolean | null {
  if (typeof window === "undefined") return null;
  const type = window.localStorage.getItem(ACTIVE_PROFILE_TYPE_CACHE_KEY);
  if (type === "business") return true;
  if (type === "personal") return false;
  return null;
}

function writeCachedProfileType(isBusiness: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_PROFILE_TYPE_CACHE_KEY, isBusiness ? "business" : "personal");
}

export function AccountTabs() {
  const pathname = usePathname();
  const [isBusiness, setIsBusiness] = useState<boolean | null>(() => readCachedProfileType());

  useEffect(() => {
    let active = true;
    async function loadProfileType() {
      try {
        const status = await getOnboardingStatus();
        const nextIsBusiness = status.activeProfile?.profile_type === "business";
        writeCachedProfileType(nextIsBusiness);
        if (active) setIsBusiness(nextIsBusiness);
      } catch {
        if (active) setIsBusiness(false);
      }
    }
    void loadProfileType();
    window.addEventListener(ACTIVE_PROFILE_EVENT, loadProfileType);
    return () => {
      active = false;
      window.removeEventListener(ACTIVE_PROFILE_EVENT, loadProfileType);
    };
  }, []);

  const isResolving = isBusiness === null;
  const visibleSections = sections.filter((section) => isResolving || !section.businessOnly || isBusiness);

  return (
    <nav
      className="overflow-x-auto"
      aria-label="Account sections"
      style={{ opacity: isResolving ? 0 : 1, transition: "opacity 120ms ease" }}
    >
      <div
        className="relative flex min-w-max items-end"
        role="tablist"
        aria-orientation="horizontal"
      >
        {visibleSections.map((section, index) => {
          const selected = section.match?.(pathname) ?? pathname.startsWith(section.href);
          const first = index === 0;
          const last = index === visibleSections.length - 1;
          return (
            <Link
              key={section.href}
              href={section.href}
              prefetch
              role="tab"
              aria-selected={selected}
              className={[
                "relative -mb-px flex h-11 w-[112px] shrink-0 items-center justify-center px-4 text-sm font-bold transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--frame-ring)]",
                selected ? "z-20" : "z-10 hover:bg-[color:var(--pill-hover)]",
              ].join(" ")}
              style={{
                background: selected
                  ? "linear-gradient(180deg, var(--pill-active-bg), color-mix(in srgb, var(--surface) 96%, black 4%))"
                  : "linear-gradient(180deg, var(--surface), color-mix(in srgb, var(--surface) 92%, black 8%))",
                border: "1px solid var(--border)",
                borderLeftWidth: first ? 1 : 0,
                borderBottomColor: selected ? "transparent" : "var(--border)",
                borderRadius: `${first ? 10 : 0}px ${last ? 10 : 0}px 0 0`,
                color: selected ? "var(--fg)" : "var(--muted, #B8A978)",
                boxShadow: selected
                  ? "0 0 18px var(--frame-glow-soft), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              {section.label}
            </Link>
          );
        })}
        <div
          className="-mb-px h-11 min-w-[220px] flex-1 border-b"
          style={{ borderColor: "var(--border)" }}
        />
      </div>
    </nav>
  );
}
