"use client";

import { useEffect, useState } from "react";
import { listComments, addComment, hideComment, type Comment } from "@/lib/comments";
import { fetchPublicProfile } from "@/lib/publicProfile";

type AuthorInfo = { displayName: string; avatarEmoji: string; avatarUrl?: string };

function formatRelativeTime(timestamp: number) {
  if (!timestamp) return "";
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Public comment thread for an Exhibition. Anyone signed in can post.
 * Moderation is a plain checkbox (not a button) next to a comment, visible
 * only to that comment's own author or the exhibition's owner - checking it
 * hides the comment immediately (one-way; matches the hide_comment() RPC,
 * there's no unhide).
 */
export function CommentThread({
  exhibitionId,
  ownerProfileId,
  viewerProfileId,
}: {
  exhibitionId: string;
  ownerProfileId?: string;
  viewerProfileId: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [authors, setAuthors] = useState<Map<string, AuthorInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const list = await listComments(exhibitionId);
      if (cancelled) return;
      setComments(list);
      setLoading(false);

      const uniqueAuthorIds = [...new Set(list.map((c) => c.authorId))];
      const profiles = await Promise.all(uniqueAuthorIds.map((id) => fetchPublicProfile(id)));
      if (cancelled) return;
      const map = new Map<string, AuthorInfo>();
      uniqueAuthorIds.forEach((id, i) => {
        const p = profiles[i];
        map.set(id, {
          displayName: p?.displayName ?? "Collector",
          avatarEmoji: p?.avatarEmoji ?? "🗝️",
          avatarUrl: p?.avatarUrl,
        });
      });
      setAuthors(map);
    })();
    return () => { cancelled = true; };
  }, [exhibitionId]);

  async function handlePost() {
    const trimmed = body.trim();
    if (!trimmed || !viewerProfileId || posting) return;
    setPosting(true);
    try {
      const created = await addComment(exhibitionId, viewerProfileId, trimmed);
      if (created) {
        setComments((prev) => [...prev, created]);
        if (!authors.has(viewerProfileId)) {
          const p = await fetchPublicProfile(viewerProfileId);
          setAuthors((prev) => new Map(prev).set(viewerProfileId, {
            displayName: p?.displayName ?? "Collector",
            avatarEmoji: p?.avatarEmoji ?? "🗝️",
            avatarUrl: p?.avatarUrl,
          }));
        }
        setBody("");
      }
    } finally {
      setPosting(false);
    }
  }

  async function handleHide(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    await hideComment(commentId);
  }

  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
        Comments {comments.length > 0 ? `(${comments.length})` : ""}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Loading comments…</div>
      ) : comments.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>No comments yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {comments.map((c) => {
            const author = authors.get(c.authorId);
            const canModerate = viewerProfileId && (c.authorId === viewerProfileId || ownerProfileId === viewerProfileId);
            return (
              <div key={c.id} id={`comment-${c.id}`} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, background: "var(--pill)", overflow: "hidden" }}>
                  {author?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={author.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    author?.avatarEmoji ?? "🗝️"
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)" }}>{author?.displayName ?? "Collector"}</span>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>{formatRelativeTime(c.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--fg)", marginTop: 2, wordBreak: "break-word" }}>
                    {c.body}
                  </div>
                </div>
                {canModerate && (
                  <label style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--muted)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      onChange={() => handleHide(c.id)}
                      style={{ width: 14, height: 14, cursor: "pointer" }}
                    />
                    Hide
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewerProfileId ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => { if (e.key === "Enter") handlePost(); }}
            placeholder="Add a comment…"
            className="bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] placeholder:text-[color:var(--muted)]"
            style={{ flex: 1, borderRadius: 999, padding: "9px 14px", fontSize: 13, outline: "none", border: "none" }}
          />
          <button
            type="button"
            onClick={handlePost}
            disabled={!body.trim() || posting}
            className="vltd-pill-main-glow"
            style={{
              background: "var(--pill-active-bg)",
              border: "none",
              borderRadius: 999,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: !body.trim() || posting ? "default" : "pointer",
              opacity: !body.trim() || posting ? 0.5 : 1,
            }}
          >
            Post
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "var(--muted)" }}>Sign in to leave a comment.</div>
      )}
    </div>
  );
}
