"use client";

// Shows its children only to a signed-in admin whose session has completed the second factor (the same rule every other admin page
// applies through getMyAdminAccessStatus). Everyone else sees a plain message and none of the page's data or controls, and the
// children (which fetch the page's data) are not even mounted.
import { useEffect, useState, type ReactNode } from "react";
import { getMyAdminAccessStatus, type AdminRole } from "@/lib/adminAuth";
import MfaStepUp from "@/components/account/MfaStepUp";

export default function AdminGate({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AdminRole | "loading">("loading");
  const [mfaOk, setMfaOk] = useState(false);

  useEffect(() => {
    void (async () => {
      const { role: myRole, mfaOk: ok } = await getMyAdminAccessStatus();
      setRole(myRole);
      setMfaOk(ok);
    })();
  }, []);

  if (role === "loading") {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-3xl text-[color:var(--muted)]">Checking access…</div>
      </main>
    );
  }
  if (!role) {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div role="alert" data-testid="admin-no-access" className="mx-auto max-w-3xl rounded-2xl border border-[color:var(--border)] bg-vault-card p-6 text-[color:var(--muted)]">
          You don&apos;t have access to this page.
        </div>
      </main>
    );
  }
  if (!mfaOk) {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <MfaStepUp onVerified={() => setMfaOk(true)} />
      </main>
    );
  }
  return <>{children}</>;
}
