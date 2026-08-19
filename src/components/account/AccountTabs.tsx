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
      // overflow-x-auto alone implicitly forces overflow-y to "auto" too
      // (a CSS spec quirk: neither axis can stay "visible" once the other
      // isn't) — combined with the tabs' -mb-px trick, the row's rendered
      // height can exceed this box by a sub-pixel amount, popping an
      // unwanted vertical scrollbar (the stray gray line EK circled, right
      // at the nav's edge). This should only ever scroll horizontally.
      className="overflow-x-auto overflow-y-hidden"
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
                // NOT "hover:bg-[...pill-hover)]" — theme-override.css has a
                // [class*="pill"] substring-match rule that force-applies
                // !important border-radius/border-color to anything with
                // "pill" anywhere in its className, which was silently
                // clobbering these tabs' corners and border color.
                selected ? "z-20" : "z-10 hover:brightness-125",
              ].join(" ")}
              style={{
                // Active tab is a flat, exact match for the panel below it
                // (same var+fallback the panel itself uses in account/page.tsx)
                // — no gradient, so there's no seam where they meet. Inactive
                // tabs are forced to a real, theme-agnostic 45% darker mix of
                // that same color: --surface and --theme-elevated are only
                // ~9 RGB units apart in this theme, too close to read as
                // "different," so matching by variable name alone doesn't
                // work — this forces a large, guaranteed-visible gap instead.
                background: selected
                  ? "var(--theme-elevated, rgba(20,32,55,0.9))"
                  : "color-mix(in srgb, var(--theme-elevated, rgba(20,32,55,0.9)) 55%, black 45%)",
                // Active tab's border matches the panel's own border color
                // (var(--theme-gold-border), not var(--border)) — otherwise
                // the two different colors meet right at the seam between
                // tab and panel and read as a visible line, breaking the
                // "one connected shape" look.
                border: `1px solid ${selected ? "var(--theme-gold-border, rgba(203,208,213,0.25))" : "var(--border)"}`,
                borderLeftWidth: first ? 1 : 0,
                borderBottomColor: selected ? "transparent" : "var(--border)",
                borderRadius: `${first ? 10 : 0}px ${last ? 10 : 0}px 0 0`,
                color: selected ? "var(--fg)" : "var(--muted, #9BA0A6)",
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
