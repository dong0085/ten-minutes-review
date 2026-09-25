import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Pages that Next.js still renders. In dev, Vite forwards them (and the API)
// to `next dev` so the session cookie stays on one origin.
const NEXT_PATHS = [
  "/api",
  "/_next",
  "/signin",
  "/signup",
  "/forgot",
  "/reset",
  "/verify",
  "/unsubscribe",
  "/about",
  "/privacy",
  "/icon.png",
  "/apple-icon.png",
];

const nextOrigin = process.env.NEXT_ORIGIN ?? "http://localhost:3000";

export default defineConfig(({ command }) => ({
  // The build is served by Next under /_spa; dev serves from the root.
  base: command === "build" ? "/_spa/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "../web/public/_spa"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      ...Object.fromEntries(
        NEXT_PATHS.map((prefix) => [prefix, { target: nextOrigin, changeOrigin: false }]),
      ),
      "^/$": { target: nextOrigin, changeOrigin: false },
    },
  },
}));
