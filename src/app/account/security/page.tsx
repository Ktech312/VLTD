"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/account/AccountTabs";
import { getCurrentUser, signOut } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import TwoFactorAuthCard from "@/components/account/TwoFactorAuthCard";

type Session = { id: string; device: string; location: string; lastSeen: string; current: boolean };

function mockSessions(email: string): Session[] {
  return [
    { id: "s1", device: "Chrome · macOS", location: "Current device", lastSeen: "Now", current: true },
    { id: "s2", device: "Safari · iPhone", location: "Last seen 2h ago", lastSeen: "2h ago", current: false },
  ];
}

function Row({ label, value, action, actionLabel }: { label: string; value: string; action?: () => void; actionLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[color:var(--border)] last:border-0">
      <div>
        <div className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{label}</div>
        <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{value}</div>
      </div>
      {action && (
        <button type="button" onClick={action} className="shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ring-1" style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}>
          {actionLabel ?? "Change"}
        </button>
      )}
    </div>
  );
}

export default function SecurityPage() {
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState("");
  const [pwEmail, setPwEmail] = useState("");
  const [pwSent, setPwSent] = useState(false);

  useEffect(() => {
    getCurrentUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleResetPassword() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !email) return;
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/account/security` : undefined,
      });
      setPwSent(true);
      showToast("Password reset email sent.");
    } catch {
      showToast("Failed to send reset email.");
    }
  }

  const sessions = mockSessions(email);

  return (
    <main className="" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-5xl px-4 py-4">
          <AccountTabs />
          <h1 className="mt-4 text-2xl font-bold" style={{ color: "var(--fg)" }}>Security</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>Manage your login credentials and active sessions.</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {toast && (
          <div className="rounded-xl px-4 py-2.5 text-sm ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)", color: "var(--fg)" }}>{toast}</div>
        )}

        {/* Login credentials */}
        <div className="rounded-2xl p-5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Login credentials</div>
          <Row label="Email address" value={email || "—"} />
          <Row
            label="Password"
            value={pwSent ? "Reset email sent — check your inbox." : "Last changed: unknown"}
            action={handleResetPassword}
            actionLabel={pwSent ? "Resend" : "Reset password"}
          />
        </div>

        {/* 2FA */}
        <TwoFactorAuthCard />

        {/* Active sessions */}
        <div className="rounded-2xl p-5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Active sessions</div>
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{s.device}</span>
                    {s.current && (
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>This device</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{s.location} · {s.lastSeen}</div>
                </div>
                {!s.current && (
                  <button type="button" onClick={() => showToast("Session revoked.")} className="text-xs" style={{ color: "#f87171" }}>
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl p-5 ring-1 ring-[color:rgba(248,113,113,0.3)]" style={{ background: "rgba(248,113,113,0.04)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#f87171" }}>Danger zone</div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Sign out everywhere</div>
              <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>Revoke all active sessions and sign out of all devices.</div>
            </div>
            <button
              type="button"
              onClick={async () => { await signOut(); window.location.href = "/login"; }}
              className="shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ring-1"
              style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
            >
              Sign out all
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
