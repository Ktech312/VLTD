"use client";

import { useEffect, useState } from "react";
import { isArticleSaved, toggleSavedArticle, syncSavedArticlesFromSupabase } from "@/lib/savedArticles";

// Standalone save toggle (used on the article reader). The hub manages its own
// shared saved-state, so it doesn't use this.
export default function SaveArticleButton({ slug }: { slug: string }) {
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSaved(isArticleSaved(slug));
    setHydrated(true);
    void syncSavedArticlesFromSupabase().then(() => setSaved(isArticleSaved(slug)));
  }, [slug]);

  return (
    <button
      type="button"
      onClick={() => setSaved(toggleSavedArticle(slug).includes(slug))}
      aria-pressed={saved}
      className="inline-flex items-center gap-1.5 rounded-[6px] border px-3.5 py-1.5 text-sm font-semibold transition"
      style={{
        borderColor: saved ? "var(--theme-gold,#F5B548)" : "var(--border)",
        color: saved ? "var(--theme-gold,#F5B548)" : "var(--muted)",
        background: saved ? "rgba(245,181,72,0.08)" : "transparent",
        opacity: hydrated ? 1 : 0.6,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
