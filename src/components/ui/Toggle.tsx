"use client";

/**
 * The shared on/off switch (Revision 2). The button is a 44px-high touch target on phones and the
 * 24px track itself on desktop. On/off colours are theme-safe (the off track carries a visible edge on
 * light themes), keyboard focus uses the shared ring, and a disabled switch dims through .vltd-disabled.
 */
export function Toggle({
  on,
  onChange,
  disabled = false,
  ariaLabel,
  title,
  className = "",
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onChange}
      className={[
        "group relative inline-flex h-11 min-w-11 shrink-0 items-center justify-center md:h-6 md:min-w-0",
        "rounded-full focus:outline-none",
        disabled ? "vltd-disabled cursor-not-allowed" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      <span
        className="relative block h-6 w-11 rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-[color:var(--pill-active-ring)] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-transparent"
        style={
          on
            ? { background: "#16A34A", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }
            : { background: "var(--pill)", boxShadow: "inset 0 0 0 1px var(--muted)" }
        }
      >
        <span
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow transition-transform"
          style={{ background: on ? "#fff" : "var(--muted)", transform: on ? "translateX(20px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}
