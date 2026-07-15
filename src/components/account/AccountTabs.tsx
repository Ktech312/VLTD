"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getOnboardingStatus } from "@/lib/auth";

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

export function AccountTabs() {
  const pathname = usePathname();
  const [isBusiness, setIsBusiness] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProfileType() {
      try {
        const status = await getOnboardingStatus();
        if (active) setIsBusiness(status.activeProfile?.profile_type === "business");
      } catch {
        if (active) setIsBusiness(false);
      }
    }
    void loadProfileType();
    return () => {
      active = false;
    };
  }, []);

  const visibleSections = sections.filter((section) => !section.businessOnly || isBusiness);

  return (
    <nav className="mb-5 overflow-x-auto pb-1" aria-label="Account sections">
      <div
        className="relative inline-flex min-w-max items-end"
        role="tablist"
        aria-orientation="horizontal"
      >
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, rgba(245,181,72,0.52), rgba(245,181,72,0.18), transparent)" }}
        />
        {visibleSections.map((section, index) => {
          const selected = section.match?.(pathname) ?? pathname.startsWith(section.href);
          const first = index === 0;
          const last = index === visibleSections.length - 1;
          return (
            <Link
              key={section.href}
              href={section.href}
              role="tab"
              aria-selected={selected}
              className={[
                "relative -mb-px flex h-11 min-w-[104px] items-center justify-center px-5 text-sm font-bold transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(245,181,72,0.45)]",
                selected ? "z-20" : "z-10 hover:bg-[rgba(214,168,79,0.06)]",
              ].join(" ")}
              style={{
                background: selected
                  ? "linear-gradient(180deg, rgba(53,43,21,0.98), rgba(28,24,17,0.98))"
                  : "linear-gradient(180deg, rgba(15,22,23,0.96), rgba(8,14,16,0.96))",
                border: "1px solid rgba(214,168,79,0.28)",
                borderLeftWidth: first ? 1 : 0,
                borderBottomColor: selected ? "rgba(28,24,17,0.98)" : "rgba(214,168,79,0.18)",
                borderRadius: `${first ? 10 : 0}px ${last ? 10 : 0}px 0 0`,
                color: selected ? "var(--fg)" : "var(--muted, #B8A978)",
                boxShadow: selected
                  ? "0 0 18px rgba(214,168,79,0.16), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              {section.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
