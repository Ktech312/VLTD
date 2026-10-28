"use client";

import { exportVaultCsv } from "@/lib/vaultExport";
import { Toggle } from "@/components/ui/Toggle";
import { PillButton } from "@/components/ui/PillButton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountTabs } from "@/components/account/AccountTabs";
import { showToast } from "@/lib/toast";
import {
  getCurrentUser,
  listMyProfiles,
  updateProfile,
  getStoredActiveProfileId,
  setStoredActiveProfileId,
  type ProfileRow,
} from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/vaultCloud";
import { loadItems } from "@/lib/vaultModel";
import {
  startGoogleConnect,
  finishGoogleConnectIfPresent,
  getStoredToken,
  isTokenValid,
  clearStoredToken,
  getLastSheetId,
  createSheet,
  writeVaultToSheet,
} from "@/lib/googleSheets";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] p-5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[color:var(--border)] last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>{label}</div>
        {sub && <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{sub}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function saveLocalPrefs(patch: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(localStorage.getItem("vltd_workspace_prefs") ?? "{}") as Record<string, unknown>;
    localStorage.setItem("vltd_workspace_prefs", JSON.stringify({ ...existing, ...patch }));
  } catch (e) { /* ignore */ }
}

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeId, setActiveId] = useState("");
  const [email, setEmail] = useState("");
  const [editDisplay, setEditDisplay] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [notifyWeekly, setNotifyWeekly] = useState(true);
  const [notifyActivity, setNotifyActivity] = useState(false);
  const [aiAutoReview, setAiAutoReview] = useState(false);
  const [showConfidence, setShowConfidence] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getCurrentUser();
      setEmail(user?.email ?? "");
      const { data } = await listMyProfiles();
      const rows = (data ?? []) as ProfileRow[];
      setProfiles(rows);
      const aid = getStoredActiveProfileId() || rows[0]?.id || "";
      setActiveId(aid);
      const active = rows.find((r) => r.id === aid) ?? rows[0];
      if (active?.profile_type !== "business") {
        router.replace("/account");
        return;
      }
      if (active) {
        setEditDisplay(active.display_name ?? "");
        setEditEmoji((active as ProfileRow & { avatar_emoji?: string }).avatar_emoji ?? "🗹");
      }
    }
    load();

    try {
      const p = JSON.parse(localStorage.getItem("vltd_workspace_prefs") ?? "{}") as Record<string, unknown>;
      if (typeof p.notifyWeekly === "boolean") setNotifyWeekly(p.notifyWeekly);
      if (typeof p.notifyActivity === "boolean") setNotifyActivity(p.notifyActivity);
      if (typeof p.aiAutoReview === "boolean") setAiAutoReview(p.aiAutoReview);
      if (typeof p.showConfidence === "boolean") setShowConfidence(p.showConfidence);
    } catch (e) { /* ignore */ }

    finishGoogleConnectIfPresent();
    setGoogleConnected(isTokenValid(getStoredToken()));
  }, [router]);

  const activeProfile = profiles.find((p) => p.id === activeId) ?? profiles[0];

  async function handleSaveProfile() {
    if (!activeProfile) return;
    setSaving(true);
    try {
      if (hasSupabaseEnv()) {
        await updateProfile(activeProfile.id, { display_name: editDisplay });
      }
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === activeProfile.id
            ? ({ ...p, display_name: editDisplay, avatar_emoji: editEmoji } as ProfileRow)
            : p
        )
      );
      setSaveMsg("✓ Profile updated");
    } catch (e) {
      setSaveMsg("Saved locally — sync when online.");
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  }

  function switchTo(id: string) {
    setStoredActiveProfileId(id);
    setActiveId(id);
    const p = profiles.find((r) => r.id === id);
    if (p) {
      setEditDisplay(p.display_name ?? "");
      setEditEmoji((p as ProfileRow & { avatar_emoji?: string }).avatar_emoji ?? "🗹");
    }
  }

  function handleGoogleDisconnect() {
    clearStoredToken();
    setGoogleConnected(false);
    showToast("Google Sheets disconnected.");
  }

  async function handleGoogleExport() {
    const token = getStoredToken();
    if (!token || !isTokenValid(token)) {
      setGoogleConnected(false);
      showToast("Google Sheets session expired — reconnect.");
      return;
    }
    setGoogleBusy(true);
    try {
      let sheetId = getLastSheetId();
      if (!sheetId) {
        const sheet = await createSheet(token, "VLTD Vault");
        sheetId = sheet.id;
      }
      const items = loadItems({ includeAllProfiles: false });
      await writeVaultToSheet(token, sheetId, items);
      showToast(`Exported ${items.length} item${items.length === 1 ? "" : "s"} to Google Sheets.`);
    } catch {
      showToast("Export failed — try reconnecting Google Sheets.");
    } finally {
      setGoogleBusy(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://vltd.app";
  const publicUrl = activeProfile?.username ? `${origin}/v/${activeProfile.username}` : "";

  return (
    <main className="px-4 py-6" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <div className="mx-auto max-w-5xl">
        <AccountTabs />
        <section
          className="relative -mt-px overflow-hidden rounded-[34px] rounded-tl-none p-5 sm:p-7"
          style={{
            background: "var(--theme-elevated, rgba(20,32,55,0.9))",
            border: "1px solid var(--theme-gold-border, rgba(203,208,213,0.25))",
            boxShadow: "0 26px 86px rgba(0,0,0,0.32)",
          }}
        >
          <h1 className="text-2xl font-bold">Workspace Settings</h1>
          {email && <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>{email}</p>}

          <div className="mx-auto mt-6 max-w-2xl space-y-5">

        <Section title="Public profile">
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center justify-center h-16 w-16 rounded-[14px] text-4xl ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
              {editEmoji}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: "var(--fg)" }}>@{activeProfile?.username ?? "—"}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {activeProfile?.profile_type === "business" ? "Business workspace" : "Personal vault"}
              </div>
            </div>
          </div>

          <Row label="Display name" sub="Shown on your public vault page">
            <input
              type="text"
              value={editDisplay}
              onChange={(e) => setEditDisplay(e.target.value)}
              className="rounded-xl px-3 py-1.5 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ background: "var(--pill)", color: "var(--fg)", width: 164 }}
            />
          </Row>

          <Row label="Avatar emoji" sub="Your collector identity icon">
            <input
              type="text"
              value={editEmoji}
              onChange={(e) => setEditEmoji(e.target.value.slice(0, 4))}
              className="rounded-xl px-3 py-1.5 text-center text-xl ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ background: "var(--pill)", color: "var(--fg)", width: 64 }}
            />
          </Row>

          <div className="mt-4 flex items-center gap-3">
            <PillButton onClick={() => void handleSaveProfile()} disabled={saving} className="font-black" style={{ background: "linear-gradient(180deg, #79E7FB, #41C6E4 55%, #2CB1D1)", color: "#06171d", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 16px rgba(79,211,238,0.25)" }}>
              {saving ? "Saving…" : "Save profile"}
            </PillButton>
            {saveMsg && <span className="text-sm" style={{ color: "#4ade80" }}>{saveMsg}</span>}
          </div>
        </Section>

        {publicUrl && (
          <Section title="Public vault URL">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 basis-48 truncate rounded-[8px] px-3 py-2.5 text-xs ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)", color: "var(--fg)" }}>{publicUrl}</span>
              <PillButton variant="active" onClick={() => void navigator.clipboard?.writeText(publicUrl)}>Copy</PillButton>
              <PillButton href={publicUrl}>Visit</PillButton>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
              Only items marked <strong>Public</strong> appear on your vault page.
            </p>
          </Section>
        )}

        <Section title="Notifications">
          <Row label="Weekly report email" sub="Summary of collection activity every Monday">
            <Toggle ariaLabel="Weekly report email" on={notifyWeekly} onChange={() => setNotifyWeekly((v) => { saveLocalPrefs({ notifyWeekly: !v }); return !v; })} />
          </Row>
          <Row label="Activity alerts" sub="New followers, registry rank changes">
            <Toggle ariaLabel="Activity alerts" on={notifyActivity} onChange={() => setNotifyActivity((v) => { saveLocalPrefs({ notifyActivity: !v }); return !v; })} />
          </Row>
        </Section>

        <Section title="AI cataloging">
          <Row label="Auto-advance high-confidence drafts" sub="Skip review for items scored ≥ 90%">
            <Toggle ariaLabel="Auto-advance high-confidence drafts" on={aiAutoReview} onChange={() => setAiAutoReview((v) => { saveLocalPrefs({ aiAutoReview: !v }); return !v; })} />
          </Row>
          <Row label="Show confidence scores" sub="Display AI confidence on draft cards">
            <Toggle ariaLabel="Show confidence scores" on={showConfidence} onChange={() => setShowConfidence((v) => { saveLocalPrefs({ showConfidence: !v }); return !v; })} />
          </Row>
          <div className="mt-3">
            <PillButton href="/ai/drafts">View AI draft queue →</PillButton>
          </div>
        </Section>

        <Section title="Integrations">
          <Row
            label="Google Sheets sync"
            sub={googleConnected ? "Connected — export your vault anytime" : "Export vault data to a connected spreadsheet"}
          >
            {googleConnected ? (
              <div className="flex items-center gap-2">
                <PillButton variant="active" onClick={() => void handleGoogleExport()} disabled={googleBusy}>
                  {googleBusy ? "Exporting…" : "Export now"}
                </PillButton>
                <PillButton onClick={handleGoogleDisconnect}>Disconnect</PillButton>
              </div>
            ) : (
              <PillButton onClick={() => void startGoogleConnect()}>Connect</PillButton>
            )}
          </Row>
          <Row label="CSV export" sub="Download your vault as a spreadsheet">
            <PillButton onClick={exportVaultCsv}>Export</PillButton>
          </Row>
          <Row label="API access" sub="Business plan — programmatic vault access">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--pill)", color: "var(--muted)" }}>Business</span>
          </Row>
        </Section>

        {profiles.length > 1 && (
          <Section title="Switch workspace">
            <div className="space-y-2">
              {profiles.map((p) => {
                const emoji = (p as ProfileRow & { avatar_emoji?: string }).avatar_emoji ?? "🗹";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => switchTo(p.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition text-left"
                    style={{
                      background: p.id === activeId ? "rgba(203,208,213,0.08)" : "var(--pill)",
                      borderColor: p.id === activeId ? "rgba(203,208,213,0.4)" : "var(--border)",
                    }}
                  >
                    <span className="text-xl">{emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate" style={{ color: "var(--fg)" }}>{p.display_name || p.username}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>@{p.username} · {p.profile_type}</div>
                    </div>
                    {p.id === activeId && <span className="text-xs font-bold" style={{ color: "var(--theme-gold)" }}>Active</span>}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

          </div>
        </section>
      </div>
    </main>
  );
}
