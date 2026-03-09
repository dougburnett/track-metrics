import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // HTML pages: cache but always revalidate with server
      source: "/((?!_next/static|_next/image|favicon.ico|logo.png|apple-touch-icon.png).*)",
      headers: [
        { key: "Cache-Control", value: "no-cache" },
      ],
    },
  ],
};

export default nextConfig;
