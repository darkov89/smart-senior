import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // UI only — no Guardrails / clinical logic in this app (ADR-008).
};

export default nextConfig;

initOpenNextCloudflareForDev();
