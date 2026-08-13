"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import ReliefForgeClient from "@/components/owner-lab/ReliefForgeClient";
import { getCurrentUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/ownerAccess";

type AccessState = "checking" | "allowed" | "blocked";

export default function OwnerForgePage() {
  const [access, setAccess] = useState<AccessState>("checking");

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      const userResult = await getCurrentUser();
      const allowed = isOwnerEmail(userResult.data.user?.email);
      if (!active) return;
      setAccess(allowed ? "allowed" : "blocked");
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, []);

  if (access !== "allowed") {
    return (
      <main className="min-h-dvh bg-[#101216] px-4 py-10 text-[#ECEDEF]">
        <div className="mx-auto w-full max-w-md rounded-[8px] border border-white/10 bg-[#1c1f24] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/40">Owner Lab</p>
          <h1 className="mt-2 text-2xl font-black">Forge is locked</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {access === "checking"
              ? "Checking owner access..."
              : "This experimental workspace is limited to the VLTD owner account."}
          </p>
          <Link className="mt-5 inline-flex text-sm font-bold text-white/60 underline underline-offset-4" href="/login?next=%2Fowner-lab%2Fforge">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return <ReliefForgeClient />;
}
