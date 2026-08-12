"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/account/AccountTabs";
import { RedeemCodeCard } from "@/components/account/RedeemCodeCard";
import { showToast } from "@/lib/toast";
import { getCurrentUser, getOnboardingStatus, getStoredActiveProfileId } from "@/lib/auth";
import { getStoredStripeCustomerId, setStoredStripeCustomerId } from "@/lib/billingClient";
import { getTierSafe, onTierChange, type Tier } from "@/lib/subscription";
import { Glyph } from "@/components/ui/Glyph";

type Plan = "free" | "pro" | "business";

function planForTier(tier: Tier): Plan {
  if (tier === "FULL") return "business";
  if (tier === "MID") return "pro";
  return "free";
}

const PLANS: { key: Plan; name: string; price: string; features: string[] }[] = [
  {
    key: "free",
    name: "Free",
    price: "$0 / mo",
    features: ["Up to 50 vault items", "4 public exhibitions", "Standard image quality", "Basic analytics", "Community registry"],
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

// profiles.tier is the source of truth (kept in sync by the Stripe webhook at
// src/app/api/billing/webhook/route.ts). getOnboardingStatus() pulls the real
// tier from Supabase and mirrors it into subscription.ts's local cache, which
// getTierSafe() reads here.
//
// profiles.stripe_customer_id (20260812_profiles_stripe_customer_id.sql) is
// now the source of truth for the customer id too, same webhook. localStorage
// (billingClient.ts) is read first for an instant, no-flash display on the
// device that originally checked out, then corrected to the real server value
// once getOnboardingStatus() resolves -- which is what actually fixes a real
// paying user opening this page on a NEW device: the Payment method/Invoice
// history/Cancel sections below now show up there too, not just on the
// original device.

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState<Plan>(() => planForTier(getTierSafe()));
  const [email, setEmail] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [busyPlan, setBusyPlan] = useState<Plan | null>(null);
  const [busyPortal, setBusyPortal] = useState(false);
  const [fromLimit, setFromLimit] = useState(false);

  useEffect(() => {
    getCurrentUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    setCustomerId(getStoredStripeCustomerId());
    void getOnboardingStatus().then(({ activeProfile }) => {
      setCurrentPlan(planForTier(getTierSafe()));
      const serverCustomerId = activeProfile?.stripe_customer_id;
      if (serverCustomerId) {
        setCustomerId(serverCustomerId);
        setStoredStripeCustomerId(serverCustomerId);
      }
    });
    const unsubscribe = onTierChange((tier) => setCurrentPlan(planForTier(tier)));

    const params = new URLSearchParams(window.location.search);
    const billingStatus = params.get("billing");
    const sessionId = params.get("session_id");
    if (params.get("reason") === "vault_limit") setFromLimit(true);

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
          void getOnboardingStatus().then(() => setCurrentPlan(planForTier(getTierSafe())));
        });
    } else if (billingStatus === "cancelled") {
      window.history.replaceState({}, "", "/account/billing");
    }

    return unsubscribe;
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
          profileId: getStoredActiveProfileId() || undefined,
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
          <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Billing & Plans</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>Manage your subscription and view invoice history.</p>

          <div className="mx-auto mt-6 max-w-2xl space-y-6">
        <RedeemCodeCard />

        {fromLimit ? (
          <div className="rounded-2xl p-4 ring-1" style={{ background: "var(--pill-active-bg)", borderColor: "var(--frame-ring)" }}>
            <div className="text-sm font-bold" style={{ color: "var(--theme-gold, #C8CDD2)" }}>You&apos;ve hit your free item limit</div>
            <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
              Upgrade to a paid plan below to add unlimited items and unlock everything.
            </div>
          </div>
        ) : null}

        {/* Current plan banner */}
        <div className="rounded-2xl p-4 ring-1" style={{ background: "var(--theme-gold-subtle, rgba(203,208,213,0.1))", borderColor: "var(--theme-gold-border, rgba(203,208,213,0.3))" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--theme-gold)" }}>Current plan</div>
              <div className="mt-1 text-xl font-black" style={{ color: "var(--fg)" }}>
                {currentPlan === "free" ? "Free" : currentPlan === "pro" ? "Pro — $9 / month" : "Business — $29 / month"}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                {currentPlan === "free" ? "Upgrade to unlock more features" : "Cancel anytime"}
              </div>
            </div>
            <div style={{ color: "var(--theme-gold)" }}><Glyph name="star" size={30} /></div>
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
                    background: isCurrent ? "var(--theme-gold-subtle, rgba(203,208,213,0.1))" : "var(--surface)",
                    borderColor: isCurrent ? "var(--theme-gold-border, rgba(203,208,213,0.3))" : "var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold" style={{ color: "var(--fg)" }}>{plan.name}</div>
                    {isCurrent && (
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d" }}>Active</span>
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
                      className="mt-4 w-full rounded-[8px] py-2 text-xs font-semibold ring-1 disabled:opacity-50"
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
                      className="mt-4 w-full rounded-[8px] py-2 text-xs font-semibold ring-1 disabled:opacity-50"
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

        {/* Payment method — only shown once a real subscription exists */}
        {customerId && (
          <div className="rounded-2xl p-5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Payment method</div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm" style={{ color: "var(--muted)" }}>Managed via Stripe billing portal</div>
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={busyPortal}
                className="rounded-[7px] px-3 py-1.5 text-xs ring-1 disabled:opacity-50"
                style={{ background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}
              >
                {busyPortal ? "Opening…" : "Manage"}
              </button>
            </div>
          </div>
        )}

        {/* Invoice history — only shown once a real subscription exists */}
        {customerId && (
          <div className="rounded-2xl p-5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>Invoice history</div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>View invoices and receipts in the <button type="button" onClick={openBillingPortal} className="underline" style={{ color: "var(--theme-gold)" }}>billing portal</button>.</p>
          </div>
        )}

        {/* Cancel — only shown once a real subscription exists */}
        {customerId && (
          <div className="rounded-2xl p-5 ring-1 ring-[color:rgba(248,113,113,0.3)]" style={{ background: "rgba(248,113,113,0.04)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#f87171" }}>Cancel subscription</div>
            <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>Your vault data is always yours. Canceling downgrades to Free at the end of the billing period.</p>
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={busyPortal}
              className="rounded-[7px] px-4 py-1.5 text-xs font-semibold ring-1 disabled:opacity-50"
              style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
            >
              {busyPortal ? "Opening…" : "Cancel plan"}
            </button>
          </div>
        )}
          </div>
        </section>
      </div>
    </main>
  );
}
