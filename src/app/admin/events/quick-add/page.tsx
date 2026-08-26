"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";
import QuickAddEventForm from "@/components/admin/QuickAddEventForm";

// This has to stay a real page, not just the modal on /admin/events -- it's
// the bookmarklet's window.open target, opened from an external site with
// no VLTD page already loaded to put a modal inside of.
function QuickAddPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [role, setRole] = useState<AdminRole | "loading">("loading");

  useEffect(() => {
    void (async () => setRole(await getMyAdminRole()))();
  }, []);

  if (role === "loading") {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-lg text-[color:var(--muted)]">Checking access…</div>
      </main>
    );
  }

  if (!role) {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-lg rounded-2xl border border-[color:var(--border)] bg-vault-card p-6 text-[color:var(--muted)]">
          You don&apos;t have access to this page.
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-black tracking-[-0.03em]">Quick Add Event</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          The manual fallback — found something by hand, add it straight to the Events page.
        </p>
        <div className="mt-6">
          <QuickAddEventForm
            initialName={params.get("name") ?? ""}
            initialLink={params.get("link") ?? ""}
            initialDesc={params.get("desc") ?? ""}
            initialImage={params.get("image") ?? ""}
            onSaved={(slug) => router.push(`/events?highlight=${encodeURIComponent(slug)}`)}
          />
        </div>
      </div>
    </main>
  );
}

export default function AdminEventsQuickAddPage() {
  return (
    <Suspense fallback={null}>
      <QuickAddPageContent />
    </Suspense>
  );
}
