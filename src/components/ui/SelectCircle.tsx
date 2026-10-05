import { AppIcon } from "@/components/ui/AppIcon";

// The multi-select circle drawn over each Vault card. It sits on top of
// arbitrary photos (white record sleeves, dark slabs), so it carries its own
// dark backing, a bright ring and a soft glow to stay visible on either.
export function SelectCircle({ selected }: { selected: boolean }) {
  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-full"
      style={
        selected
          ? {
              background: "#C8CDD2",
              border: "2px solid rgba(255,255,255,0.95)",
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.5), 0 0 12px 3px rgba(255,255,255,0.7), 0 0 24px 6px rgba(203,208,213,0.5)",
            }
          : {
              background: "rgba(8,10,14,0.5)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              border: "2px solid rgba(255,255,255,0.95)",
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.5), 0 0 10px 2px rgba(255,255,255,0.55), 0 0 22px 5px rgba(203,208,213,0.35)",
            }
      }
    >
      {selected && <AppIcon name="checkmark" size={14} strokeWidth={2} style={{ color: "#1A0F00" }} />}
    </span>
  );
}
