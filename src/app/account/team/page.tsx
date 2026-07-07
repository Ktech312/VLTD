"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentUser, getOnboardingStatus, type ProfileRow } from "@/lib/auth";
import {
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  type TeamMember,
} from "@/lib/team";

const ROLE_STYLE: Record<string, { bg: string; fg: string }> = {
  owner: { bg: "rgba(245,181,72,0.16)", fg: "#F5B548" },
  admin: { bg: "rgba(96,165,250,0.14)", fg: "#93c5fd" },
  member: { bg: "rgba(255,255,255,0.06)", fg: "rgba(255,255,255,0.7)" },
};

export default function TeamPage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [myEmail, setMyEmail] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);

  const myRole = useMemo(
    () => members.find((m) => m.email.toLowerCase() === myEmail.toLowerCase())?.role,
    [members, myEmail]
  );
  const canManage = myRole === "owner" || myRole === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: user }, status] = await Promise.all([getCurrentUser(), getOnboardingStatus()]);
    setMyEmail(user.user?.email ?? "");
    const active = status.activeProfile;
    setProfile(active);
    if (active) setMembers(await listTeamMembers(active.id));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function refreshMembers() {
    if (profile) setMembers(await listTeamMembers(profile.id));
  }

  async function handleInvite() {
    if (!profile || !inviteEmail.trim() || busy) return;
    setBusy(true);
    setStatus("");
    const res = await addTeamMember(profile.id, inviteEmail.trim(), inviteRole);
    if (res.ok) {
      setStatus(`Added ${inviteEmail.trim()} as ${inviteRole}.`);
      setInviteEmail("");
      await refreshMembers();
    } else {
      setStatus(res.error ?? "Failed to add member.");
    }
    setBusy(false);
  }

  async function handleRole(m: TeamMember, role: "admin" | "member") {
    if (!profile) return;
    const res = await updateTeamMemberRole(profile.id, m.user_id, role);
    if (res.ok) await refreshMembers();
    else setStatus(res.error ?? "Failed to change role.");
  }

  async function handleRemove(m: TeamMember) {
    if (!profile) return;
    if (!window.confirm(`Remove ${m.email} from ${profile.display_name}?`)) return;
    const res = await removeTeamMember(profile.id, m.user_id);
    if (res.ok) await refreshMembers();
    else setStatus(res.error ?? "Failed to remove.");
  }

  const inputCls = "w-full rounded-xl px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";
  const inputStyle = { background: "var(--pill)", color: "var(--fg)" } as const;

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-8">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Business</div>
      <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--fg)" }}>Team</h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Invite people to <b>{profile?.display_name ?? "this profile"}</b>. They can access this
        profile&apos;s vault and exhibits — never your other profiles.
      </p>

      {loading ? (
        <div className="mt-6 text-sm text-[color:var(--muted)]">Loading…</div>
      ) : !profile ? (
        <div className="mt-6 text-sm text-[color:var(--muted)]">No active profile.</div>
      ) : profile.profile_type !== "business" ? (
        <div className="mt-6 rounded-2xl bg-[color:var(--surface)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
          Team members are for <b>business</b> profiles. Switch to a business profile to manage a team.
        </div>
      ) : (
        <>
          {canManage && (
            <div className="mt-6 rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--muted2)]">Invite a member</div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setStatus(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="colleague@email.com"
                  className={`${inputCls} flex-1`}
                  style={inputStyle}
                />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "member")} className={inputCls} style={{ ...inputStyle, maxWidth: 130 }}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="button"
                  onClick={() => void handleInvite()}
                  disabled={busy || !inviteEmail.trim()}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-black transition disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg,#8B6914,#F5B548)" }}
                >
                  {busy ? "…" : "Add"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-[color:var(--muted2)]">
                They need a VLTD account first. Admins can manage items and invite; members can view and add items (no delete/invite).
              </p>
            </div>
          )}

          {status ? <div className="mt-3 text-[12px] text-[color:var(--muted)]">{status}</div> : null}

          <div className="mt-5 grid gap-2">
            {members.map((m) => {
              const s = ROLE_STYLE[m.role] ?? ROLE_STYLE.member;
              const isMe = m.email.toLowerCase() === myEmail.toLowerCase();
              return (
                <div key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-[color:var(--surface)] px-4 py-3 ring-1 ring-[color:var(--border)]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" style={{ color: "var(--fg)" }}>
                      {m.email}{isMe ? " (you)" : ""}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: s.bg, color: s.fg }}>
                    {m.role}
                  </span>
                  {canManage && m.role !== "owner" && !isMe && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleRole(m, m.role === "admin" ? "member" : "admin")}
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
                        style={{ color: "var(--muted)" }}
                      >
                        {m.role === "admin" ? "Make member" : "Make admin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemove(m)}
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-red-400/30 transition hover:bg-red-500/10"
                        style={{ color: "#f87171" }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-8 text-center">
        <Link href="/account" className="text-sm text-[color:var(--muted)] underline underline-offset-2">Back to account</Link>
      </div>
    </main>
  );
}
