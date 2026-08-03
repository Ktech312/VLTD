import type { NextConfig } from "next";

const nextConfig: NextConfig = {
      async redirects() {
        return [
          {
            source: "/wishlist",
            destination: "/watchlist",
            permanent: true,
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
