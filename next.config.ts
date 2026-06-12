import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // eslint-config-next 16 ships react-hooks v5 with new strict rules
    // that flag pre-existing patterns across the codebase.
    // ESLint is run separately in CI; skip it during `next build`.
    ignoreDuringBuilds: true,
  },
  turbopack: {
    root: __dirname,
  },
  transpilePackages: [
    "sa