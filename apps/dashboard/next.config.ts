import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://orchestrator:8000/:path*', // Docker network hostname
      },
    ]
  },
};

export default nextConfig;
