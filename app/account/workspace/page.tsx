"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { getCurrentUser, listMyProfiles } from "@/lib/auth";
import { toWorkspaceSummary } from "@/lib/workspaces";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

type ProfileRow = { id: string; username: string; display_name: string; profile_type: "personal" | "business" };

function readActiveProfileId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
}

export default function WorkspaceSettingsPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getCurrentUser();
      setEmail(user?.email ?? "account@example.com");
      const { data } = await listMyProfiles();
      const rows = (data ?? []) as ProfileRow[];
      setProfiles(rows);
      setActiveProfileId(readActiveProfileId() || rows[0]?.id || "");
    }
    load();
  }, []);

  const workspace = useMemo(() => {
    const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
    return profile ? toWorkspaceSummary(profile) : null;
  }, [profiles, activeProfileId]);

  const cards = [
    ["Branding", "Workspace logo, cover image, and public identity placeholder."],
    ["Billing", "Future billing center for business workspaces."],
    ["Security", "Workspace-specific security and device access placeholders."],
    ["Notifications", "Future email, scan, and approval alerts."],
    ["Integrations", "Google Sheets, exports, API, and AI enrichment hooks."],
    ["AI Cataloging", "Default AI review behavior and confidence visibility."],
  ];

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/account"><PillButton>Account Center</PillButton></Link>
          <Link href="/account/workspace"><PillButton variant="active">Workspace Settings</PillButton></Link>
          <Link href="/account/team"><PillButton>Team Members</PillButton></Link>
          <Link href="/account/security"><PillButton>Security</PillButton></Link>
        </div>
        <section className="vltd-panel-main rounded-[30px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">WORKSPACE SETTINGS</div>
          <h1 className="mt-3 text-3xl font-semibold">{workspace?.name || "Workspace"}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">This is the shell for future branding, notifications, billing, integrations, and AI defaults. Business workspaces will use this area to manage employees and feature access without exposing the owner's personal collection.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]">{workspace?.subtitle || "No workspace selected"}</span>
            <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]">Owner: {email || "account@example.com"}</span>
          </div>
        </section>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(([title, body]) => (
            <div key={title} className="vltd-panel-soft rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              <div className="text-lg font-semibold text-[color:var(--fg)]">{title}</div>
              <div className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{body}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
