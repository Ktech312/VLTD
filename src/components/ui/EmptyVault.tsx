import { Glyph, type GlyphName } from "@/components/ui/Glyph";
import { PillButton } from "@/components/ui/PillButton";

// A friendly "you haven't added anything yet" screen. Same look everywhere:
// dark panel, themed glyph, a short message, and buttons to add an item.
export function EmptyVault({
  glyph = "box",
  eyebrow,
  title = "Nothing here yet",
  message,
  showAddButtons = true,
}: {
  glyph?: GlyphName;
  eyebrow?: string;
  title?: string;
  message: string;
  showAddButtons?: boolean;
}) {
  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {eyebrow ? (
          <div className="text-[11px] tracking-[0.22em]" style={{ color: "var(--muted2)" }}>
            {eyebrow}
          </div>
        ) : null}
        <div
          className="mt-8 rounded-3xl p-8 text-center"
          style={{
            background: "var(--theme-card, rgba(15,25,45,0.85))",
            border: "1px solid var(--theme-border, rgba(203,208,213,0.12))",
          }}
        >
          <div className="flex justify-center opacity-40" style={{ color: "var(--theme-gold)" }}>
            <Glyph name={glyph} size={46} />
          </div>
          <div className="mt-4 text-lg font-semibold">{title}</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted)]">{message}</p>
          {showAddButtons ? (
            <div className="mt-6 flex justify-center gap-2">
              <PillButton
                href="/capture"
                style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0B0B0B" }}
              >
                Smart Scan
              </PillButton>
              <PillButton
                href="/vault/add"
                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--fg)", boxShadow: "none" }}
              >
                Add manually
              </PillButton>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
