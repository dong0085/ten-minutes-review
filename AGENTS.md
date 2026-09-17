# ten-minutes-review — agent notes

Specs live in `docs/`: `SCOPE.md` (every product decision), `PROMPTS.md` (the two prompts), `TECHNICAL.md` (architecture, data model, API, pipelines), `FLOWS.md` (screen behaviour), `TRIAL-RUN.md` (field notes). Read `docs/TECHNICAL.md` before changing architecture.

## Layout

- `apps/web` — Next.js 16 App Router UI and API routes, deploys to Vercel.
- `apps/worker` — job loop (`extract`, `compose`, `send_email`) plus the 15-minute scheduler and a `/health` HTTP server, runs on Render with `tsx`, applies migrations on boot.
- `apps/ios` — SwiftUI client over the web API; the Xcode project is generated from `apps/ios/project.yml` with `pnpm ios:generate` and stays local to each machine.
- `packages/core` — domain types, prompt constants (`EXTRACTION_PROMPT_V2`, `COMPOSITION_PROMPT_V2`), grading, quiz sizing.
- `packages/db` — Drizzle schema, SQL migrations in `drizzle/`, repositories.
- `packages/email` — React Email templates, localized HTML/text rendering, and browser previews.

## Commands

- `pnpm dev:web`, `pnpm dev:worker`, `pnpm dev:email`
- `pnpm typecheck`, `pnpm test`, `pnpm --filter web lint`, `pnpm build`
- `pnpm db:generate` after a schema edit; `pnpm db:migrate` to apply
- Keep `CREATE EXTENSION IF NOT EXISTS citext;` at the top of the first migration file when it is regenerated.

## Conventions

- Relative imports inside `packages/**` and `apps/worker/**` stay extensionless (`./client`, never `./client.js`); Turbopack resolves only extensionless paths under `transpilePackages`.
- Shared packages export TypeScript source directly. The worker runs via `tsx`. There is no package build step.
- Answers and explanations stay server-side until an attempt is submitted.
- LLM, email, and storage each sit behind one adapter chosen by `LLM_PROVIDER`, `EMAIL_PROVIDER`, `STORAGE_PROVIDER`. Defaults are `mock`, `console`, `local`.
- Env lives in the repo-root `.env`: `@next/env` loads it for the web app, `dotenv` for the worker and drizzle-kit.
- API routes authenticate through `getSessionUser`/`getCurrentUserOrGuest`, which accept both Auth.js cookies and `Authorization: Bearer tmr_…` tokens; keep every new route compatible with both clients.
- Tests use Vitest in `packages/core`, `packages/email`, and `apps/worker`.
