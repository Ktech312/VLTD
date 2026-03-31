
"use client";

import MemberRoleBadge from "./MemberRoleBadge";

export default function WorkspaceMembersPanel() {
  const members = [
    { name: "You", role: "OWNER" },
    { name: "Employee 1", role: "MEMBER" },
  ];

  return (
    <div className="rounded-xl p-4 ring-1 ring-white/10">
      <div className="font-semibold mb-3">Workspace Members</div>
      {members.map((m) => (
        <div key={m.name} className="flex justify-between py-1">
          <span>{m.name}</span>
          <MemberRoleBadge role={m.role} />
        </div>
      ))}
    </div>
  );
}
