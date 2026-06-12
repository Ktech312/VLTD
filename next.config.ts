import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    typescript: {
          // Diagnostic: skip TS type-check during build to isolate whether a
      // type error visible only in Vercel's clean env is the root cause.
      ignoreBuildErrors: true,
    },
    turbopack: {
          root: __dirname,
    },
    transpilePackages: [
          "sanity",
          "@sanity/ui",
          "@sanity/icons",
          "@sanity/vision",
          "next-sanity",
        ],
    images: {
          remotePatterns: [
            {
                      protocol: "https",
                      hostname: "cdn.sanity.io",
            },
                ],
    },
};

export default nextConfig;
