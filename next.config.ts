import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Enable getCloudflareContext() in `next dev`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;
