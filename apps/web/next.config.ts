import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import createNextIntlPlugin from "next-intl/plugin";

loadEnvConfig(path.resolve(process.cwd(), "../.."));

// Docker builds set NEXT_OUTPUT=standalone so the output ships as a minimal
// server bundle with a repo-root tracing root (workspace packages + native deps).
const standalone = process.env.NEXT_OUTPUT === "standalone";

// The original Vercel address stays reachable. Once APP_URL moves to another
// host, its pages redirect there, while /api keeps answering in place for
// clients built against it (published extension, Stripe webhook).
const LEGACY_HOST = "ten-minutes-review.vercel.app";
const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
const redirectLegacyHost = appUrl !== "" && new URL(appUrl).host !== LEGACY_HOST;

const nextConfig: NextConfig = {
  transpilePackages: ["@tmr/core", "@tmr/db", "@tmr/email"],
  serverExternalPackages: ["@node-rs/argon2", "postgres"],
  async redirects() {
    if (!redirectLegacyHost) {
      return [];
    }
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: LEGACY_HOST }],
        destination: `${appUrl}/:path`,
        permanent: true,
      },
    ];
  },
  ...(standalone
    ? {
        output: "standalone" as const,
        outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
      }
    : {}),
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
