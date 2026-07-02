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
  const grade = row.grade ? ` · ${String(row.grade)}` : "";
  const imageUrl = buildImageUrl(row);
  const description = row.notes
    ? String(row.notes).slice(0, 150)
    : `A collectible from my vault on VLTD.`;

  return {
    title: `${title}${grade} · VLTD`,
    description,
    openGraph: {
      title: `${title}${grade}`,
      description,
      images: imageUrl
        ? [{ url: imageUrl, width: 1200, height: 1200, alt: title }]
        : [],
      type: "website",
      siteName: "VLTD",
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: `${title}${grade}`,
      description,
      images: imageUrl ? [imageUrl] : [],
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
  const grade = row.grade ? String(row.grade) : null;
  const imageUrl = buildImageUrl(row);
  const universe = row.universe
    ? String(row.universe).replace(/_/g, " ")
    : null;

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
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
