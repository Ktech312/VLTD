"use client";

/* Clubs — parked as a "Coming soon" feature (EK: revisit after the Lounge intel
   sections are built; decide Discord / social / in-app direction then). */
export default function ClubsPage() {
  return (
    <main className="mx-auto w-full max-w-[900px] px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-[34px] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] sm:text-[42px]">Clubs</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Collector clubs and community spaces.</p>
      </header>

      <div
        className="flex flex-col items-center justify-center gap-3 rounded-[8px] px-6 py-20 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
      >
        <span
          className="grid h-14 w-14 place-items-center rounded-[10px]"
          style={{ border: "1px solid rgba(79,211,238,0.4)", color: "#4FD3EE", background: "rgba(79,211,238,0.08)" }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3" />
            <circle cx="17" cy="10" r="2.4" />
            <path d="M3 20c.7-3.4 3-5.2 6-5.2s5.3 1.8 6 5.2M15.5 20c.4-2 1.7-3.2 3.4-3.2 1.4 0 2.5.8 3.1 2.2" />
          </svg>
        </span>
        <span className="rounded-[4px] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ background: "rgba(79,211,238,0.1)", color: "#4FD3EE", border: "1px solid rgba(79,211,238,0.35)" }}>Coming soon</span>
        <h2 className="text-lg font-black">Clubs are on the way</h2>
        <p className="max-w-sm text-sm" style={{ color: "var(--muted)" }}>
          A home for collector clubs — Discord, social spaces, and in-app rooms. We&apos;ll finalize the direction after the Lounge is fully built out.
        </p>
      </div>
    </main>
  );
}
