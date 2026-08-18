"use client";

import { PageHeader } from "@/components/layout/PageHeader";

/* Messages / Inbox — stub for the visual pass. Direct messaging is wired in a
   later backend pass; for now this is the destination the bell's inbox alert
   points to. */
export default function MessagesPage() {
  return (
    <>
      <PageHeader title="Messages" description="Direct messages with other collectors." contentClassName="max-w-[900px]" />
      <main className="mx-auto w-full max-w-[900px] px-4 pb-16 pt-6 sm:px-6">
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-[8px] px-6 py-20 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
      >
        <span
          className="grid h-14 w-14 place-items-center rounded-[10px]"
          style={{ border: "1px solid rgba(79,211,238,0.4)", color: "#4FD3EE", background: "rgba(79,211,238,0.08)" }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 3V6a1 1 0 0 1 1-1z" />
            <path d="M8 10h8M8 13h5" />
          </svg>
        </span>
        <h2 className="text-lg font-black">Inbox coming soon</h2>
        <p className="max-w-sm text-sm" style={{ color: "var(--muted)" }}>
          Direct messaging is on the way. When it launches, new messages will alert you on the notification bell.
        </p>
      </div>
      </main>
    </>
  );
}
