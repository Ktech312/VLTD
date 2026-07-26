"use client";

import Link from "next/link";

/** Inline "you've hit the free limit → upgrade" prompt, shown wherever a save is
 *  blocked by the free-tier item cap. Links to the billing page. */
export default function UpgradeNudge({
  message,
  onDismiss,
}: {
  message?: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ring-1"
      style={{ background: "rgba(203,208,213,0.10)", borderColor: "rgba(203,208,213,0.4)" }}
    >
      <span className="text-lg" aria-hidden="true">✨</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold" style={{ color: "#C8CDD2" }}>
          You&apos;ve reached your free limit
        </div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {message || "Upgrade to add unlimited items and unlock everything."}
        </div>
      </div>
      <Link
        href="/account/billing?reason=vault_limit"
        className="shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95"
        style={{ background: "linear-gradient(135deg,#8C9298,#C8CDD2)", color: "#0B0B0B" }}
      >
        Upgrade
      </Link>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-lg leading-none"
          style={{ color: "var(--muted2)" }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

/** True when an error is the free-tier limit signal thrown by appendItems. */
export function isFreeTierLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.startsWith("FREE_TIER_LIMIT:");
}
