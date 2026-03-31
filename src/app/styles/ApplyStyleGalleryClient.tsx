// Path: src/app/styles/ApplyStyleGalleryClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { readStyle, setStyle, type StyleKey, STYLE_LABEL } from "@/lib/style";

type StyleCard = {
  key: StyleKey;
  headline: string;
  sub: string;
  tags: string[];
  previewClass: string; // uses the same root class naming convention
};

function IconCheck({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path
        d="M12 2l1.2 5.2L18 9l-4.8 1.8L12 16l-1.2-5.2L6 9l4.8-1.8L12 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M19 14l.7 3L22 18l-2.3 1-.7 3-.7-3L16 18l2.3-1 .7-3Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default function ApplyStyleGalleryClient() {
  const [active, setActive] = useState<StyleKey>("MINIMAL");

  useEffect(() => {
    setActive(readStyle());
  }, []);

  const styles: StyleCard[] = useMemo(
    () => [
      {
        key: "MINIMAL",
        headline: "Minimal Gold",
        sub: "Clean, fast, readable. Best for small icons + mobile UI.",
        tags: ["UI-first", "Readable", "Scalable"],
        previewClass: "style-minimal",
      },
      {
        key: "ENGRAVED",
        headline: "Engraved",
        sub: "Premium feel for larger surfaces (logo, hero, print).",
        tags: ["Luxury", "Print", "Brand"],
        previewClass: "style-engraved",
      },
      {
        key: "ROYAL",
        headline: "Royal",
        sub: "Bold + emblematic. Works great for headers and section badges.",
        tags: ["Bold", "Emblem", "Hero"],
        previewClass: "style-royal",
      },
      {
        key: "NEON_MIRROR",
        headline: "Neon Mirror",
        sub: "Your existing mirror palette vibe—high contrast, techy.",
        tags: ["Neon", "Tech", "High contrast"],
        previewClass: "style-neon_mirror",
      },
      {
        key: "NEON_PURPLE",
        headline: "Neon Purple",
        sub: "Purple rain energy—great for Portfolio + analytics pages.",
        tags: ["Purple", "Neon", "Modern"],
        previewClass: "style-neon_purple",
      },
      {
        key: "NOIR",
        headline: "Noir",
        sub: "Dark, cinematic, minimal distractions. Great for galleries.",
        tags: ["Dark", "Gallery", "Focus"],
        previewClass: "style-noir",
      },
      {
        key: "PAPER",
        headline: "Paper",
        sub: "Light, tactile. Nice for inventory lists and printing.",
        tags: ["Light", "Print-friendly", "Neutral"],
        previewClass: "style-paper",
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs tracking-widest text-[color:var(--muted2)]">STYLES</div>
            <h1 className="mt-2 text-4xl font-semibold">Apply Style Gallery</h1>
            <div className="mt-2 text-sm text-[color:var(--muted)]">
              Pick a style. It persists locally and syncs across tabs. More styles can be added without UI refactors.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/user"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)] transition"
            >
              Back to Settings
            </Link>
            <Link
              href="/vault"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)] transition"
            >
              Museum
            </Link>
          </div>
        </div>

        {/* Active banner */}
        <div className="mt-6 rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs tracking-widest text-[color:var(--muted2)]">CURRENT</div>
              <div className="mt-2 flex items-center gap-2 text-xl font-semibold">
                <IconSpark className="h-5 w-5" />
                {STYLE_LABEL[active]}
              </div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Tip: start with <span className="font-semibold">Minimal</span> for icons, use{" "}
                <span className="font-semibold">Engraved</span> for logo/print.
              </div>
            </div>

            <PillButton
              variant="active"
              onClick={() => {
                setStyle("MINIMAL");
                setActive("MINIMAL");
              }}
              title="Reset to Minimal"
            >
              Reset to Minimal
            </PillButton>
          </div>
        </div>

        {/* Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {styles.map((s) => {
            const selected = s.key === active;
            return (
              <div
                key={s.key}
                className={[
                  "rounded-3xl p-6 ring-1 shadow-[var(--shadow-soft)] transition",
                  "bg-[color:var(--surface)] ring-[color:var(--border)]",
                ].join(" ")}
              >
                {/* Preview */}
                <div
                  className={[
                    "rounded-2xl overflow-hidden ring-1 ring-[color:var(--border)]",
                    "bg-black/15",
                  ].join(" ")}
                >
                  <div className="p-5">
                    {/* This preview box uses class naming convention for your future CSS */}
                    <div className={[s.previewClass, "rounded-2xl p-4"].join(" ")}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs tracking-widest text-[color:var(--muted2)]">PREVIEW</div>
                          <div className="mt-2 text-lg font-semibold truncate">{s.headline}</div>
                          <div className="mt-1 text-sm text-[color:var(--muted)]">{s.sub}</div>
                        </div>
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]">
                          {/* placeholder “icon coin” */}
                          <div className="h-6 w-6 rounded-full bg-[color:var(--pill-active-bg)]" />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {s.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)] text-[color:var(--pill-fg)]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{STYLE_LABEL[s.key]}</div>

                  {selected ? (
                    <span className="inline-flex items-center gap-2 text-sm text-[color:var(--muted)]">
                      <IconCheck className="h-4 w-4" /> Applied
                    </span>
                  ) : (
                    <PillButton
                      variant="primary"
                      onClick={() => {
                        setStyle(s.key);
                        setActive(s.key);
                      }}
                      title={`Apply ${STYLE_LABEL[s.key]}`}
                    >
                      Apply
                    </PillButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-8 text-xs text-[color:var(--muted2)]">
          Styles are implemented as <span className="font-semibold">root classes</span>:{" "}
          <span className="font-semibold">style-minimal</span>, <span className="font-semibold">style-engraved</span>, etc.
          Add or adjust CSS in <span className="font-semibold">globals.css</span> without touching React layout.
        </div>
      </div>
    </main>
  );
}