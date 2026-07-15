"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AccountSection = {
  href: string;
  label: string;
  match?: (path: string) => boolean;
};

const sections: AccountSection[] = [
  {
    href: "/account",
    label: "Account",
    match: (path) => path === "/account",
  },
  { href: "/account/workspace", label: "Workspace" },
  { href: "/account/team", label: "Team" },
  { href: "/account/roles", label: "Roles" },
  { href: "/account/security", label: "Security" },
  { href: "/account/billing", label: "Billing" },
  { href: "/redeem", label: "Redeem Code" },
];

export function AccountTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-5 overflow-x-auto pb-1" aria-label="Account sections">
      <div
        className="relative flex min-w-max items-end pl-1"
        role="tablist"
        aria-orientation="horizontal"
      >
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, rgba(245,181,72,0.52), rgba(245,181,72,0.18), transparent)" }}
        />
        {sections.map((section, index) => {
          const selected = section.match?.(pathname) ?? pathname.startsWith(section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              role="tab"
              aria-selected={selected}
              className={[
                "relative flex h-11 min-w-[92px] items-center justify-center px-5 text-sm font-bold transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(245,181,72,0.45)]",
                selected ? "z-20" : "z-10 hover:-translate-y-0.5",
              ].join(" ")}
              style={{
                background: selected
                  ? "linear-gradient(180deg, rgba(53,43,21,0.98), rgba(28,24,17,0.98))"
                  : "linear-gradient(180deg, rgba(15,22,23,0.96), rgba(8,14,16,0.96))",
                border: "1px solid rgba(214,168,79,0.28)",
                borderBottomColor: selected ? "rgba(28,24,17,0.98)" : "rgba(214,168,79,0.18)",
                borderRadius: "12px 12px 0 0",
                color: selected ? "var(--fg)" : "var(--muted, #B8A978)",
                boxShadow: selected
                  ? "0 0 18px rgba(214,168,79,0.16), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "inset 0 1px 0 rgba(255,255,255,0.03)",
                marginLeft: index === 0 ? 0 : -6,
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
