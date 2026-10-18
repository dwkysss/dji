import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    optimizePackageImports: ["lucide-react", "clsx", "tailwind-merge"],
  },
  async redirects() {
    if (process.env.REDIRECT_TO_CUSTOM_DOMAIN === "true") {
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
    }
    return [];
  },
};

export default nextConfig;

