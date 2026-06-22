"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchPublicGalleriesForProfile,
  fetchPublicProfile,
  fetchPublicVaultItems,
  type PublicProfile,
} from "@/lib/publicProfile";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { getFollowerCount, isFollowing } from "@/lib/follows";
import { FollowButton } from "@/components/social/FollowButton";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function getActiveProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

function formatMemberSince(createdAt?: string): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return "Member since " + date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatMoney(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function universeLabel(u: string) {
  const key = u.toUpperCase() as UniverseKey;
  return UNIVERSE_LABEL[key] ?? u;
}

// One highlight per universe: prefer an item the collector has explicitly featured
// in some Exhibit, fall back to their highest-value item in that universe.
function buildHighlights(items: VaultItem[], featuredIds: Set<string>): VaultItem[] {
  const byUniverse = new Map<string, VaultItem[]>();
  for (const item of items) {
    const key = String(item.universe || "MISC").toUpperCase();
    const list = byUniverse.get(key) ?? [];
    list.push(item);
    byUniverse.set(key, list);
  }
  const picks: VaultItem[] = [];
  for (const list of byUniverse.values()) {
    const featured = list.find((item) => featuredIds.has(item.id));
    const sorted = [...list].sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));
    const pick = featured ?? sorted[0];
    if (pick) picks.push(pick);
  }
  return picks.sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0)).slice(0, 8);
}

type BioData = {
  profile: PublicProfile;
  totalItems: number;
  totalExhibitions: number;
  totalExhibits: number;
  followerCount: number;
  viewerFollowing: boolean;
  highlights: VaultItem[];
};

export default function CollectorBioModal({
  profileId,
  onClose,
}: {
  profileId: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<BioData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [viewerProfileId, setViewerProfileId] = useState("");

  useEffect(() => {
    setMounted(true);
    setViewerProfileId(getActiveProfileId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const viewer = getActiveProfileId();
        const [profile, galleries, items, followerCount, viewerFollowing] = await Promise.all([
          fetchPublicProfile(profileId),
          fetchPublicGalleriesForProfile(profileId),
          fetchPublicVaultItems(profileId),
          getFollowerCount(profileId),
          viewer ? isFollowing(viewer, profileId) : Promise.resolve(false),
        ]);
        if (cancelled) return;
        if (!profile) {
          setLoadError(true);
          return;
        }
        const totalExhibits = galleries.reduce((sum, g) => sum + (g.exhibitsCount || 0), 0);
        const featuredIds = new Set(galleries.flatMap((g) => g.featuredItemIds || []));
        setData({
          profile,
          totalItems: items.length,
          totalExhibitions: galleries.length,
          totalExhibits,
          followerCount,
          viewerFollowing,
          highlights: buildHighlights(items, featuredIds),
        });
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [profileId]);

  // Scroll lock while open
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const memberSince = data ? formatMemberSince(data.profile.createdAt) : null;

  const overlay = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9100,
        background: "rgba(5,8,14,0.86)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          maxHeight: "85vh",
          overflowY: "auto",
          borderRadius: 24,
          background: "#0E1420",
          border: "1px solid var(--border)",
          padding: 20,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="vltd-selectable bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition"
          style={{ position: "absolute", right: 14, top: 14, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
        >
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 13, height: 13 }}>
            <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {!data ? (
          <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
            {loadError ? "Couldn't load this collector's profile." : "Loading…"}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 6 }}>
              {data.profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.profile.avatarUrl}
                  alt=""
                  style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border)" }}
                />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, background: "var(--pill)", border: "1px solid var(--border)" }}>
                  {data.profile.avatarEmoji}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700, color: "var(--fg)" }}>
                {data.profile.displayName}
              </div>
              {memberSince && (
                <div style={{ marginTop: 2, fontSize: 11, color: "var(--muted)" }}>{memberSince}</div>
              )}
              {data.profile.bio && (
                <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5, color: "var(--muted)", maxWidth: 380 }}>
                  {data.profile.bio}
                </div>
              )}
              {viewerProfileId !== data.profile.profileId && (
                <div style={{ marginTop: 12 }}>
                  <FollowButton
                    viewerProfileId={viewerProfileId}
                    targetProfileId={data.profile.profileId}
                    initialFollowing={data.viewerFollowing}
                  />
                </div>
              )}
            </div>

            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { label: "Items", value: data.totalItems },
                { label: "Exhibitions", value: data.totalExhibitions },
                { label: "Exhibits", value: data.totalExhibits },
                { label: "Followers", value: data.followerCount },
              ].map(({ label, value }) => (
                <div key={label} style={{ borderRadius: 14, background: "var(--pill)", border: "1px solid var(--border)", padding: "10px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--fg)" }}>{value}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {data.highlights.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                  Highlights across their collection
                </div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                  {data.highlights.map((item) => {
                    const img = getPrimaryImageUrl(item);
                    return (
                      <div
                        key={item.id}
                        style={{
                          flexShrink: 0,
                          width: 96,
                          borderRadius: 12,
                          overflow: "hidden",
                          background: "var(--pill)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ position: "relative", aspectRatio: "3 / 4", background: "var(--surface)" }}>
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} draggable={false} />
                          ) : null}
                        </div>
                        <div style={{ padding: "5px 6px" }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: "var(--fg)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, lineHeight: 1.2 }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {universeLabel(String(item.universe || "Misc"))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Link
              href={`/v/${data.profile.profileId}`}
              className="vltd-pill-main-glow bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] transition"
              style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, padding: "11px 0", fontSize: 13, fontWeight: 700 }}
            >
              View Full Vault
            </Link>
          </>
        )}
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
