import { createSavedContentStore } from "@/lib/savedContentSync";

const store = createSavedContentStore("vltd_saved_articles", "saved_articles", "slug", true);
export const loadSavedArticles = store.load;
export const toggleSavedArticle = store.toggle;
export const syncSavedArticlesFromSupabase = store.sync;
export const pendingSavedArticleChanges = store.pendingCount;
export function isArticleSaved(slug: string): boolean { return store.load().includes(slug); }
