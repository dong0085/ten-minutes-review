import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import createNextIntlPlugin from "next-intl/plugin";

loadEnvConfig(path.resolve(process.cwd(), "../.."));

// Docker builds set NEXT_OUTPUT=standalone so the output ships as a minimal
// server bundle with a repo-root tracing root (workspace packages + native deps).
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  transpilePackages: ["@tmr/core", "@tmr/db", "@tmr/email"],
  serverExternalPackages: ["@node-rs/argon2", "postgres"],
  ...(standalone
    ? {
        output: "standalone" as const,
        outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
      }
    : {}),
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
