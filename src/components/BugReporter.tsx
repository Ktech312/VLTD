"use client";

import { useEffect, useRef, useState } from "react";

import { getCurrentUser, initAuthListener, onAuthStateChange } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type SubmitState = "idle" | "sending" | "done" | "error";

export default function BugReporter() {
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

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

  if (!signedIn) return null;

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        title="Report a bug"
        className="fixed right-4 bottom-24 z-[60] flex h-12 w-12 items-center justify-center rounded-full transition hover:-translate-y-0.5 sm:right-6 sm:bottom-6"
        style={{
          background: "var(--theme-elevated, rgba(12,18,30,0.96))",
          border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.4))",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          color: "var(--theme-gold, #F5B548)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 2l1.5 1.5M16 2l-1.5 1.5" />
          <path d="M12 20a6 6 0 0 0 6-6v-3a6 6 0 0 0-12 0v3a6 6 0 0 0 6 6z" />
          <path d="M12 8v12M3 9h3M3 14h3M3 19l3-2M18 9h3M18 14h3M18 19l-3-2M6 7l-2-2M18 7l2-2" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Report a bug"
        >
          <div
            className="w-full max-w-md rounded-[24px] p-6"
            style={{
              background: "var(--theme-elevated, rgba(12,18,30,0.98))",
              border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.28))",
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
                <div className="text-2xl">✅</div>
                <p className="mt-1 text-sm font-semibold" style={{ color: "#4ade80" }}>Thanks — your report was sent!</p>
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="What happened? What did you expect?"
                  className="mt-4 w-full resize-none rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 py-3 text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(245,181,72,0.12)]"
                />

                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[color:var(--muted)] transition hover:text-text-primary">
                  <span className="text-base">📎</span>
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

                <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse">
                  <button
                    type="button"
                    disabled={!message.trim() || state === "sending"}
                    onClick={() => void submit()}
                    className="vltd-primary-button h-12 flex-1 rounded-full px-6 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {state === "sending" ? "Sending…" : "Send report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); reset(); }}
                    className="h-12 rounded-full border px-6 text-sm font-semibold transition"
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
    </>
  );
}
