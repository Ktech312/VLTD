"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { getCurrentUser, listMyProfiles } from "@/lib/auth";
import { getPlaceholderDrafts } from "@/lib/aiCatalogDrafts";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

type ProfileRow = { id: string; display_name: string; username: string; profile_type: "personal" | "business" };

function readActiveProfileId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
}

export default function AIDraftsPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");

  useEffect(() => {
    async function load() {
      await getCurrentUser();
      const { data } = await listMyProfiles();
      const rows = (data ?? []) as ProfileRow[];
      setProfiles(rows);
      setActiveProfileId(readActiveProfileId() || rows[0]?.id || "");
    }
    load();
  }, []);

  const drafts = useMemo(() => getPlaceholderDrafts(activeProfileId || "default"), [activeProfileId]);
  const workspace = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/account"><PillButton>Account Center</PillButton></Link>
          <Link href="/ai/drafts"><PillButton variant="active">AI Draft Queue</PillButton></Link>
          <Link href="/ai/review"><PillButton>AI Review Queue</PillButton></Link>
        </div>
        <section className="vltd-panel-main rounded-[30px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">AI CATALOGING ASSISTANT</div>
          <h1 className="mt-3 text-3xl font-semibold">Draft queue</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">This placeholder queue previews where camera scans, slab label reads, and barcode-assisted matches will land before a draft becomes a real vault item.</p>
          {workspace ? <div className="mt-4 rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)] inline-flex">Workspace: {workspace.display_name}</div> : null}
        </section>
        <div className="mt-8 grid gap-4">
          {drafts.map((draft) => (
            <div key={draft.id} className="vltd-panel-soft rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-[color:var(--fg)]">{draft.title}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">{draft.subtitle}</div>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]">{draft.status}</span>
                  <span className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]">{draft.confidenceLabel}</span>
                </div>
              </div>
              <div className="mt-3 text-sm text-[color:var(--muted)]">Missing: {draft.missingFields.join(", ")}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
