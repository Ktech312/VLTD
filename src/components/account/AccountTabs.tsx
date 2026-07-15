"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/account", label: "Account", match: (path: string) => path === "/account" },
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
    <nav className="relative mb-5 overflow-x-auto pb-3" aria-label="Account sections">
      <div className="relative flex min-w-max items-end pl-1" role="tablist" aria-orientation="horizontal">
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, rgba(245,181,72,0.55), rgba(245,181,72,0.18), transparent)",
          }}
        />
        {tabs.map((tab, index) => {
          const active = tab.match ? tab.match(pathname) : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className={[
                "relative flex h-11 min-w-[94px] items-center justify-center px-5 text-sm font-bold transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(245,181,72,0.55)]",
                active ? "z-20 translate-y-px" : "z-10 hover:-translate-y-0.5",
              ].join(" ")}
              style={{
                clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 100%, 0 100%)",
                border: active ? "1px solid rgba(245,181,72,0.62)" : "1px solid rgba(245,181,72,0.24)",
                borderBottomColor: active ? "rgba(12,18,21,0.98)" : "rgba(245,181,72,0.20)",
                background: active
                  ? "linear-gradient(180deg, rgba(34,45,35,0.98), rgba(22,27,23,0.98))"
                  : "linear-gradient(180deg, rgba(25,31,31,0.94), rgba(14,19,21,0.94))",
                color: active ? "var(--fg)" : "var(--theme-green, #00B86B)",
                boxShadow: active
                  ? "0 0 22px rgba(0,184,107,0.28), inset 0 1px 0 rgba(255,255,255,0.08)"
                  : "inset 0 1px 0 rgba(255,255,255,0.04)",
                marginLeft: index === 0 ? 0 : -8,
              }}
            >
              <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
