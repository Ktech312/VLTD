"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { showToast } from "@/lib/toast";
import { getCurrentUser } from "@/lib/auth";
import { getStoredStripeCustomerId, setStoredStripeCustomerId } from "@/lib/billingClient";

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

// Demo data - real plan/invoice state needs a webhook syncing Stripe
// subscription events back to a profile record, which is a separate piece
// of work from the checkout/portal plumbing built here.
const MOCK_INVOICES = [
  { id: "INV-2026-06", date: "Jun 1, 2026", amount: "$9.00", status: "Paid" },
  { id: "INV-2026-05", date: "May 1, 2026", amount: "$9.00", status: "Paid" },
  { id: "INV-2026-04", date: "Apr 1, 2026", amount: "$9.00", status: "Paid" },
];

export default function BillingPage() {
  const currentPlan: Plan = "pro";
  const [email, setEmail] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [busyPlan, setBusyPlan] = useState<Plan | null>(null);
  const [busyPortal, setBusyPortal] = useState(false);

  useEffect(() => {
    getCurrentUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    setCustomerId(getStoredStripeCustomerId());

    const params = new URLSearchParams(window.location.search);
    const billingStatus = params.get("billing");
    const sessionId = params.get("session_id");

    if (billingStatus === "success" && sessionId) {
      fetch(`/api/billing/session?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.customerId) {
            setStoredStripeCustomerId(data.customerId);
            setCustomerId(data.customerId);
            showToast("Subscription updated.");
          }
        })
        .catch(() => {})
        .finally(() => {
          window.history.replaceState({}, "", "/account/billing");
        });
    } else if (billingStatus === "cancelled") {
      window.history.replaceState({}, "", "/account/billing");
    }
  }, []);

  async function handleUpgrade(plan: Plan) {
    if (plan === "free" || busyPlan) return;
    setBusyPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          customerEmail: email || undefined,
          returnUrl: `${window.location.origin}/account/billing`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.message || "Couldn't start checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      showToast("Couldn't start checkout — try again.");
    } finally {
      setBusyPlan(null);
    }
  }

  async function openBillingPortal() {
    if (busyPortal) return;
    setBusyPortal(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          returnUrl: `${window.location.origin}/account/billing`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.message || "Couldn't open billing portal.");
        return;
      }
      window.location.href = data.url;
    } catch {
      showToast("Couldn't open billing portal — try again.");
    } finally {
      setBusyPortal(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <Link href="/account"><PillButton>Account</PillButton></Link>
            <Link href="/account/workspace"><PillButton>Workspace</PillButton></Link>
            <Link href="/account/team"><PillButton>Team</PillButton></Link>
            <Link href="/account/security"><PillButton>Security</PillButton></Link>
            <Link href="/account/billing"><PillButton variant="active">Billing</PillButton></Link>
          </div>
          <h1 className="mt-4 text-2xl font-bold" style={{ color: "var(--fg)" }}>Billing & Plans</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>Manage your subscription and view invoice history.</p>
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
                  {!isCurrent && plan.key !== "free" && (
                    <button
                      type="button"
                      onClick={() => handleUpgrade(plan.key)}
                      disabled={busyPlan !== null}
                      className="mt-4 w-full rounded-full py-2 text-xs font-semibold ring-1 disabled:opacity-50"
                      style={{
                        background: plan.key === "business" ? "var(--theme-gold)" : "var(--pill)",
                        color: plan.key === "business" ? "#0B0B0B" : "var(--fg)",
                        borderColor: "var(--border)",
                      }}
                    >
                      {busyPlan === plan.key ? "Redirecting…" : "Upgrade →"}
                    </button>
                  )}
                  {!isCurrent && plan.key === "free" && (
                    <button
                      type="button"
                      onClick={openBillingPortal}
                      disabled={busyPortal}
                      className="mt-4 w-full rounded-full py-2 text-xs font-semibold ring-1 disabled:opacity-50"
                      style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
                    >
                      Downgrade
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
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={busyPortal}
              className="rounded-full px-3 py-1.5 text-xs ring-1 disabled:opacity-50"
              style={{ background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}
            >
              {busyPortal ? "Opening…" : "Update"}
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
          <button
            type="button"
            onClick={openBillingPortal}
            disabled={busyPortal}
            className="rounded-full px-4 py-1.5 text-xs font-semibold ring-1 disabled:opacity-50"
            style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
          >
            {busyPortal ? "Opening…" : "Cancel plan"}
          </button>
        </div>
      </div>
    </main>
  );
}
