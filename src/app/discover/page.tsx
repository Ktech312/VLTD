"use client";

import Link from "next/link";

function IconCompass({ size = 48, style }: { size?: number; style?: Record<string, string | number> }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  );
}

export default function DiscoverPage() {
  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-8 flex h-24 w-24 items-center justify-center rounded-full"
            style={{
              background: "var(--theme-card, rgba(15,25,45,0.85))",
              border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.25))",
              boxShadow: "0 0 40px rgba(245,181,72,0.08)",
            }}
          >
            <IconCompass size={40} style={{ color: "var(--theme-gold, #F5B548)", opacity: 0.85 }} />
          </div>

          <div
            className="mb-4 rounded-full px-3 py-1 text-[11px] tracking-[0.2em]"
            style={{
              background: "var(--theme-elevated, rgba(20,32,55,0.9))",
              border: "1px solid var(--theme-border, rgba(245,181,72,0.12))",
              color: "var(--theme-gold, #F5B548)",
            }}
          >
            COMING SOON
          </div>

          <h1 className="text-3xl font-semibold sm:text-4xl" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
            Discover
          </h1>

          <p className="mt-4 max-w-md text-base leading-7" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
            Browse public galleries from collectors around the world. Explore curated exhibitions,
            discover new categories, and find inspiration for your own collection.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/museum"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition"
              style={{
                background: "var(--theme-gold, #F5B548)",
                color: "#0B1320",
                boxShadow: "0 4px 20px rgba(245,181,72,0.25)",
              }}
            >
              Browse Your Museum
            </Link>

            <Link
              href="/vault"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition"
              style={{
                background: "var(--theme-card, rgba(15,25,45,0.85))",
                border: "1px solid var(--theme-border, rgba(245,181,72,0.15))",
                color: "var(--theme-text-primary, #F0EAD6)",
              }}
            >
              Open Vault
            </Link>
          </div>
        </div>

        <div
          className="mt-16 grid gap-4 sm:grid-cols-3"
        >
          {[
            { label: "Public Galleries", value: "—", desc: "Curated by collectors" },
            { label: "Featured Works", value: "—", desc: "Handpicked highlights" },
            { label: "Active Collectors", value: "—", desc: "Growing community" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[20px] p-5 text-center"
              style={{
                background: "var(--theme-card, rgba(15,25,45,0.85))",
                border: "1px solid var(--theme-border, rgba(245,181,72,0.12))",
              }}
            >
              <div className="text-2xl font-semibold" style={{ color: "var(--theme-gold, #F5B548)" }}>
                {stat.value}
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                {stat.label}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                {stat.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
