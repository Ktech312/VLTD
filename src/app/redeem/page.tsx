"use client";

import { useState } from "react";
import Link from "next/link";
import { redeemCoupon } from "@/lib/accessCoupons";
import { setTierSafe, type Tier } from "@/lib/subscription";

function formatUntil(until: string | null): string {
  if (!until) return "for life";
  try {
    const d = new Date(until);
    return `until ${d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
  } catch {
    return "";
  }
}

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleRedeem() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setResult(null);
    const res = await redeemCoupon(code);
    if (res.ok) {
      // Reflect immediately on this device
      setTierSafe(res.tier as Tier);
      setResult({
        ok: true,
        message: `Success! You now have ${res.tier} access ${formatUntil(res.until)}.`,
      });
      setCode("");
    } else {
      setResult({ ok: false, message: res.error });
    }
    setBusy(false);
  }

  return (
    <main className="min-h-dvh bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
      <div className="mx-auto w-full max-w-md">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">VLTD</div>
        <h1 className="mt-1 text-2xl font-semibold">Redeem a code</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Have a beta or gift code? Enter it below to unlock your access.
        </p>

        <div className="mt-6 rounded-[20px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <label htmlFor="code" className="text-[11px] font-semibold tracking-[0.14em] text-[color:var(--muted2)]">
            CODE
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setResult(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
            placeholder="VLTD-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            className="mt-1 h-12 w-full rounded-2xl bg-[color:var(--pill)] px-4 text-center text-lg font-bold tracking-[0.14em] ring-1 ring-[color:var(--border)] focus:outline-none"
          />

          <button
            type="button"
            onClick={handleRedeem}
            disabled={!code.trim() || busy}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-full text-sm font-bold transition disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B", boxShadow: "0 4px 18px rgba(245,181,72,0.28)" }}
          >
            {busy ? "Redeeming…" : "Redeem"}
          </button>

          {result ? (
            <div
              className="mt-3 rounded-xl px-4 py-3 text-sm ring-1"
              style={
                result.ok
                  ? { background: "rgba(74,222,128,0.10)", color: "#4ade80", borderColor: "rgba(74,222,128,0.3)" }
                  : { background: "rgba(248,113,113,0.10)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }
              }
            >
              {result.message}
            </div>
          ) : null}

          {result?.ok ? (
            <Link
              href="/vault"
              className="mt-3 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
            >
              Go to your vault
            </Link>
          ) : null}
        </div>

        <p className="mt-4 text-center text-xs text-[color:var(--muted2)]">
          You must be signed in for a code to apply to your account.
        </p>
      </div>
    </main>
  );
}
