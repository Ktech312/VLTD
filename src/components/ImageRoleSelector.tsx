"use client";

export type ImageRole = "primary" | "detail" | "proof";

const ROLE_OPTIONS: Array<{
  value: ImageRole;
  label: string;
  description: string;
}> = [
  {
    value: "primary",
    label: "Primary",
    description: "Main collector-facing item image.",
  },
  {
    value: "detail",
    label: "Detail",
    description: "Front, back, edges, flaws, signatures, close-ups.",
  },
  {
    value: "proof",
    label: "Proof",
    description: "Receipt, cert, invoice, provenance, ownership proof.",
  },
];

export default function ImageRoleSelector({
  value,
  onChange,
  label = "IMAGE ROLE",
  compact = false,
}: {
  value: ImageRole;
  onChange: (value: ImageRole) => void;
  label?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={[
        "rounded-[16px] bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]",
        compact ? "p-2.5" : "p-3",
      ].join(" ")}
    >
      <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
        {label}
      </div>

      <div className="mt-3 grid gap-2">
        {ROLE_OPTIONS.map((option) => {
          const active = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={[
                "w-full rounded-xl px-3 py-2.5 text-left ring-1 transition",
                active
                  ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
                  : "bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]",
              ].join(" ")}
              aria-pressed={active}
              title={option.label}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{option.label}</div>
                <div className="text-xs opacity-80">
                  {active ? "Selected" : "Choose"}
                </div>
              </div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                {option.description}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}