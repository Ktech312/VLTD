import type { MetadataRoute } from "next";
import { LEARN_ARTICLES } from "@/lib/learnContent";
import { SITE_URL } from "@/lib/siteUrl";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only intentionally public editorial pages; never enumerate private vaults
  // or invite/share tokens from account data.
  return ["/", "/learn", ...LEARN_ARTICLES.map((article) => `/learn/${article.slug}`)]
    .map((path) => ({ url: new URL(path, SITE_URL).href }));
}
