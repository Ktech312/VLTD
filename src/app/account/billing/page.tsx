"use client";

import Link from "next/link";

type Plan = "free" | "pro" | "business";

const PLANS: { key: Plan; name: string; price: string; features: string[] }[] = [
  {
    key: "free",
    name: "Free",
    price: "$0 / mo",
    features: ["Up to 100 vault items", "1 public profile", "Basic analytics", "Community registry"],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$9 / mo",
    features: ["Unlimited vault items", "3 public profiles", "Weekly reports", "Portfolio analytics", "Export CSV & PDF", "AI draft queue"],
  },
  {
    key: "business",
    name: "Business",
    price: "$29 / mo",
    features: ["Everything in Pro", "Team members & roles", "Multi-workspace", "Business billing & invoicing", "Priority support", "API access"],
  },
];

const MOCK_INVOICES = [
  { id: "INV-2026-06", date: "Jun 1, 2026", amount: "$9.00", status: "Paid" },
  { id: "INV-2026-05", date: "May 1, 2026", amount: "$9.00", status: "Paid" },
  { id: "INV-2026-04", date: "Apr 1, 2026", amount: "$9.00", status: "Paid" },
];

export default function BillingPage() {
  const currentPlan: Plan = "pro";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link href="/account" className="text-sm" style={{ color: "var(--muted)" }}>Account</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Billing</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold" style={{ color: "var(--fg)" }}>Billing & Plans</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>Manage your subscription and view invoice history.</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Current plan banner */}
        <div className="rounded-2xl p-4 ring-1" style={{ background: "var(--theme-gold-subtle, rgba(245,181,72,0.1))", borderColor: "var(--theme-gold-border, rgba(245,181,72,0.3))" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--theme-gold)" }}>Current plan</div>
              <div className="mt-1 text-xl font-black" style={{ color: "var(--fg)" }}>Pro — $9 / month</div>
              <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>Renews Jul 1, 2026 · Cancel anytime</div>
            </div>
            <div className="text-3xl">⭐</div>
          </div>
        </div>

        {/* Plan comparison */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Compare plans</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              return (
                <div
                  key={plan.key}
                  className="rounded-2xl p-4 ring-1 transition"
                  style={{
                    background: isCurrent ? "var(--theme-gold-subtle, rgba(245,181,72,0.1))" : "var(--surface)",
                    borderColor: isCurrent ? "var(--theme-gold-border, rgba(245,181,72,0.3))" : "var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold" style={{ color: "var(--fg)" }}>{plan.name}</div>
                    {isCurrent && (
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: "var(--theme-gold)", color: "#0B0B0B" }}>Active</span>
                    )}
                  </div>
                  <div className="mt-1 text-base font-black" style={{ color: isCurrent ? "var(--theme-gold)" : "var(--fg)" }}>{plan.price}</div>
                  <ul className="mt-3 space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="text-[11px] flex items-start gap-1.5" style={{ color: "var(--muted)" }}>
                        <span style={{ color: "#4ade80" }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => alert("Upgrade flow coming soon.")}
                      className="mt-4 w-full rounded-full py-2 text-xs font-semibold ring-1"
                      style={{
                        background: plan.key === "business" ? "var(--theme-gold)" : "var(--pill)",
                        color: plan.key === "business" ? "#0B0B0B" : "var(--fg)",
                        borderColor: "var(--border)",
                      }}
                    >
                      {plan.key === "free" ? "Downgrade" : "Upgrade →"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment method */}
        <div className="rounded-2xl p-5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Payment method</div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-12 items-center justify-center rounded-md text-xs font-bold" style={{ background: "#1a1f71", color: "#fff" }}>VISA</div>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--fg)" }}>•••• •••• •••• 4242</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Expires 12/27</div>
              </div>
            </div>
            <button type="button" onClick={() => alert("Card update coming soon.")} className="rounded-full px-3 py-1.5 text-xs ring-1" style={{ background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}>
              Update
            </button>
          </div>
        </div>

        {/* Invoice history */}
        <div className="rounded-2xl p-5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Invoice history</div>
          <div className="space-y-2">
            {MOCK_INVOICES.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 py-2 border-b border-[color:var(--border)] last:border-0">
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{inv.id}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{inv.date}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>{inv.status}</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{inv.amount}</span>
                  <button type="button" className="text-xs" style={{ color: "var(--muted)" }}>PDF</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cancel */}
        <div className="rounded-2xl p-5 ring-1 ring-[color:rgba(248,113,113,0.3)]" style={{ background: "rgba(248,113,113,0.04)" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#f87171" }}>Cancel subscription</div>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>Your vault data is always yours. Canceling downgrades to Free at the end of the billing period.</p>
          <button type="button" onClick={() => alert("Cancel flow coming soon.")} className="rounded-full px-4 py-1.5 text-xs font-semibold ring-1" style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
            Cancel plan
          </button>
        </div>
      </div>
    </div>
  );
}
