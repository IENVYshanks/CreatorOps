import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  rewrites() {
    return Promise.resolve([
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ]);
  },
};

export default nextConfig;
