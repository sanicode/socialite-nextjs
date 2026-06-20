import type { NextConfig } from "next";
import { getPublicMediaBaseUrl } from "./app/lib/env";

function getImageRemotePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
  try {
    const url = new URL(getPublicMediaBaseUrl())
    const pathname = url.pathname.replace(/\/+$/, '')

    return [
      {
        protocol: url.protocol.replace(':', '') as 'http' | 'https',
        hostname: url.hostname,
        ...(url.port ? { port: url.port } : {}),
        pathname: pathname ? `${pathname}/**` : '/**',
      },
    ]
  } catch {
    console.warn('Invalid public media configuration; external image optimization will remain disabled.')
    return []
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['socialite.test', 'localhost', '127.0.0.1', '[::1]'],
  experimental: {
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  images: {
    remotePatterns: getImageRemotePatterns(),
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [{
        key: "Document-Policy",
        value: "js-profiling",
      }],
    }];
  },
};

export default nextConfig;
