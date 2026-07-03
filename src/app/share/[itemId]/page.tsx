import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Service role key bypasses RLS — server-only, never sent to browser
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const VAULT_IMAGES_BUCKET = "vault-images";
const VAULT_ITEMS_TABLE = "vault_items";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function getServerSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function buildImageUrl(row: Row): string {
  // images_json array takes priority (the gallery)
  if (Array.isArray(row.images_json) && row.images_json.length > 0) {
    const first = row.images_json[0] as Row;
    const key = String(first?.storageKey ?? "").trim();
    if (key && !key.startsWith("http") && !key.startsWith("blob:") && !key.startsWith("data:")) {
      return `${SUPABASE_URL}/storage/v1/object/public/${VAULT_IMAGES_BUCKET}/${key}`;
    }
    const url = String(first?.url ?? "").trim();
    if (url.startsWith("http")) return url;
  }
  // Fall back to primary_image_key / image_front_storage_path (storage paths)
  const primaryKey = String(row.primary_image_key ?? row.image_front_storage_path ?? "").trim();
  if (primaryKey && !primaryKey.startsWith("http") && !primaryKey.startsWith("blob:") && !primaryKey.startsWith("data:")) {
    return `${SUPABASE_URL}/storage/v1/object/public/${VAULT_IMAGES_BUCKET}/${primaryKey}`;
  }
  // Lastly, a bare URL stored in image_front_url
  const frontUrl = String(row.image_front_url ?? "").trim();
  if (frontUrl.startsWith("http")) return frontUrl;
  return "";
}

function buildOgUrl(title: string, gradeRaw: string, description: string, imageUrl: string): string {
  return `https://vltd.vercel.app/api/og?v=3&title=${encodeURIComponent(title)}&grade=${encodeURIComponent(gradeRaw)}&description=${encodeURIComponent(description)}&imageUrl=${encodeURIComponent(imageUrl)}`;
}

async function fetchItem(itemId: string): Promise<Row | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(VAULT_ITEMS_TABLE)
    // Never expose price/value — only identity fields safe to share publicly
    .select("id, title, grade, universe, image_front_url, image_front_storage_path, primary_image_key, images_json, notes")
    .eq("id", itemId)
    .single();

  if (error || !data) return null;
  return data as Row;
}

type Params = { itemId: string };

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { itemId } = await params;
  const row = await fetchItem(itemId);

  if (!row) {
    return {
      title: "Item · VLTD",
      description: "View this collectible on VLTD.",
    };
  }

  const title = String(row.title ?? "Collectible");
  const gradeRaw = row.grade ? String(row.grade) : "";
  const grade = gradeRaw ? ` · ${gradeRaw}` : "";
  const imageUrl = buildImageUrl(row);
  const description = row.notes
    ? String(row.notes).slice(0, 150)
    : `A collectible from my vault on VLTD.`;

  const ogImageUrl = buildOgUrl(title, gradeRaw, description, imageUrl);

  return {
    title: `${title}${grade} · VLTD`,
    description,
    alternates: {
      canonical: `https://vltd.vercel.app/share/${itemId}`,
    },
    openGraph: {
      url: `https://vltd.vercel.app/share/${itemId}`,
      title: `${title}${grade}`,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      type: "website",
      siteName: "VLTD",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title}${grade}`,
      description,
      images: [ogImageUrl],
      site: "@vltdapp",
    },
  };
}

export default async function ShareItemPage(
  { params }: { params: Promise<Params> }
) {
  const { itemId } = await params;
  const row = await fetchItem(itemId);

  if (!row) notFound();

  const title = String(row.title ?? "");
  const gradeRaw = row.grade ? String(row.grade) : "";
  const grade = gradeRaw || null;
  const imageUrl = buildImageUrl(row);
  const universe = row.universe
    ? String(row.universe).replace(/_/g, " ")
    : null;
  const description = row.notes
    ? String(row.notes).slice(0, 150)
    : `A collectible from my vault on VLTD.`;
  const ogImageUrl = buildOgUrl(title, gradeRaw, description, imageUrl);
  const downloadName = `vltd-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.jpg`;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0d0d0d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        fontFamily: "-apple-system, BlinkMacSystemFont, \'Segoe UI\', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <span
            style={{
              color: "#F5B548",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.28em",
            }}
          >
            VLTD
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#161616",
            borderRadius: 20,
            overflow: "hidden",
            border: "1px solid #252525",
          }}
        >
          {/* Photo */}
          {imageUrl ? (
            <div
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                background: "#111",
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                aspectRatio: "1 / 1",
                background: "#1a1a1a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#333",
                fontSize: 48,
              }}
            >
              📦
            </div>
          )}

          {/* Info */}
          <div style={{ padding: "1.25rem" }}>
            {grade && (
              <span
                style={{
                  display: "inline-block",
                  background: "rgba(245,181,72,0.12)",
                  color: "#F5B548",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  padding: "3px 10px",
                  borderRadius: 100,
                  marginBottom: 10,
                  border: "1px solid rgba(245,181,72,0.28)",
                }}
              >
                {grade}
              </span>
            )}

            <h1
              style={{
                color: "#f0f0f0",
                fontSize: 20,
                fontWeight: 600,
                margin: "0 0 4px",
                lineHeight: 1.3,
              }}
            >
              {title}
            </h1>

            {universe && (
              <p
                style={{
                  color: "#555",
                  fontSize: 13,
                  margin: "0 0 1rem",
                  textTransform: "capitalize",
                }}
              >
                {universe}
              </p>
            )}

            <Link
              href="/"
              style={{
                display: "block",
                background: "#F5B548",
                color: "#000",
                textAlign: "center",
                padding: "12px",
                borderRadius: 12,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
                marginTop: grade || universe ? 4 : 16,
                letterSpacing: "0.02em",
              }}
            >
              Open VLTD
            </Link>
          </div>
        </div>

        {/* Download Card — gold frame image + save button */}
        <div style={{ marginTop: "1.25rem" }}>
          {/* Preview of the branded OG card */}
          <a
            href={ogImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", marginBottom: "0.75rem" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ogImageUrl}
              alt={`${title} — VLTD card`}
              width={1200}
              height={630}
              style={{
                width: "100%",
                height: "auto",
                borderRadius: 12,
                display: "block",
                border: "1px solid rgba(245,181,72,0.25)",
              }}
            />
          </a>

          {/* Download / Save button */}
          <a
            href={ogImageUrl}
            download={downloadName}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              background: "rgba(245,181,72,0.08)",
              color: "#F5B548",
              border: "1px solid rgba(245,181,72,0.35)",
              textAlign: "center",
              padding: "12px",
              borderRadius: 12,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Save Card
          </a>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "#3a3a3a",
            fontSize: 11,
            marginTop: "1rem",
            letterSpacing: "0.02em",
          }}
        >
          Shared from a personal vault on VLTD
        </p>
      </div>
    </main>
  );
}
