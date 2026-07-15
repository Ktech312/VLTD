"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type AccountSection = {
  key: string;
  href: string;
  label: string;
  eyebrow: string;
  description: string;
  cta: string;
  match?: (path: string) => boolean;
};

const sections: AccountSection[] = [
  {
    key: "account",
    href: "/account",
    label: "Account",
    eyebrow: "Identity",
    description: "Display name, handle, account type, collection focus, and profile basics.",
    cta: "Open account",
    match: (path) => path === "/account",
  },
  {
    key: "workspace",
    href: "/account/workspace",
    label: "Workspace",
    eyebrow: "Workspace",
    description: "Public vault URL, profile shell, export helpers, and workspace level settings.",
    cta: "Open workspace",
  },
  {
    key: "team",
    href: "/account/team",
    label: "Team",
    eyebrow: "Business",
    description: "Invite and manage team members for business profiles only.",
    cta: "Open team",
  },
  {
    key: "roles",
    href: "/account/roles",
    label: "Roles",
    eyebrow: "Permissions",
    description: "Review role defaults for owner, admin, inventory manager, and viewer access.",
    cta: "Open roles",
  },
  {
    key: "security",
    href: "/account/security",
    label: "Security",
    eyebrow: "Protection",
    description: "Password reset, two-factor setup, active sessions, and sign-out controls.",
    cta: "Open security",
  },
  {
    key: "billing",
    href: "/account/billing",
    label: "Billing",
    eyebrow: "Plan",
    description: "Plan status, upgrades, payment portal, invoices, and subscription controls.",
    cta: "Open billing",
  },
  {
    key: "redeem",
    href: "/redeem",
    label: "Redeem Code",
    eyebrow: "Access",
    description: "Apply beta, gift, or access codes from the billing area.",
    cta: "Open redeem code",
  },
];

export function AccountTabs() {
  const pathname = usePathname();
  const current =
    sections.find((section) => section.match?.(pathname) ?? pathname.startsWith(section.href)) ??
    sections[0];
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const drawer = sections.find((section) => section.key === drawerKey) ?? null;

  return (
    <section className="mb-5" aria-label="Account sections">
      <div
        className="flex flex-wrap gap-2 rounded-[10px] border p-2"
        role="tablist"
        aria-orientation="horizontal"
        style={{
          background: "rgba(3,10,13,0.78)",
          borderColor: "rgba(214,168,79,0.20)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
        }}
      >
        {sections.map((section) => {
          const selected = section.key === current.key;
          const open = section.key === drawerKey;
          return (
            <button
              key={section.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-expanded={open}
              onClick={() => setDrawerKey(open ? null : section.key)}
              className="h-10 rounded-[7px] px-4 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(245,181,72,0.45)]"
              style={{
                background: selected
                  ? "linear-gradient(180deg, rgba(214,168,79,0.20), rgba(214,168,79,0.08))"
                  : open
                    ? "rgba(214,168,79,0.10)"
                    : "rgba(255,255,255,0.025)",
                border: selected
                  ? "1px solid rgba(245,181,72,0.54)"
                  : "1px solid rgba(214,168,79,0.18)",
                color: selected ? "var(--fg)" : "var(--muted, #B8A978)",
                boxShadow: selected ? "0 0 18px rgba(214,168,79,0.16)" : "none",
              }}
            >
              {section.label}
            </button>
          );
        })}
      </div>

      {drawer ? (
        <div
          className="mt-2 rounded-[10px] border px-4 py-3"
          role="tabpanel"
          style={{
            background: "linear-gradient(180deg, rgba(8,18,22,0.95), rgba(3,10,13,0.95))",
            borderColor: "rgba(214,168,79,0.26)",
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: "var(--muted2, #8F7E52)" }}
              >
                {drawer.eyebrow}
              </div>
              <div className="mt-1 text-sm leading-5" style={{ color: "var(--muted, #B8A978)" }}>
                {drawer.description}
              </div>
            </div>
            <Link
              href={drawer.href}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-[7px] px-4 text-sm font-bold"
              style={{
                background: "linear-gradient(135deg, #8B6914, #F5B548)",
                color: "#090D0F",
                boxShadow: "0 8px 22px rgba(214,168,79,0.22)",
              }}
            >
              {drawer.cta}
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
