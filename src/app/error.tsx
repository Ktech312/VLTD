"use client";

import { useEffect } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { describeLoadFailure, markLoadStage } from "@/lib/loadDiagnostics";

// A page that fails while it is being drawn used to leave nothing useful on screen. This keeps the navigation, says so plainly, and records
// which step failed (the error's name and Next's short digest only: never its message, which can contain page content).
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    markLoadStage("render:error", false, (error?.name || "Error") + (error?.digest ? " digest " + error.digest : ""));
  }, [error]);
  const detail = describeLoadFailure();
  return (
    <section className="mx-auto mt-10 max-w-xl rounded-[18px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]" role="alert">
      <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">COULD NOT DISPLAY THIS PAGE</div>
      <h2 className="mt-2 text-2xl font-semibold">Something went wrong while drawing this page</h2>
      <p className="mt-2 text-sm text-[color:var(--muted)]">Your items are safe: nothing has been changed or lost. Try again, or go back to Home.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <PillButton variant="primary" onClick={reset}>Try again</PillButton>
        <PillButton href="/dashboard">Home</PillButton>
      </div>
      {detail ? <p className="mt-4 break-words text-[11px] text-[color:var(--muted2)]">Details: {detail}</p> : null}
    </section>
  );
}
