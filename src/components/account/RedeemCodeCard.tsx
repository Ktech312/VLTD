"use client";

import { useState } from "react";
import { redeemCoupon } from "@/lib/accessCoupons";
import { setTierSafe, type Tier } from "@/lib/subscription";

function formatUntil(until: string | null): string {
  if (!until) return "for life";
  try {
    const date = new Date(until);
    return `until ${date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
  } catch {
    return "";
  }
}

export function RedeemCodeCard() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleRedeem() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setResult(null);
    const res = await redeemCoupon(code);
    if (res.ok) {
      setTierSafe(res.tier as Tier);
      setResult({
        ok: true,
        message: `Success. You now have ${res.tier} access ${formatUntil(res.until)}.`,
      });
      setCode("");
    } else {
      setResult({ ok: false, message: res.error });
    }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl p-5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
        Redeem code
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
        Have a beta or gift code? Apply it here to update account access.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            setResult(null);
          }}
          onKeyDown={(event) => event.key === "Enter" && handleRedeem()}
          placeholder="VLTD-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          className="h-11 rounded-[10px] bg-[color:var(--pill)] px-4 text-sm font-bold tracking-[0.14em] ring-1 ring-[color:var(--border)] focus:outline-none"
          style={{ color: "var(--fg)" }}
        />
        <button
          type="button"
          onClick={handleRedeem}
          disabled={!code.trim() || busy}
          className="h-11 rounded-[10px] px-5 text-sm font-bold transition disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #8C9298, #C8CDD2)",
            color: "#0B0B0B",
            boxShadow: "0 4px 18px rgba(203,208,213,0.24)",
          }}
        >
          {busy ? "Redeeming..." : "Redeem"}
        </button>
      </div>

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
    </section>
  );
}
