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
// Mirrors normalizeAppUrl in @tmr/core: APP_URL may omit the scheme.
const rawAppUrl = process.env.APP_URL ?? "";
const appUrl = rawAppUrl
  ? (/^https?:\/\//i.test(rawAppUrl) ? rawAppUrl : `https://${rawAppUrl}`).replace(/\/+$/, "")
  : "";
const redirectLegacyHost = appUrl !== "" && new URL(appUrl).host !== LEGACY_HOST;

// The signed-in app is a single-page app built by apps/spa into public/_spa.
// Every address under these prefixes serves its shell; its router takes over.
const SPA_SHELL = "/_spa/index.html";
const SPA_PREFIXES = ["/classrooms", "/account"];

const nextConfig: NextConfig = {
  transpilePackages: ["@tmr/core", "@tmr/db", "@tmr/email", "@tmr/ui"],
  serverExternalPackages: ["@node-rs/argon2", "postgres"],
  async rewrites() {
    return SPA_PREFIXES.flatMap((prefix) => [
      { source: prefix, destination: SPA_SHELL },
      { source: `${prefix}/:path*`, destination: SPA_SHELL },
    ]);
  },
  async headers() {
    return [
      {
        // Vite fingerprints these file names, so they never change in place.
        source: "/_spa/assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // The shell must be re-read on every visit to pick up a new build.
        source: "/_spa/index.html",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
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
