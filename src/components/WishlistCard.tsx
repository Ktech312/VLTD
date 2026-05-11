
"use client";

export default function WishlistCard({ item }: { item: any }) {
  return (
    <div
      className="rounded-[18px] border p-4 transition hover:brightness-110"
      style={{
        background: "var(--theme-card, rgba(15,25,45,0.85))",
        borderColor: "var(--theme-border, rgba(245,181,72,0.12))",
      }}
    >
      <div
        className="text-base font-semibold"
        style={{ color: "var(--theme-text-primary, #F0EAD6)" }}
      >
        {item.title}
      </div>
      <div
        className="mt-0.5 text-sm"
        style={{ color: "var(--theme-text-muted, #A0956B)" }}
      >
        {item.category ?? "Collectible"}
      </div>
      {item.targetPrice && (
        <div className="mt-2 text-sm font-semibold" style={{ color: "#52D6F4" }}>
          Target: {item.targetPrice}
        </div>
      )}
    </div>
  );
}
