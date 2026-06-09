/**
 * videoFeature.ts — Video clip upload, delete, and tester gate.
 *
 * Gated to BETA_TESTER_EMAILS for now.
 * Swap the gate for a plan check (profile.plan === "pro") when ready to release.
 *
 * Supabase setup required before this works:
 *   1. Run supabase/migrations/add_video_clip.sql in the Supabase SQL editor
 *   2. Create a "vault-videos" storage bucket (public) in the Supabase dashboard
 */

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

// ─── Config ───────────────────────────────────────────────────────────────────

export const VIDEO_MAX_DURATION = 15; // seconds
export const VIDEO_MAX_MB = 10; // megabytes
export const VAULT_VIDEOS_BUCKET = "vault-videos";

/** Hardcoded beta tester list. Replace with plan check at launch. */
const BETA_TESTER_EMAILS: string[] = ["eck1679@gmail.com"];

// ─── Gate ─────────────────────────────────────────────────────────────────────

export function isVideoEnabled(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  return BETA_TESTER_EMAILS.includes(userEmail.toLowerCase().trim());
}

// ─── Duration helper (browser-only) ──────────────────────────────────────────

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.src = url;
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type VideoValidationError = { kind: "size" | "duration" | "type"; message: string };

export function validateVideoFile(file: File, duration: number): VideoValidationError | null {
  const maxBytes = VIDEO_MAX_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { kind: "size", message: `Video must be under ${VIDEO_MAX_MB} MB (yours: ${(file.size / 1024 / 1024).toFixed(1)} MB)` };
  }
  if (duration > VIDEO_MAX_DURATION) {
    return { kind: "duration", message: `Video must be ${VIDEO_MAX_DURATION} seconds or less (yours: ${Math.ceil(duration)}s)` };
  }
  if (!file.type.startsWith("video/")) {
    return { kind: "type", message: "File must be a video (MP4, MOV)" };
  }
  return null;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export type VideoClip = {
  url: string;
  durationSeconds: number;
};

export async function uploadVideoClip(params: {
  file: File;
  profileId: string;
  itemId: string;
  durationSeconds: number;
}): Promise<VideoClip> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase not configured.");

  // Always store as .mp4 for widest compatibility, keep original extension otherwise
  const ext = params.file.name.split(".").pop()?.toLowerCase() ?? "mp4";
  const safeExt = ["mp4", "mov", "webm", "m4v"].includes(ext) ? ext : "mp4";
  const path = `${params.profileId}/${params.itemId}.${safeExt}`;

  const { error } = await supabase.storage
    .from(VAULT_VIDEOS_BUCKET)
    .upload(path, params.file, {
      upsert: true,
      contentType: params.file.type || "video/mp4",
    });

  if (error) throw new Error(error.message || "Video upload failed.");

  const { data } = supabase.storage.from(VAULT_VIDEOS_BUCKET).getPublicUrl(path);

  return {
    url: data.publicUrl,
    durationSeconds: Math.round(params.durationSeconds * 10) / 10,
  };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteVideoClip(url: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  // Extract storage path from public URL: everything after "/vault-videos/"
  const match = url.match(/\/vault-videos\/(.+?)(?:\?.*)?$/);
  if (!match?.[1]) return; // Can't determine path — skip silently

  const path = decodeURIComponent(match[1]);

  const { error } = await supabase.storage.from(VAULT_VIDEOS_BUCKET).remove([path]);
  if (error) throw new Error(error.message || "Failed to delete video.");
}
