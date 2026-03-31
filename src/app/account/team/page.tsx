"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { getCurrentUser, listMyProfiles } from "@/lib/auth";
import { placeholderMembers, toWorkspaceSummary, type WorkspaceMember } from "@/lib/workspaces";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  profile_type: "personal" | "business";
};

function readActiveProfileId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
}

export default function AccountTeamPage() {
  const [email, setEmail] = useState("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getCurrentUser();
      setEmail(user?.email ?? "owner@example.com");
      const { data } = await listMyProfiles();
      const rows = (data ?? []) as ProfileRow[];
      setProfiles(rows);
      setActiveProfileId(readActiveProfileId() || rows[0]?.id || "");
    }
    load();
  }, []);

  const activeWorkspace = useMemo(() => {
    const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
    return profile ? toWorkspaceSummary(profile) : null;
  }, [profiles, activeProfileId]);

  const members: WorkspaceMember[] = useMemo(() => {
    return activeWorkspace ? placeholderMembers(activeWorkspace, email) : [];
  }, [activeWorkspace, email]);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/account"><PillButton>Account Center</PillButton></Link>
          <Link href="/account/team"><PillButton variant="active">Team Members</PillButton></Link>
          <Link href="/account/roles"><PillButton>Roles & Permissions</PillButton></Link>
          <Link href="/account/workspace"><PillButton>Workspace Settings</PillButton></Link>
        </div>

        <section className="vltd-panel-main rounded-[30px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">TEAM MEMBERS</div>
          <h1 className="mt-3 text-3xl font-semibold">{activeWorkspace?.name || "Workspace"} team</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
            Business workspaces can invite employees and scope them to inventory, museum, or finance access. Personal workspaces stay private to the owner.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]">{activeWorkspace?.subtitle || "No workspace selected"}</span>
            <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]">{members.length} members</span>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            {members.map((member) => (
              <div key={member.id} className="vltd-panel-soft rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-[color:var(--fg)]">{member.name}</div>
                    <div className="mt-1 text-sm text-[color:var(--muted)]">{member.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]">{member.role.replaceAll("_", " ")}</span>
                    <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]">{member.status}</span>
                  </div>
                </div>
                {member.note ? <div className="mt-3 text-sm text-[color:var(--muted)]">{member.note}</div> : null}
              </div>
            ))}
          </div>

          <aside className="vltd-panel-main rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.2em] text-[color:var(--muted2)]">PLACEHOLDER</div>
            <h2 className="mt-2 text-xl font-semibold">Invite employee</h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              The real flow will invite by email, assign a role, and keep employees out of your personal workspace. This shell is here so the navigation and access model are ready.
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)] text-sm text-[color:var(--muted)]">Email invite field placeholder</div>
              <div className="rounded-2xl bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)] text-sm text-[color:var(--muted)]">Role selector placeholder</div>
              <PillButton className="w-full">Invite Member</PillButton>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
