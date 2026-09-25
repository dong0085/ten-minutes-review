# ten-minutes-review — agent notes

Specs live in `docs/`: `SCOPE.md` (every product decision), `PROMPTS.md` (the two prompts), `TECHNICAL.md` (architecture, data model, API, pipelines), `FLOWS.md` (screen behaviour), `TRIAL-RUN.md` (field notes). Read `docs/TECHNICAL.md` before changing architecture.

## Layout

- `apps/web` — Next.js 16 API routes plus the server-rendered landing, auth, and unsubscribe pages; deploys to Vercel together with the SPA build.
- `apps/spa` — Vite + React Router single-page app for every screen under `/classrooms` and `/account`. It builds into `apps/web/public/_spa/`, and Next rewrites those paths to its shell. Navigation drills down with breadcrumbs, one job per screen.
- `apps/worker` — job loop (`extract`, `compose`, `send_email`) plus the 15-minute scheduler and a `/health` HTTP server, runs on Render with `tsx`, applies migrations on boot.
- `packages/core` — domain types, prompt constants (`EXTRACTION_PROMPT_V2`, `COMPOSITION_PROMPT_V2`), grading, quiz sizing.
- `packages/db` — Drizzle schema, SQL migrations in `drizzle/`, repositories.
- `packages/email` — React Email templates, localized HTML/text rendering, and browser previews.
- `packages/ui` — shadcn components, `cn`, and `globals.css`, shared by `apps/web` and `apps/spa`.

## Commands

- `pnpm dev:web`, `pnpm dev:spa`, `pnpm dev:worker`, `pnpm dev:email` — open the app at `localhost:5173`; Vite proxies the API and Next pages to `localhost:3000`.
- `pnpm typecheck`, `pnpm test`, `pnpm --filter web lint`, `pnpm --filter spa lint`, `pnpm build`
- `pnpm db:generate` after a schema edit; `pnpm db:migrate` to apply
- Keep `CREATE EXTENSION IF NOT EXISTS citext;` at the top of the first migration file when it is regenerated.

## Conventions

- Relative imports inside `packages/**` and `apps/worker/**` stay extensionless (`./client`, never `./client.js`); Turbopack resolves only extensionless paths under `transpilePackages`.
- Shared packages export TypeScript source directly. The worker runs via `tsx`. There is no package build step.
- Answers and explanations stay server-side until an attempt is submitted.
- LLM, email, and storage each sit behind one adapter chosen by `LLM_PROVIDER`, `EMAIL_PROVIDER`, `STORAGE_PROVIDER`. Defaults are `mock`, `console`, `local`.
- Env lives in the repo-root `.env`: `@next/env` loads it for the web app, `dotenv` for the worker and drizzle-kit.
- API routes authenticate through `getSessionUser`/`getCurrentUserOrGuest`, which accept both Auth.js cookies and `Authorization: Bearer tmr_…` tokens; keep every new route compatible with both (the SPA uses the cookie, the browser extension the token).
- The SPA reads and writes only through `/api` with TanStack Query; a screen that needs new data gets a route handler first. Links from Next pages into `/classrooms` or `/account` are plain `<a>` tags, since those paths load the SPA.
- Tests use Vitest in `packages/core`, `packages/email`, and `apps/worker`.
