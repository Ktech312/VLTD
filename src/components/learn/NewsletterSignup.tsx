"use client";

import { useState } from "react";

export default function NewsletterSignup({ source = "learn" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message || "Something went wrong. Try again.");
        return;
      }
      setStatus("done");
      setMessage(data?.alreadySubscribed ? "You're already on the list." : "You're on the list.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-[8px] border border-[rgba(245,181,72,0.28)] bg-[rgba(245,181,72,0.06)] px-4 py-3 text-sm text-[color:var(--fg)]">
        {message} We&apos;ll send guides and market updates — no spam.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="Your email address"
          className="min-h-10 flex-1 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--fg)] outline-none placeholder:text-[color:var(--muted2)] focus:border-[color:var(--theme-gold,#F5B548)]"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="min-h-10 shrink-0 rounded-[6px] px-5 text-sm font-bold disabled:opacity-60"
          style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}
        >
          {status === "loading" ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      {status === "error" ? (
        <p className="text-xs text-[color:#f0857d]">{message}</p>
      ) : (
        <p className="text-xs text-[color:var(--muted2)]">No spam. Unsubscribe anytime.</p>
      )}
    </form>
  );
}
