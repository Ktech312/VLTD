"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getOnboardingStatus, initAuthListener } from "@/lib/auth";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState("");

  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    const requestId = ++requestIdRef.current;

    initAuthListener();
    setLoading(true);
    setError("");

    async function checkAccess() {
      try {
        const status = await getOnboardingStatus();

        if (!active || requestId !== requestIdRef.current) return;

        // NOT LOGGED IN
        if (!status.isAuthenticated) {
          setAllowed(false);
          setLoading(false);

          router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
          return;
        }

        // NEEDS ONBOARDING
        if (status.needsOnboarding) {
          setAllowed(false);
          setLoading(false);

          router.replace("/onboarding");
          return;
        }

        // GOOD TO GO
        setAllowed(true);
        setLoading(false);
      } catch (err) {
        if (!active || requestId !== requestIdRef.current) return;

        setAllowed(false);
        setLoading(false);
        setError(err instanceof Error ? err.message : "Auth check failed.");
      }
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  // LOADING STATE
  if (loading) {
    return (
      <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-5xl rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] text-center">
          Checking access...
        </div>
      </main>
    );
  }

  // ERROR STATE
  if (error) {
    return (
      <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-5xl rounded-[24px] border border-red-500/40 bg-red-500/10 p-6 text-red-200 text-center">
          {error}
        </div>
      </main>
    );
  }

  // BLOCKED STATE (prevents blank screen)
  if (!allowed) {
    return (
      <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-5xl rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] text-center">
          Redirecting...
        </div>
      </main>
    );
  }

  return <>{children}</>;
}