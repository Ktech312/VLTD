"use client";

import { useEffect, useState } from "react";
import { getMyAdminRole } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  deleteReferralCode,
  listAllReferralCodes,
  listAllUserPerks,
  setUserPerk,
  type PerkRow,
  type ReferralRow,
  REFERRAL_BONUS_GALLERIES,
} from "@/lib/referral";

// ─── Small helpers ─────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Badge({ children, color = "gray" }: { children: React.ReactNode; color?: "gold" | "green" | "red" | "gray" }) {
  const styles: Record<string, React.CSSProperties> = {
    gold: { background: "rgba(245,181,72,0.15)", color: "#F5B548" },
    green: { background: "rgba(74,222,128,0.12)", color: "#4ade80" },
    red: { background: "rgba(248,113,113,0.12)", color: "#f87171" },
    gray: { background: "var(--pill)", color: "var(--muted)" },
  };
  return (
    <span style={{ ...styles[color], display: "inline-flex", alignItems: "center", borderRadius: 100, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
      {children}
    </span>
  );
}

// ─── Grant / Edit perk modal ───────────────────────────────────────────────────

type PerkModalProps = {
  initial?: PerkRow | null;
  adminEmail: string;
  onSave: (userId: string, bonus: number, reason: string) => Promise<void>;
  onClose: () => void;
};

function PerkModal({ initial, adminEmail, onSave, onClose }: PerkModalProps) {
  const [userId, setUserId] = useState(initial?.user_id ?? "");
  const [bonus, setBonus] = useState(initial?.bonus_galleries ?? REFERRAL_BONUS_GALLERIES);
  const [reason, setReason] = useState(initial?.reason ?? "admin grant");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!userId.trim()) return;
    setSaving(true);
    await onSave(userId.trim(), bonus, reason);
    setSaving(false);
  }

  const inputCls = "w-full rounded-xl px-3 py-2 text-sm ring-1 ring-[color:var(--border)] outline-none focus:ring-[color:rgba(245,181,72,0.5)]";
  const inputStyle: React.CSSProperties = { background: "var(--pill)", color: "var(--fg)" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "var(--surface)", borderRadius: 20, padding: "1.5rem", width: "100%", maxWidth: 420, border: "1px solid var(--border)" }}>
        <h3 style={{ color: "var(--fg)", fontWeight: 600, marginBottom: "1rem" }}>
          {initial ? "Edit perk" : "Grant bonus Exhibitions"}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>User ID (UUID)</label>
            <input
              className={inputCls}
              style={inputStyle}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={!!initial}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Bonus exhibitions</label>
            <input
              type="number"
              min={0}
              className={inputCls}
              style={inputStyle}
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value))}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Reason</label>
            <input
              className={inputCls}
              style={inputStyle}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. beta tester, contest winner"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: "1.25rem" }}>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !userId.trim()}
            style={{
              flex: 1, background: "rgba(245,181,72,0.15)", color: "#F5B548",
              border: "none", borderRadius: 12, padding: "10px", fontSize: 13,
              fontWeight: 700, cursor: saving ? "default" : "pointer",
              opacity: saving || !userId.trim() ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Save perk"}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: "var(--pill)", color: "var(--muted)",
              border: "1px solid var(--border)", borderRadius: 12, padding: "10px",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AdminReferralsPage() {
  const [role, setRole] = useState<"owner" | "admin" | null | "loading">("loading");
  const [adminEmail, setAdminEmail] = useState("");
  const [codes, setCodes] = useState<ReferralRow[]>([]);
  const [perks, setPerks] = useState<PerkRow[]>([]);
  const [activeTab, setActiveTab] = useState<"codes" | "perks">("codes");
  const [perkModal, setPerkModal] = useState<PerkRow | true | null>(null); // true = new
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const [r, supabase] = await Promise.all([getMyAdminRole(), Promise.resolve(getSupabaseBrowserClient())]);
      setRole(r);
      if (!r) { setLoading(false); return; }

      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        setAdminEmail(user?.email ?? "");
      }

      await reload();
      setLoading(false);
    }
    void init();
  }, []);

  async function reload() {
    const [c, p] = await Promise.all([listAllReferralCodes(), listAllUserPerks()]);
    setCodes(c);
    setPerks(p);
  }

  async function handleSavePerk(userId: string, bonus: number, reason: string) {
    const err = await setUserPerk(userId, bonus, reason, adminEmail);
    if (err) { setStatus(`Error: ${err}`); return; }
    setStatus("Perk saved.");
    setPerkModal(null);
    await reload();
  }

  async function handleDeleteCode(code: string) {
    if (!confirm(`Delete code ${code} and all its redemptions?`)) return;
    const err = await deleteReferralCode(code);
    if (err) { setStatus(`Error: ${err}`); return; }
    setStatus(`Deleted ${code}.`);
    await reload();
  }

  const cellStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 12,
    color: "var(--fg)",
    borderBottom: "0.5px solid var(--border)",
    verticalAlign: "middle",
  };

  const headStyle: React.CSSProperties = {
    ...cellStyle,
    color: "var(--muted)",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    background: "var(--pill)",
  };

  if (role === "loading" || loading) {
    return (
      <main style={{ padding: "2rem", color: "var(--fg)" }}>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </main>
    );
  }

  if (!role) {
    return (
      <main style={{ padding: "2rem", textAlign: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Access denied.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem 6rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>Referrals</h1>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            {codes.length} active codes · {perks.length} perk records
          </p>
        </div>
        <button
          onClick={() => setPerkModal(true)}
          style={{
            background: "rgba(245,181,72,0.15)", color: "#F5B548",
            border: "none", borderRadius: 12, padding: "8px 16px",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          + Grant perk
        </button>
      </div>

      {/* Status */}
      {status && (
        <div style={{ marginBottom: "1rem", padding: "8px 14px", borderRadius: 10, background: "var(--pill)", fontSize: 13, color: "var(--muted)" }}>
          {status}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: "1rem" }}>
        {(["codes", "perks"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
              border: "1px solid var(--border)", cursor: "pointer",
              background: activeTab === tab ? "rgba(245,181,72,0.15)" : "var(--pill)",
              color: activeTab === tab ? "#F5B548" : "var(--muted)",
            }}
          >
            {tab === "codes" ? `Referral Codes (${codes.length})` : `User Perks (${perks.length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ borderRadius: 16, overflow: "hidden", border: "0.5px solid var(--border)" }}>
        {activeTab === "codes" ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Code", "User ID", "Redemptions", "Created", ""].map((h) => (
                  <th key={h} style={headStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...cellStyle, textAlign: "center", color: "var(--muted)" }}>
                    No referral codes yet.
                  </td>
                </tr>
              ) : codes.map((c) => (
                <tr key={c.id}>
                  <td style={cellStyle}>
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: "#F5B548", fontWeight: 700 }}>{c.code}</span>
                  </td>
                  <td style={{ ...cellStyle, fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>
                    {c.user_id.slice(0, 18)}…
                  </td>
                  <td style={cellStyle}>
                    <Badge color={c.redemption_count > 0 ? "green" : "gray"}>
                      {c.redemption_count} {c.redemption_count === 1 ? "invite" : "invites"}
                    </Badge>
                  </td>
                  <td style={{ ...cellStyle, color: "var(--muted)" }}>{fmtDate(c.created_at)}</td>
                  <td style={cellStyle}>
                    <button
                      onClick={() => void handleDeleteCode(c.code)}
                      style={{ fontSize: 11, color: "#f87171", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["User ID", "Bonus Exhibitions", "Reason", "Granted By", "Updated", ""].map((h) => (
                  <th key={h} style={headStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...cellStyle, textAlign: "center", color: "var(--muted)" }}>
                    No perks granted yet.
                  </td>
                </tr>
              ) : perks.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...cellStyle, fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>
                    {p.user_id.slice(0, 18)}…
                  </td>
                  <td style={cellStyle}>
                    <Badge color="gold">+{p.bonus_galleries} Exhibitions</Badge>
                  </td>
                  <td style={{ ...cellStyle, color: "var(--muted)", fontSize: 11 }}>{p.reason ?? "—"}</td>
                  <td style={{ ...cellStyle, color: "var(--muted)", fontSize: 11 }}>{p.granted_by ?? "—"}</td>
                  <td style={{ ...cellStyle, color: "var(--muted)" }}>{fmtDate(p.updated_at)}</td>
                  <td style={cellStyle}>
                    <button
                      onClick={() => setPerkModal(p)}
                      style={{ fontSize: 11, color: "#F5B548", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Perk modal */}
      {perkModal !== null && (
        <PerkModal
          initial={perkModal === true ? null : perkModal}
          adminEmail={adminEmail}
          onSave={handleSavePerk}
          onClose={() => setPerkModal(null)}
        />
      )}
    </main>
  );
}
