import { withSentryConfig } from '@sentry/nextjs';
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

export default withSentryConfig(nextConfig, {
  org: "softlink",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors.
    automaticVercelMonitors: true,
  },
});
