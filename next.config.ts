import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // README and local demos use 127.0.0.1; without this, Next 16 blocks
  // cross-origin client hydration/HMR and the unlock form never attaches.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
