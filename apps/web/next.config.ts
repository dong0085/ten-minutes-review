import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import createNextIntlPlugin from "next-intl/plugin";

loadEnvConfig(path.resolve(process.cwd(), "../.."));

const nextConfig: NextConfig = {
  transpilePackages: ["@tmr/core", "@tmr/db", "@tmr/email"],
  serverExternalPackages: ["@node-rs/argon2", "postgres"],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
