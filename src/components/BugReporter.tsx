"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getCurrentUser, initAuthListener, onAuthStateChange } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type SubmitState = "idle" | "sending" | "done" | "error";
const BUG_HELPER_NEVER_KEY = "vltd_bug_helper_never";
const BUG_HELPER_SESSION_KEY = "vltd_bug_helper_dismissed";

export default function BugReporter() {
  const [signedIn, setSignedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    initAuthListener();
    let active = true;
    void getCurrentUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.user));
    });
    const { data } = onAuthStateChange((_e: string, session: { user?: unknown } | null) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => {
      active = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!mounted || !signedIn) return;
    try {
      const never = localStorage.getItem(BUG_HELPER_NEVER_KEY) === "1";
      const dismissedThisSession = sessionStorage.getItem(BUG_HELPER_SESSION_KEY) === "1";
      if (!never && !dismissedThisSession) setShowHelper(true);
    } catch {
      setShowHelper(true);
    }
  }, [mounted, signedIn]);

  function dismissHelper() {
    setShowHelper(false);
    try { sessionStorage.setItem(BUG_HELPER_SESSION_KEY, "1"); } catch { /* noop */ }
  }

  function neverShowHelper() {
    setShowHelper(false);
    try {
      localStorage.setItem(BUG_HELPER_NEVER_KEY, "1");
      sessionStorage.setItem(BUG_HELPER_SESSION_KEY, "1");
    } catch { /* noop */ }
  }

  function reset() {
    setMessage("");
    setFile(null);
    setState("idle");
    setErrorMsg("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!message.trim() || state === "sending") return;
    setState("sending");
    setErrorMsg("");

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Not connected.");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      // Upload the screenshot (optional).
      let screenshotUrl: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user?.id ?? "anon"}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("bug-screenshots")
          .upload(path, file, { upsert: false, contentType: file.type || "image/png" });
        if (!upErr) {
          screenshotUrl = supabase.storage.from("bug-screenshots").getPublicUrl(path).data.publicUrl ?? null;
        }
        // A failed screenshot upload should not block the report itself.
      }

      const { error } = await supabase.from("bug_reports").insert({
        user_id: user?.id ?? null,
        email: user?.email ?? null,
        message: message.trim().slice(0, 4000),
        screenshot_url: screenshotUrl,
        page_path: typeof window !== "undefined" ? window.location.pathname : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null,
      });
      if (error) throw error;

      setState("done");
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1600);
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Couldn't send. Try again.");
    }
  }

  if (!signedIn || !mounted) return null;

  return createPortal(
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => {
          dismissHelper();
          setOpen(true);
        }}
        aria-label="Report a bug"
        title="Report a bug"
        className="fixed right-4 bottom-24 z-[60] flex h-12 w-12 items-center justify-center rounded-full transition hover:-translate-y-0.5 sm:right-6 sm:bottom-6"
        style={{
          // Force fixed positioning inline — a global button rule overrides the
          // `fixed` class with position:relative, which shoved this off-screen.
          position: "fixed",
          top: "auto",
          left: "auto",
          background: "var(--theme-elevated, rgba(12,18,30,0.96))",
          border: "1px solid var(--theme-gold-border, rgba(203,208,213,0.4))",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          color: "var(--theme-gold, #C8CDD2)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {/* antennae */}
          <path d="M9 4.3 8 2.8M15 4.3 16 2.8" />
          {/* head */}
          <circle cx="12" cy="6" r="1.5" />
          {/* body */}
          <ellipse cx="12" cy="13.5" rx="4.6" ry="6" />
          {/* wing seam */}
          <path d="M12 8v11" />
          {/* legs (3 per side) */}
          <path d="M7.4 10.5 4.3 9M7.4 13.5 4 13.5M7.4 16.5 4.3 18M16.6 10.5 19.7 9M16.6 13.5 20 13.5M16.6 16.5 19.7 18" />
        </svg>
      </button>

      {showHelper && !open && (
        <div
          className="fixed right-4 bottom-[9.25rem] z-[10000] w-[min(18rem,calc(100vw-2rem))] rounded-[14px] p-3 text-left sm:right-6 sm:bottom-[5.25rem]"
          style={{
            position: "fixed",
            zIndex: 10000,
            background: "linear-gradient(180deg, rgba(8,14,20,0.98), rgba(2,8,12,0.99))",
            border: "1px solid var(--theme-gold-border, rgba(203,208,213,0.42))",
            boxShadow: "0 18px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(237,239,241,0.08)",
            color: "var(--fg)",
          }}
          role="dialog"
          aria-label="Bug report helper"
        >
          <button
            type="button"
            onClick={dismissHelper}
            aria-label="Close bug helper"
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-[13px]"
            style={{ color: "var(--muted)", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(203,208,213,0.20)" }}
          >
            ×
          </button>
          <div className="pr-7">
            <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--theme-gold, #C8CDD2)" }}>Report issues</div>
            <p className="mt-1 text-sm font-bold leading-tight text-[color:var(--fg)]">See something broken?</p>
            <p className="mt-1.5 text-xs leading-snug text-[color:var(--muted)]">
              Tap the bug button to send a quick note and optional screenshot. It helps us fix beta problems faster.
            </p>
            <button
              type="button"
              onClick={neverShowHelper}
              className="mt-3 text-[11px] font-semibold"
              style={{ color: "var(--theme-gold, #C8CDD2)" }}
            >
              Never show again
            </button>
          </div>
          <div
            className="absolute -bottom-2 right-8 h-4 w-4 rotate-45"
            style={{
              background: "rgba(2,8,12,0.99)",
              borderRight: "1px solid var(--theme-gold-border, rgba(203,208,213,0.42))",
              borderBottom: "1px solid var(--theme-gold-border, rgba(203,208,213,0.42))",
            }}
          />
        </div>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[10001] flex items-start justify-center overflow-y-auto px-4 pt-4 sm:items-center sm:pt-0"
          style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Report a bug"
          onClick={() => { setOpen(false); reset(); }}
        >
          <div
            className="w-full max-w-md rounded-[24px] p-6"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--theme-elevated, rgba(12,18,30,0.98))",
              border: "1px solid var(--theme-gold-border, rgba(203,208,213,0.28))",
              boxShadow: "0 28px 90px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-text-primary">Report a bug</h3>
              <button type="button" onClick={() => { setOpen(false); reset(); }} aria-label="Close" className="text-[color:var(--muted2)] transition hover:text-text-primary">✕</button>
            </div>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Tell us what went wrong — the more detail, the better. A screenshot helps a lot.
            </p>

            {state === "done" ? (
              <div className="mt-5 rounded-2xl border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.06)] px-4 py-5 text-center">
                <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>Thanks — your report was sent!</p>
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="What happened? What did you expect?"
                  className="mt-4 w-full resize-none rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 py-3 text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                />

                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[color:var(--muted)] transition hover:text-text-primary">
                  <span className="truncate">{file ? file.name : "Attach a screenshot (optional)"}</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                {state === "error" && (
                  <p className="mt-3 text-xs" style={{ color: "#f87171" }}>{errorMsg}</p>
                )}

                <div className="mt-5 flex flex-row-reverse gap-3">
                  <button
                    type="button"
                    disabled={!message.trim() || state === "sending"}
                    onClick={() => void submit()}
                    className="vltd-primary-button h-12 flex-1 rounded-full px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {state === "sending" ? "Sending…" : "Send report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); reset(); }}
                    className="h-12 flex-1 rounded-full border px-4 text-sm font-semibold transition"
                    style={{ borderColor: "var(--border)", background: "var(--pill)", color: "var(--muted)" }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
