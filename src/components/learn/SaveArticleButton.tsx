"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
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
        borderColor: saved ? "var(--theme-gold,#C8CDD2)" : "var(--border)",
        color: saved ? "var(--theme-gold,#C8CDD2)" : "var(--muted)",
        background: saved ? "rgba(203,208,213,0.08)" : "transparent",
        opacity: hydrated ? 1 : 0.6,
      }}
    >
      <AppIcon name="favorite" size={15} strokeWidth={1.8} filled={saved} />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
