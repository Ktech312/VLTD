"use client";

import { useRef, useState } from "react";
import {
  isVideoEnabled,
  uploadVideoClip,
  deleteVideoClip,
  getVideoDuration,
  validateVideoFile,
  VIDEO_MAX_DURATION,
  VIDEO_MAX_MB,
  type VideoClip,
} from "@/lib/videoFeature";
import type { VaultItem } from "@/lib/vaultModel";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  item: VaultItem;
  /** Current user email — used for beta-tester gate */
  userEmail: string | null;
  /** Called when video is saved or deleted — parent should persist the change */
  onSave: (clip: VideoClip | null) => void;
};

// ─── VideoClipSection ─────────────────────────────────────────────────────────

export default function VideoClipSection({ item, userEmail, onSave }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Gate ────────────────────────────────────────────────────────────────────
  if (!isVideoEnabled(userEmail)) return null;

  const existing = item.videoClip ?? null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleFileSelected(file: File) {
    setUploadError("");

    const duration = await getVideoDuration(file);
    const validationError = validateVideoFile(file, duration);
    if (validationError) {
      setUploadError(validationError.message);
      return;
    }

    setUploading(true);
    try {
      const clip = await uploadVideoClip({
        file,
        profileId: item.profile_id ?? "local",
        itemId: item.id,
        durationSeconds: duration,
      });
      onSave(clip);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!existing?.url) return;
    setDeleting(true);
    setUploadError("");
    try {
      await deleteVideoClip(existing.url);
      onSave(null);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mt-4">
      {/* Beta badge */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--muted)" }}
        >
          Video Clip
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{
            background: "rgba(245,197,42,0.15)",
            color: "var(--theme-gold)",
            border: "1px solid rgba(245,197,42,0.3)",
          }}
        >
          Beta
        </span>
      </div>

      {/* ── Has video: player + delete ── */}
      {existing?.url ? (
        <div className="rounded-2xl overflow-hidden ring-1" style={{ borderColor: "var(--border)" }}>
          <video
            src={existing.url}
            muted
            autoPlay
            loop
            playsInline
            controls
            className="w-full block"
            style={{ maxHeight: 300, background: "#000", display: "block" }}
          />
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5"
            style={{ background: "var(--pill)" }}
          >
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
              {Math.round(existing.durationSeconds)}s clip · beta tester only
            </span>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition hover:opacity-70"
              style={{
                background: "transparent",
                color: "#f87171",
                borderColor: "rgba(248,113,113,0.4)",
                opacity: deleting ? 0.5 : 1,
              }}
            >
              {deleting ? "Removing…" : "Remove clip"}
            </button>
          </div>
        </div>
      ) : (
        /* ── No video: upload prompt ── */
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 transition w-full justify-center"
            style={{
              background: uploading ? "var(--pill)" : "transparent",
              color: uploading ? "var(--muted)" : "var(--fg)",
              borderColor: "var(--border)",
              cursor: uploading ? "default" : "pointer",
            }}
          >
            {uploading ? (
              <>
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: "var(--theme-gold)", borderTopColor: "transparent" }}
                />
                <span>Uploading…</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 16 }}>▶</span>
                <span>Add video clip</span>
              </>
            )}
          </button>

          <p className="mt-1.5 text-center text-[11px]" style={{ color: "var(--muted)" }}>
            Max {VIDEO_MAX_DURATION}s · {VIDEO_MAX_MB} MB · MP4 or MOV
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
              // Reset so same file can be reselected if user retries
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <p className="mt-2 text-[11px] font-medium" style={{ color: "#f87171" }}>
          {uploadError}
        </p>
      )}
    </div>
  );
}
