import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
