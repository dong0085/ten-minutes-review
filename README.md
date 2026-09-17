# Ten Minutes Review

![Ten Minutes Review project card](docs/readme/generated/thumbnail.png)

Turns tutoring notes—typed text or photos of handwriting—into a fresh daily quiz that fits inside ten minutes.

![Notes flow through a question bank into a focused daily quiz](docs/readme/generated/hero.svg)

**Status:** built and runnable locally. The default development setup uses deterministic mock AI, console email, and local image storage, so no vendor accounts are needed.

## Run it locally

Prerequisites: Node 22+, pnpm 10+, and Postgres 15+.

```sh
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev:web
```

In a second terminal, start the job worker:

```sh
pnpm dev:worker
```

Open [http://localhost:3000](http://localhost:3000) and use the development invite code `dev-invite`. The defaults in `.env.example` provide fixture extraction and quiz composition, print email to the worker log, and store uploaded images in `.uploads/`.

## Architecture

![Architecture showing the Next.js web app handing queued work through Postgres to a separate worker and provider adapters](docs/readme/generated/architecture.svg)

The web app never waits for the language model. It writes an `extract`, `compose`, or `send_email` job to Postgres and returns; the worker claims that work, retries it safely, and records the result. Answers and explanations remain server-side until an attempt is submitted.

| Layer | Responsibility |
|---|---|
| `apps/web` | Next.js 16 App Router UI, Auth.js sessions, and session-scoped API routes |
| `apps/worker` | Extraction, quiz composition, scheduled delivery, retries, and health server |
| `packages/core` | Domain types, prompts, grading, quiz sizing, and localization |
| `packages/db` | Drizzle schema, migrations, and user-scoped repositories |
| `packages/email` | React Email templates, localized rendering, and browser previews |

## The learning loop

One lesson becomes a reusable memory instead of a one-off worksheet.

![Four-step learning loop: capture lesson notes, distill them into categorized study points, review for ten minutes, and retain feedback for the next attempt](docs/readme/generated/learning-loop.svg)

1. **Capture:** paste a lesson recap or photograph handwritten notes.
2. **Distill:** the worker extracts reusable vocabulary, phrases, grammar, ideas, and comprehension passages.
3. **Review:** each quiz favors recent material while mixing in light retests from the question bank.
4. **Remember:** submission reveals answers and explanations; attempt history is retained and retakes reshuffle multiple-choice options.

## What the product does

1. A learner creates a classroom and adds typed notes or handwritten pages.
2. The worker extracts vocabulary, phrases, grammar, ideas, and comprehension passages into a question bank.
3. Each morning—or on demand—the worker composes a new quiz from recent material and light retests.
4. The learner answers on the web or reads the questions inline in email; submitted attempts retain scores, timing, answers, and explanations.

The interface and transactional email support English and French. Quiz content stays in the language being studied, with eleven target languages supported.

## Providers

Each external service sits behind a single adapter selected from the root `.env`.

| Concern | Local default | Production option |
|---|---|---|
| Language model | `LLM_PROVIDER=mock` | `deepseek` |
| Email | `EMAIL_PROVIDER=console` | `brevo` or `resend` |
| Image storage | `STORAGE_PROVIDER=local` | `vercel` |
| Database | Local Postgres | Neon Postgres |

Copy `.env.example`, keep the defaults for local work, and add provider credentials only when switching an adapter to a real service.

## Project documents

The documents are the source of truth for product behavior and architecture.

| File | What it covers |
|---|---|
| [`docs/SCOPE.md`](docs/SCOPE.md) | Product definition, constraints, and locked decisions |
| [`docs/PROMPTS.md`](docs/PROMPTS.md) | Extraction and composition prompts plus response shapes |
| [`docs/TECHNICAL.md`](docs/TECHNICAL.md) | Architecture, data model, API surface, pipelines, and deployment |
| [`docs/FLOWS.md`](docs/FLOWS.md) | Screen-by-screen behavior |
| [`docs/TRIAL-RUN.md`](docs/TRIAL-RUN.md) | Field notes from the real tutoring session that validated the loop |

## Useful commands

```sh
pnpm typecheck
pnpm test
pnpm --filter web lint
pnpm build
pnpm dev:email
pnpm docs:render
```

`pnpm dev:email` opens the localized React Email previews at [http://localhost:3001](http://localhost:3001).

`pnpm docs:render` rebuilds the committed README artwork from the Typst sources in `docs/readme/`. It requires Typst 0.15 or newer and no Typst packages or network access.

## Deployment

- Deploy `apps/web` to Vercel with files outside its root directory included.
- Deploy the repository's `render.yaml` blueprint to Render for the worker.
- Give both services `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, and the selected provider credentials.
- Connect Vercel Blob for production image uploads and set the repository `WORKER_URL` variable for the morning keep-alive workflow.

Billing, referral rewards, tier enforcement, quiz-type selection, and full spaced repetition are modeled or specified but intentionally deferred. See [`docs/TECHNICAL.md`](docs/TECHNICAL.md#7-deferred) for the current boundary.
