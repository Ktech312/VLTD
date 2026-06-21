"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { showToast } from "@/lib/toast";

type Status = "loading" | "disabled" | "enrolling" | "enabled";

export default function TwoFactorAuthCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshStatus() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setStatus("disabled"); return; }
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((f: { status: string }) => f.status === "verified");
    setStatus(verified ? "enabled" : "disabled");
    if (verified) setFactorId(verified.id);
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function startEnroll() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setError("");
    setBusy(true);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError || !data) {
        setError(enrollError?.message ?? "Couldn't start 2FA setup.");
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setCode("");
      setStatus("enrolling");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    const supabase = getSupabaseBrowserClient();
    if (supabase && factorId) {
      // Drop the unverified factor so it doesn't sit around half-enrolled.
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setFactorId("");
    setQrCode("");
    setSecret("");
    setCode("");
    setError("");
    setStatus("disabled");
  }

  async function verifyEnroll() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !factorId) return;
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) {
        setError(challengeError?.message ?? "Couldn't verify that code — try again.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) {
        setError(verifyError.message || "That code didn't match — try again.");
        return;
      }
      setQrCode("");
      setSecret("");
      setCode("");
      setStatus("enabled");
      showToast("2FA enabled.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !factorId) return;
    setBusy(true);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) {
        showToast(unenrollError.message || "Couldn't disable 2FA.");
        return;
      }
      setFactorId("");
      setStatus("disabled");
      showToast("2FA disabled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl p-5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
        Two-factor authentication
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Authenticator app</div>
          <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            Add an extra layer of protection to your account.
          </div>
        </div>
        {status !== "enrolling" && (
          <span
            className="rounded-full px-3 py-1 text-[10px] font-semibold"
            style={
              status === "enabled"
                ? { background: "rgba(74,222,128,0.12)", color: "#4ade80" }
                : { background: "rgba(248,113,113,0.1)", color: "#f87171" }
            }
          >
            {status === "loading" ? "Checking…" : status === "enabled" ? "Enabled" : "Not enabled"}
          </span>
        )}
      </div>

      {status === "disabled" && (
        <button
          type="button"
          onClick={startEnroll}
          disabled={busy}
          className="vltd-pill-main-glow mt-3 rounded-full px-4 py-1.5 text-xs font-bold transition disabled:opacity-50"
          style={{ background: "var(--pill-active-bg)", border: "none", cursor: busy ? "default" : "pointer" }}
        >
          Enable 2FA
        </button>
      )}

      {status === "enabled" && (
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="vltd-pill-neutral mt-3 rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50"
          style={{ background: "var(--pill)", border: "none", cursor: busy ? "default" : "pointer" }}
        >
          Disable 2FA
        </button>
      )}

      {status === "enrolling" && (
        <div className="mt-3 space-y-3">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy), then enter
            the 6-digit code it generates.
          </p>

          {qrCode && (
            <div className="flex justify-center rounded-xl p-3" style={{ background: "#fff" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="2FA QR code" style={{ width: 160, height: 160 }} />
            </div>
          )}

          {secret && (
            <div className="text-center text-[11px]" style={{ color: "var(--muted)" }}>
              Can&apos;t scan? Enter this code manually:{" "}
              <span style={{ color: "var(--fg)", fontFamily: "monospace", letterSpacing: "0.05em" }}>{secret}</span>
            </div>
          )}

          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            className="w-full rounded-xl px-3 py-2 text-center text-lg ring-1 ring-[color:var(--border)] focus:outline-none"
            style={{ background: "var(--pill)", color: "var(--fg)", letterSpacing: "0.3em" }}
          />

          {error && (
            <div className="text-xs" style={{ color: "#f87171" }}>{error}</div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={verifyEnroll}
              disabled={busy || code.length !== 6}
              className="vltd-pill-main-glow flex-1 rounded-full px-4 py-2 text-xs font-bold transition disabled:opacity-50"
              style={{ background: "var(--pill-active-bg)", border: "none", cursor: busy ? "default" : "pointer" }}
            >
              Verify &amp; enable
            </button>
            <button
              type="button"
              onClick={cancelEnroll}
              disabled={busy}
              className="vltd-pill-neutral rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-50"
              style={{ background: "var(--pill)", border: "none", cursor: busy ? "default" : "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
