"use client";

import Link from "next/link";
import { PillButton } from "@/components/ui/PillButton";
import { getRoleDefaults, type WorkspaceRole } from "@/lib/workspaces";

const roles: WorkspaceRole[] = ["OWNER", "ADMIN", "INVENTORY_MANAGER", "VIEWER"];

export default function AccountRolesPage() {
  const labels: Record<WorkspaceRole, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    INVENTORY_MANAGER: "Inventory Manager",
    VIEWER: "Viewer",
  };

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/account"><PillButton>Account Center</PillButton></Link>
          <Link href="/account/team"><PillButton>Team Members</PillButton></Link>
          <Link href="/account/roles"><PillButton variant="active">Roles & Permissions</PillButton></Link>
          <Link href="/account/workspace"><PillButton>Workspace Settings</PillButton></Link>
        </div>

        <section className="vltd-panel-main rounded-[30px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">ROLES & PERMISSIONS</div>
          <h1 className="mt-3 text-3xl font-semibold">Permission shells for business access</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">These role defaults are placeholders for the real permission gate. The key business requirement is already represented: employees can add and view items without seeing portfolio financials unless explicitly allowed.</p>
        </section>

        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          {roles.map((role) => {
            const perm = getRoleDefaults(role);
            return (
              <section key={role} className="vltd-panel-main rounded-[26px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">{labels[role]}</h2>
                  <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]">{role}</span>
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  {Object.entries(perm).map(([key, value]) => (
                    <div key={key} className="vltd-panel-soft flex items-center justify-between rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)]">
                      <span className="text-[color:var(--fg)]">{key}</span>
                      <span className="text-[color:var(--muted)]">{value ? "Allowed" : "Hidden"}</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
