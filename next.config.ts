import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    optimizePackageImports: ["lucide-react", "clsx", "tailwind-merge"],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "(.*\\.vercel\\.app)",
          },
        ],
        destination: "https://djiprod.tech/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

