export default function NotableBadge({ reason }: { reason?: string }) {
  return (
    <span
      title={reason ?? "Notable item"}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ring-1"
      style={{
        background: "var(--theme-gold-subtle)",
        borderColor: "var(--theme-gold-border)",
        color: "var(--theme-gold)",
      }}
    >
      Key
    </span>
  );
}
