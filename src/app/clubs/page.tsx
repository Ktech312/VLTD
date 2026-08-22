"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PillButton } from "@/components/ui/PillButton";
import { getStoredActiveProfileId } from "@/lib/auth";
import { listClubs, createClub, type Club } from "@/lib/clubs";

export default function ClubsPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [profileId, setProfileId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setProfileId(getStoredActiveProfileId());
    void listClubs().then(setClubs);
  }, []);

  async function handleCreate() {
    if (!name.trim() || !profileId) return;
    setCreating(true);
    setError("");
    try {
      const club = await createClub(name, description);
      if (!club) {
        setError("Couldn't create the club — try again.");
        return;
      }
      router.push(`/clubs/${club.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PageHeader title="Clubs" description="Real collector clubs and discussion boards." contentClassName="max-w-[900px]" />
      <main className="mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--muted)]">
            Join a club to post; anyone can browse and read.
          </p>
          {profileId ? (
            <PillButton onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Cancel" : "Create a Club"}</PillButton>
          ) : null}
        </div>

        {showCreate ? (
          <div className="mt-4 rounded-[14px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Vintage Vinyl Collectors"
              className="mt-1 h-11 w-full rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
            <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="What's this club about?"
              className="mt-1 w-full rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
              style={{ minHeight: 72 }}
            />
            {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
            <div className="mt-3 flex justify-end">
              <PillButton onClick={() => void handleCreate()} disabled={creating || !name.trim()} variant="active">
                {creating ? "Creating…" : "Create"}
              </PillButton>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {clubs === null ? (
            <p className="text-sm text-[color:var(--muted2)]">Loading…</p>
          ) : clubs.length === 0 ? (
            <p className="text-sm text-[color:var(--muted2)]">No clubs yet — be the first to create one.</p>
          ) : (
            clubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubs/${club.id}`}
                className="flex items-center justify-between gap-3 rounded-[14px] bg-[color:var(--surface)] px-4 py-3 ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{club.name}</div>
                  {club.description ? (
                    <div className="mt-0.5 truncate text-xs text-[color:var(--muted)]">{club.description}</div>
                  ) : null}
                </div>
                <div className="shrink-0 text-xs text-[color:var(--muted2)]">
                  {club.memberCount} member{club.memberCount === 1 ? "" : "s"}
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </>
  );
}
