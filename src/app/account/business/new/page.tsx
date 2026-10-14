"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { nativeSelectClass } from "@/components/ui/nativeSelect";
import { PillButton } from "@/components/ui/PillButton";
import { createProfile, setStoredActiveProfileId } from "@/lib/auth";

function slugifyUsername(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
}

export default function NewBusinessProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [businessType, setBusinessType] = useState("dealer");
  const [website, setWebsite] = useState("");
  const [taxId, setTaxId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valid = useMemo(() => name.trim().length >= 2 && slugifyUsername(username).length >= 3, [name, username]);

  async function handleCreate() {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const profile = await createProfile({
        username: slugifyUsername(username),
        display_name: name.trim(),
        profile_type: "business",
        avatar_url: "__preset:vault",
        business_type: businessType,
        website,
        tax_id: taxId,
      });
      setStoredActiveProfileId(profile.id);
      router.replace("/account?section=profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the business profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="pb-10 text-[color:var(--fg)]">
      <section className="rounded-[18px] border border-[color:var(--border)] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)] sm:p-7" style={{ background: "var(--theme-elevated)" }}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted2)]">Profiles</div>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-text-primary">Add a business profile</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
          Your personal profile stays separate. This creates another profile for a shop, dealer, brand, estate, or team.
        </p>
        {error ? <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-text-primary">Business name</span>
            <input value={name} onChange={(event) => { const next = event.target.value; setName(next); if (!username.trim()) setUsername(slugifyUsername(next)); }} placeholder="Business name" className={`mt-2 w-full ${nativeSelectClass}`} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-text-primary">Business handle</span>
            <input value={username} onChange={(event) => setUsername(slugifyUsername(event.target.value))} placeholder="business_handle" className={`mt-2 w-full ${nativeSelectClass}`} />
            <span className="mt-1.5 block text-xs text-[color:var(--muted2)]">vltd.app/@{slugifyUsername(username) || "business_handle"}</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-text-primary">Business type</span>
            <select value={businessType} onChange={(event) => setBusinessType(event.target.value)} className={`mt-2 w-full ${nativeSelectClass}`}>
              <option value="dealer">Dealer</option><option value="gallery">Gallery</option><option value="brand">Brand</option><option value="estate">Estate</option><option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-text-primary">Website (optional)</span>
            <input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://…" className={`mt-2 w-full ${nativeSelectClass}`} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-text-primary">EIN / Tax ID (optional, private)</span>
            <input value={taxId} onChange={(event) => setTaxId(event.target.value)} placeholder="XX-XXXXXXX" className={`mt-2 w-full ${nativeSelectClass}`} />
          </label>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <PillButton variant="active" disabled={!valid || saving} onClick={() => void handleCreate()} className="font-black">
            {saving ? "Creating…" : "Create business profile"}
          </PillButton>
          <Link href="/account" className="inline-flex h-11 items-center rounded-[8px] px-4 text-sm font-semibold ring-1 ring-[color:var(--border)]">Cancel</Link>
        </div>
      </section>
    </main>
  );
}
