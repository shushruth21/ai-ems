import type { NextConfig } from "next";

/**
 * Baseline security headers. The Content-Security-Policy (with a per-request
 * nonce) is set in src/proxy.ts because it must vary per request.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=()",
  },
];

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo: trace files from the workspace root for the standalone build.
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  // Internal packages ship TypeScript source.
  transpilePackages: [
    "@ai-ems/config",
    "@ai-ems/contracts",
    "@ai-ems/db",
    "@ai-ems/domain",
    "@ai-ems/observability",
    "@ai-ems/security",
    "@ai-ems/ui",
  ],
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/**" }]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
