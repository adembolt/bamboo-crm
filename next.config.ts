import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dinamik, veritabanına bağlı bir yönetim paneli: her istek taze veri.
  // Cache Components kapalı tutuluyor; gerektiğinde tek tek açılır.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
