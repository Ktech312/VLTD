import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// Signed-in app areas hold no public content; keep them out of search results.
const PRIVATE_PATHS = [
  "/api/",
  "/admin/",
  "/dashboard",
  "/vault",
  "/account",
  "/messages",
  "/notifications",
  "/portfolio",
  "/insurance",
  "/reports",
  "/sales",
  "/saved",
  "/favorites",
  "/goals",
  "/watchlist",
  "/onboarding",
  "/owner-lab",
  "/studio",
  "/capture",
  "/ingest",
  "/forge",
  "/redeem",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
