"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PillSelect } from "@/components/ui/PillSelect";
import { LocalNav } from "@/components/ui/LocalNav";
import { getOnboardingStatus, listMyProfiles, setStoredActiveProfileId } from "@/lib/auth";

type ProfileRow = { id: string; display_name: string; username: string; profile_type: "personal" | "business" };

type Category = {
  key: string;
  label: string;
  href: string;
  businessOnly?: boolean;
  isActive: (path: string, section: string | null) => boolean;
};

// The Settings categories. Query sections are real, focused views (not scroll anchors), so every one has a direct link.
const CATEGORIES: Category[] = [
  { key: "profile", label: "Profile", href: "/account?section=profile", isActive: (p, s) => p === "/account" && (!s || s === "profile") },
  { key: "preferences", label: "Preferences", href: "/account?section=preferences", isActive: (p, s) => p === "/account" && s === "preferences" },
  { key: "privacy", label: "Privacy and security", href: "/account/security", isActive: (p) => p.startsWith("/account/security") },
  { key: "billing", label: "Billing and contact", href: "/account/billing", isActive: (p, s) => p.startsWith("/account/billing") || (p === "/account" && s === "contact") },
  {
    key: "workspace",
    label: "Workspace and team",
    href: "/account/workspace",
    businessOnly: true,
    isActive: (p) => p.startsWith("/account/workspace") || p.startsWith("/account/team") || p.startsWith("/account/roles"),
  },
  { key: "data", label: "Data and maintenance", href: "/account?section=data", isActive: (p, s) => p === "/account" && s === "data" },
];

// Local navigation for the grouped "Workspace and team" category. Each page keeps its own permission checks.
const WORKSPACE_NAV = [
  { key: "workspace", label: "Workspace", href: "/account/workspace" },
  { key: "team", label: "Team", href: "/account/team" },
  { key: "roles", label: "Roles", href: "/account/roles" },
];

/**
 * Settings layout: a compact account identity and profile switcher, then labeled categories.
 * Desktop (768px and wider): the categories sit beside the content.
 * Phones: Settings opens as a list of categories; choosing one opens that category as its own screen
 * with a clear "Settings" link back.
 */
export default function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const params = useSearchParams();
  const section = params.get("section");

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [status, mine] = await Promise.all([getOnboardingStatus(), listMyProfiles()]);
        if (!active) return;
        setProfiles(((mine.data ?? []) as ProfileRow[]));
        setActiveId(status.activeProfile?.id ?? "");
      } catch {
        /* the categories still work without the identity row */
      }
    }
    void load();
    window.addEventListener("vltd:active-profile", load);
    return () => {
      active = false;
      window.removeEventListener("vltd:active-profile", load);
    };
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;
  const isBusiness = activeProfile?.profile_type === "business";
  const visible = useMemo(() => CATEGORIES.filter((c) => !c.businessOnly || isBusiness || !activeProfile), [isBusiness, activeProfile]);

  // On phones the Settings landing is the category list. Everything else is a focused screen.
  const isLanding = pathname === "/account" && !section;
  const current = CATEGORIES.find((c) => c.isActive(pathname, section));

  return (
    <div className="px-4 pt-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Compact identity and profile switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted2)]">Settings</div>
            <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="truncate text-lg font-semibold">{activeProfile?.display_name || "Your account"}</span>
              {activeProfile ? (
                <span className="truncate text-[13px] text-[color:var(--muted)]">
                  @{activeProfile.username} · {activeProfile.profile_type === "business" ? "Business" : "Personal"}
                </span>
              ) : null}
            </div>
          </div>
          {profiles.length > 1 ? (
            <PillSelect
              value={activeId}
              ariaLabel="Switch profile"
              align="right"
              minWidthPx={190}
              options={profiles.map((p) => ({
                value: p.id,
                label: p.display_name,
                subtitle: p.profile_type === "business" ? "Business" : "Personal",
              }))}
              onChange={(next) => {
                if (!next || next === activeId) return;
                setStoredActiveProfileId(next);
                window.location.reload();
              }}
            />
          ) : null}
        </div>

        <div className="mt-5 md:grid md:grid-cols-[230px_minmax(0,1fr)] md:gap-8">
          {/* Categories: always beside the content on desktop; on phones only on the Settings landing */}
          <nav aria-label="Settings categories" className={isLanding ? "block" : "hidden md:block"}>
            <ul className="flex flex-col gap-2">
              {visible.map((category) => {
                const selected = category.isActive(pathname, section);
                return (
                  <li key={category.key}>
                    <Link
                      href={category.href}
                      aria-current={selected ? "page" : undefined}
                      className={[
                        "flex h-11 w-full items-center rounded-[8px] px-3 text-[13px] font-medium ring-1 transition md:h-9",
                        selected
                          ? "bg-[color:var(--pill)] font-semibold text-[color:var(--fg)] ring-[color:var(--pill-active-ring)]"
                          : "text-[color:var(--fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]",
                      ].join(" ")}
                    >
                      {category.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* The focused screen. On a phone's Settings landing it is hidden so only the list shows. */}
          <div className={isLanding ? "hidden min-w-0 md:block" : "min-w-0"}>
            {!isLanding ? (
              <Link
                href="/account"
                className="mb-4 inline-flex h-11 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--border)] md:hidden"
              >
                <span aria-hidden="true">←</span> Settings{current ? ` · ${current.label}` : ""}
              </Link>
            ) : null}
            {current?.key === "workspace" ? (
              <div className="mb-5">
                <LocalNav
                  ariaLabel="Workspace and team"
                  activeKey={pathname.startsWith("/account/team") ? "team" : pathname.startsWith("/account/roles") ? "roles" : "workspace"}
                  items={WORKSPACE_NAV}
                />
              </div>
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
