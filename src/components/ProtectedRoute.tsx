// FIXED ProtectedRoute with public route whitelist

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

    const isPublicRoute =
      pathname?.startsWith("/museum/share") ||
      pathname?.startsWith("/museum/guest");

    if (isPublicRoute) {
      setAllowed(true);
      setLoading(false);
      return;
    }

    async function checkAccess() {
      try {
        const status = await getOnboardingStatus();

        if (!active || requestId !== requestIdRef.current) return;

        if (!status.isAuthenticated) {
          setAllowed(false);
          setLoading(false);
          router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
          return;
        }

        if (status.needsOnboarding) {
          setAllowed(false);
          setLoading(false);
          router.replace("/onboarding");
          return;
        }

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

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white">
        Checking access...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center text-red-400">
        {error}
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white">
        Redirecting...
      </main>
    );
  }

  return <>{children}</>;
}
