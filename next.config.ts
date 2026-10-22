import type { NextConfig } from "next";

/** Host público de R2 (dominio custom). r2.dev siempre permitido (bucket test). */
const r2Hostname = (() => {
  try {
    const hostname = new URL(process.env.R2_PUBLIC_BASE_URL ?? "").hostname;
    return hostname || undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      // Bucket de test (r2.dev) y prod (dominio custom vía env)
      { protocol: "https", hostname: "*.r2.dev" },
      ...(r2Hostname ? [{ protocol: "https" as const, hostname: r2Hostname }] : []),
    ],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-c0b3a305-afb6-43bb-a109-680dbc0aec86.space-z.ai",
  ],
};

async function headers() {
  return [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        {
          key: "Content-Security-Policy-Report-Only",
          value:
            "default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-ancestors 'none';",
        },
      ],
    },
  ]
}

nextConfig.headers = headers

export default nextConfig;
