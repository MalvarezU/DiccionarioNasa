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
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-c0b3a305-afb6-43bb-a109-680dbc0aec86.space-z.ai",
  ],
};

export default nextConfig;
