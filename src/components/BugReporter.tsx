"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/AppIcon";

import { getCurrentUser, initAuthListener, onAuthStateChange } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { loadRecordForReport } from "@/lib/loadDiagnostics";

type SubmitState = "idle" | "sending" | "done" | "error";

export default function BugReporter() {
  const [signedIn, setSignedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  // On a phone the floating button only shows once the page is scrolled to its end, where the page leaves room for it (--bug-fab-space, globals.css), so it never sits on content.
  // Anywhere else on a phone, Report a bug is Account menu > Support (it opens this same dialog).
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const check = () => {
      const sc = document.querySelector<HTMLElement>(".vltd-content-wrap");
      setAtEnd(!sc || sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 16);
    };
    check();
    const id = window.setInterval(check, 400);
    window.addEventListener("scroll", check, true);
    window.addEventListener("resize", check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", check, true);
      window.removeEventListener("resize", check);
    };
  }, []);

  // Room under the last content of a phone page for the button (read by .vltd-content-wrap::after in globals.css).
  useEffect(() => {
    if (!signedIn) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => document.documentElement.style.setProperty("--bug-fab-space", mq.matches ? "44px" : "0px");
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.documentElement.style.removeProperty("--bug-fab-space");
    };
  }, [signedIn]);

  // Help > Support in the top bar opens this same reporter.
  useEffect(() => {
    const openFromHelp = () => setOpen(true);
    window.addEventListener("vltd:open-support", openFromHelp);
    return () => window.removeEventListener("vltd:open-support", openFromHelp);
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
        // The page's load record (steps, timings, short codes: no content) rides along so "the page was blank / slow" can be explained.
        message: (message.trim().slice(0, 3000) + (loadRecordForReport() ? "\n\n" + loadRecordForReport() : "")).slice(0, 4000),
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
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        title="Report a bug"
        data-site-chrome="true"
        data-quiet={atEnd ? undefined : "true"}
        className="vltd-bug-fab fixed right-4 bottom-20 z-[60] flex h-12 w-12 items-center justify-center rounded-full transition hover:-translate-y-0.5 sm:right-6 sm:bottom-6"
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
        <AppIcon name="bug" size={22} strokeWidth={1.7} />
      </button>

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
            className="w-full max-w-md rounded-[14px] p-6"
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
              <div className="mt-5 rounded-[14px] border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.06)] px-4 py-5 text-center">
                <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>Thanks — your report was sent!</p>
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="What happened? What did you expect?"
                  className="mt-4 w-full resize-none rounded-[14px] border border-[color:var(--border)] bg-vault-card px-4 py-3 text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                />

                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-[14px] border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[color:var(--muted)] transition hover:text-text-primary">
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
