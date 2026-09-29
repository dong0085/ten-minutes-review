# ten-minutes-review — agent notes

Specs live in `docs/`: `SCOPE.md` (every product decision), `PROMPTS.md` (the two prompts), `TECHNICAL.md` (architecture, data model, API, pipelines), `FLOWS.md` (screen behaviour), `TRIAL-RUN.md` (field notes), `SELF-HOSTING.md` (Docker deployment), `ADMIN.md` (admin console). Read `docs/TECHNICAL.md` before changing architecture.

## Layout

- `apps/web` — Next.js 16 on Vercel: API routes, the server-rendered landing, auth, and unsubscribe pages in `app/(site)/`, and the signed-in app.
- `apps/web/spa` — React Router app for every screen under `/classrooms`, `/account`, and `/admin`. `app/(app)/layout.tsx` mounts it in the browser only, and the catch-all pages under `app/(app)/` claim those paths for Next. Navigation drills down with breadcrumbs, one job per screen.
- `apps/worker` — job loop (`extract`, `compose`, `send_email`) plus the 15-minute scheduler and a `/health` HTTP server, runs on Render with `tsx`, applies migrations on boot.
- `packages/core` — domain types, prompt constants (`EXTRACTION_PROMPT_V2`, `COMPOSITION_PROMPT_V3`), grading, quiz sizing.
- `packages/db` — Drizzle schema, SQL migrations in `drizzle/`, repositories.
- `packages/email` — React Email templates, localized HTML/text rendering, and browser previews.
- `packages/ui` — shadcn components, `cn`, and `globals.css`, shared by the Next pages and the SPA.
- `deploy/` — Docker Compose stack (Caddy, web, worker, optional Postgres and MinIO) that pulls the images `.github/workflows/images.yml` publishes to GHCR.

## Commands

- `pnpm dev` starts Next on `localhost:3000`, which serves the pages, the API, and the SPA. `pnpm dev:worker` and `pnpm dev:email` start the worker and the email previews.
- `pnpm typecheck`, `pnpm test`, `pnpm --filter web lint`, `pnpm build`
- `pnpm db:generate` after a schema edit; `pnpm db:migrate` to apply
- Keep `CREATE EXTENSION IF NOT EXISTS citext;` at the top of the first migration file when it is regenerated.

## Conventions

- Relative imports inside `packages/**` and `apps/worker/**` stay extensionless (`./client`, never `./client.js`); Turbopack resolves only extensionless paths under `transpilePackages`.
- Shared packages export TypeScript source directly. The worker runs via `tsx`. There is no package build step.
- Answers and explanations stay server-side until an attempt is submitted.
- LLM, email, and storage each sit behind one adapter chosen by `LLM_PROVIDER`, `EMAIL_PROVIDER`, `STORAGE_PROVIDER`. Defaults are `mock`, `console`, `local`.
- Env lives in the repo-root `.env`: `@next/env` loads it for the web app, `dotenv` for the worker and drizzle-kit.
- API routes authenticate through `getSessionUser`/`getCurrentUserOrGuest`, which accept both Auth.js cookies and `Authorization: Bearer tmr_…` tokens; keep every new route compatible with both (the SPA uses the cookie, the browser extension the token).
- The SPA reads and writes only through `/api` with TanStack Query; a screen that needs new data gets a route handler first. SPA imports use `@/spa/…`. Links between the SPA and the Next pages are plain `<a>` tags, so each side starts with a full page load; the SPA's router reads the address once when it loads.
- Tests use Vitest in `packages/core`, `packages/email`, and `apps/worker`.
