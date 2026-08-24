"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";

type Tool = {
  href: string;
  label: string;
  description: string;
  external?: boolean;
};

const TOOLS: Tool[] = [
  { href: "/admin/events", label: "Events", description: "Manage every collector event -- enable/disable, feature, delete." },
  { href: "/admin/events/quick-add", label: "Quick Add Event", description: "Manually add one event found by hand." },
  {
    href: "https://claude.ai/code/artifact/48d46d98-8e1f-4214-84df-71399faa09b2",
    label: "Event Catcher",
    description: "The bookmarklet that grabs a page's title/link/image for Quick Add Event.",
    external: true,
  },
  { href: "/admin/users", label: "Users", description: "Per-account time-on-app and AI usage." },
  { href: "/admin/waitlist", label: "Beta Waitlist", description: "Approve and invite waitlist signups." },
  { href: "/admin/scan-limits", label: "Scan Limits", description: "Per-tier and per-user AI-scan quotas." },
  { href: "/admin/bugs", label: "Bug Reports", description: "Review and reply to reported bugs." },
  { href: "/admin/referrals", label: "Referrals", description: "Referral program management." },
  { href: "/admin/spotlights", label: "Spotlights", description: "Featured-collection spotlight picks." },
  { href: "/admin/themes", label: "Themes", description: "Site theme configuration." },
  { href: "/admin/tiers", label: "Tiers", description: "Billing tier configuration." },
  { href: "/admin/characters", label: "Seed Characters", description: "The 22 fictional collector personas used to seed the app." },
];

export default function AdminHubPage() {
  const [role, setRole] = useState<AdminRole | "loading">("loading");

  useEffect(() => {
    void (async () => setRole(await getMyAdminRole()))();
  }, []);

  if (role === "loading") {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-3xl text-[color:var(--muted)]">Checking access…</div>
      </main>
    );
  }

  if (!role) {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[color:var(--border)] bg-vault-card p-6 text-[color:var(--muted)]">
          You don&apos;t have access to this page.
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-black tracking-[-0.03em]">Admin</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Every admin tool, in one place. Bookmark this page.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              target={tool.external ? "_blank" : undefined}
              rel={tool.external ? "noopener noreferrer" : undefined}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition hover:border-[color:var(--theme-gold-border)]"
            >
              <div className="flex items-center gap-2 font-semibold text-text-primary">
                {tool.label}
                {tool.external && <span className="text-xs text-[color:var(--muted)]">↗</span>}
              </div>
              <p className="mt-1 text-xs text-[color:var(--muted)]">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
