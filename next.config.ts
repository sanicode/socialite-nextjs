import type { NextConfig } from "next";

function getImageRemotePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
  const publicUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_URL?.trim()
  if (!publicUrl) return []

  try {
    const url = new URL(publicUrl)
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
    console.warn('Invalid NEXT_PUBLIC_S3_PUBLIC_URL; external images will remain disabled.')
    return []
  }
}

const nextConfig: NextConfig = {
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
