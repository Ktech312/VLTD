"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUser, listMyProfiles } from "@/lib/auth";
import { placeholderMembers, toWorkspaceSummary, type WorkspaceMember } from "@/lib/workspaces";

const ROLES = ["INVENTORY_MANAGER", "VIEWER", "FINANCE_VIEWER", "MUSEUM_CURATOR"] as const;

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [role, setRole] = useState<string>("VIEWER");
  const [sent, setSent] = useState(false);

  function handleInvite() {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) return;
    setSent(true);
    setInviteEmail("");
    setTimeout(() => setSent(false), 3000);
    onInvited();
  }

  return (
    <div className="mt-4 space-y-3">
      {sent && (
        <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>✓ Invite sent</div>
      )}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>Email</label>
        <input
          type="email"
          value={inviteEmail}
          onChange={e => setInviteEmail(e.target.value)}
          placeholder="colleague@example.com"
          className="w-full rounded-xl px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
          style={{ background: "var(--pill)", color: "var(--fg)" }}
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>Role</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
          style={{ background: "var(--pill)", color: "var(--fg)" }}
        >
          {ROLES.map(r => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      <button
        type="button"
        onClick={handleInvite}
        disabled={!inviteEmail.trim()}
        className="w-full rounded-full py-2 text-sm font-semibold disabled:opacity-40"
        style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}
      >
        Send invite
      </button>
    </div>
  );
}

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
  const [toast, setToast] = useState("");

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
    <main className="min-h-screen text-[color:var(--fg)]">
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

          <aside className="rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.2em] text-[color:var(--muted2)]">INVITE</div>
            <h2 className="mt-2 text-lg font-semibold" style={{ color: "var(--fg)" }}>Invite a team member</h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Business workspaces only. Invited members receive an email and can access vault functions scoped to their role.
            </p>
            {activeWorkspace?.type === "business" ? (
              <InviteForm onInvited={() => setToast("Invite sent!")} />
            ) : (
              <div className="mt-4 rounded-xl px-4 py-3 text-sm ring-1 ring-[color:var(--border)] text-[color:var(--muted)]" style={{ background: "var(--pill)" }}>
                Team invites require a Business workspace. Upgrade your plan to enable this feature.
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
