import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Validate env at module-load via lib/env, but allow the build itself to run
  // without secrets by honoring SKIP_ENV_VALIDATION (set during `next build`
  // in CI where runtime secrets are intentionally absent).
  eslint: {
    // Lint is run as a dedicated CI step; don't fail the build on it twice.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
