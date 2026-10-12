import type { NextConfig } from "next";

const nextConfig: NextConfig = {
      // The commit this build was made from (set by Vercel), so a deployment can be matched to its commit.
      env: {
              NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
      },
      async redirects() {
        return [
          {
            source: "/wishlist",
            destination: "/watchlist",
            permanent: true,
          },
          // The old Command Center is gone; everything in it now lives in Home, Vault, Settings and Help.
          {
            source: "/more",
            destination: "/dashboard",
            permanent: false,
          },
        ];
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
