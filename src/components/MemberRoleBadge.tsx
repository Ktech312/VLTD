
"use client";

export default function MemberRoleBadge({ role }: { role: string }) {
  return (
    <span className="rounded-full px-3 py-1 text-xs ring-1 ring-white/20">
      {role}
    </span>
  );
}
