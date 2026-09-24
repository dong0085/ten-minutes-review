# Plan B Status — AWS Self-Hosting

Last updated: 2026-09-16. This is the implementation record for the AWS self-hosting path described in [DEPLOY-AWS.md](DEPLOY-AWS.md). Every claim below is labeled as **verified** (with the evidence), **untested**, or a **judgment call** you can challenge and reverse.

Plan A (Vercel + Render + Neon + Vercel Blob) is unchanged by this work: `render.yaml` has a zero-line diff, the `local`/`vercel` storage branches keep their original behavior, and the default Next.js build produces the same output shape as before.

---

## What was added

| File | Purpose |
|---|---|
| `apps/web/lib/s3.ts` | S3 adapter for the web app: `putObject` upload, `getObjectBytes` read, SigV4 signing via `aws4fetch` |
| `apps/worker/src/s3.ts` | Read-only S3 adapter for the worker (mirrors web's, per the repo's existing duplication pattern) |
| `apps/web/lib/storage.ts` | Added `s3` branches to `putObject` / `getObjectBytes`; `objectUrl` code untouched (its `/api/files/<key>` return already fits s3) |
| `apps/worker/src/storage.ts` | Added `s3` branch to `getObjectBytes` |
| `apps/web/lib/env.ts`, `apps/worker/src/env.ts` | `"s3"` added to the provider enum; new `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` fields |
| `apps/web/app/api/files/[...key]/route.ts` | Now streams via `getObjectBytes` for every provider instead of local disk only |
| `apps/web/app/api/health/route.ts` | New health endpoint mirroring the worker's `/health` |
| `apps/web/next.config.ts` | `output: "standalone"` + `outputFileTracingRoot` gated behind `NEXT_OUTPUT=standalone` (set only in the Docker build stage) |
| `Dockerfile`, `.dockerignore` | Multi-target image (`web`, `worker`), node:22-bookworm-slim, pnpm, frozen lockfile |
| `docker-compose.yml`, `.env.aws.example` | Full stack: web + worker + Postgres 16 + MinIO; runnable locally with mock providers |
| `docs/DEPLOY-AWS.md` | Runbook: Lightsail primary path, App Runner + RDS alternative, S3/IAM setup, moving from Plan A |
| `.env.example`, `README.md`, `.gitignore` | Commented S3 block, one-line deployment pointer, `.env.aws.example` exception |

No database migration: `uploads.storage_key` already stores relative keys, and URLs are recomputed at read time.

## Verification record

### Static checks (verified)

```
pnpm typecheck            # both apps pass
pnpm test                 # 60/60 (core 49, worker 11)
pnpm --filter web lint    # clean
pnpm build                # succeeds; no .next/standalone when NEXT_OUTPUT is unset
git diff render.yaml      # zero lines
```

### Live end-to-end against real MinIO (verified, zero AWS spend)

Run with local Postgres, `LLM_PROVIDER=mock`, `EMAIL_PROVIDER=console`, `STORAGE_PROVIDER=s3` pointing at a local MinIO (`S3_ENDPOINT=http://127.0.0.1:9000`, `S3_FORCE_PATH_STYLE=true`):

1. Sign up, create a classroom, upload a 70-byte PNG.
2. The object lands in MinIO under `uploads/<classId>/…` (SigV4 signing verified by MinIO itself — unsigned requests get 403, signed get 200).
3. Upload list returns `imageUrl = /api/files/<key>`; fetching it with a session gives `200 image/png` (70 bytes), without a session gives `401`.
4. `after()` extraction runs in the web process — meaning the web also read the bytes back from S3 — and produced 3 knowledge points via the mock LLM.
5. The worker's adapter (same code, tsx runtime) read the same object back: 70 bytes, `image/png`.
6. An 11 MB upload is rejected with 400 (size limit intact).
7. Regression: with `STORAGE_PROVIDER=local`, upload → file in `.uploads/` → served through the rewritten files route (200, correct type).

All test data was removed afterwards; local dev `.env` values were overridden (process env wins over `.env`), so production was never touched.

### Bug found and fixed during testing

Symptom: S3 PUT returned `411 Length Required` from MinIO, but only inside the Next.js runtime (the same code passed under plain Node/tsx).

Root cause, isolated with a temporary probe route: `aws4fetch` exposes the request body as a `ReadableStream`. Under Next.js's patched `fetch`, a stream body loses its content length and is sent chunked; S3 rejects chunked PUTs without a content length. Unsigned plain `fetch` with a `Blob` reached MinIO fine (403, framing OK) — which localized the fault to the aws4fetch transport, not to MinIO or the app.

Fix: sign with `client.sign()` (plain parts) and send via init-style `fetch` while passing our own `Blob` body. Both `apps/*/s3.ts` carry a comment explaining this. Re-verified end-to-end after the fix.

## Untested (known gaps)

- **The Docker build has never run.** The dev machine has no container runtime. `Dockerfile`, `.dockerignore`, and `docker-compose.yml` are written and reviewed but unbuilt. The standalone tracing in a pnpm monorepo (`outputFileTracingRoot`) is the most likely place for a surprise; the fallback is documented in DEPLOY-AWS.md (unset `NEXT_OUTPUT`, ship full `node_modules`, run `next start`).
- **App Runner + RDS path is documentation only.** Lightsail steps are concrete; the managed path has not been walked.
- **The Vercel Blob → S3 copy script in DEPLOY-AWS.md is a sketch**, roughly 15 lines, never executed.
- **Cost figures are estimates** from public AWS pricing as of 2026-09; treat them as ±30% and check the Lightsail/App Runner consoles before committing.
- The `vercel` provider path through the rewritten files route streams bytes where it previously 404'd (an added capability, not used by the UI today); it was reasoned about and type-checked, and it was not exercised live.

## Judgment calls (all reversible)

| Decision | Alternative | Rationale given |
|---|---|---|
| Private bucket, served via authed `/api/files` | Public bucket or presigned URLs | Matches the existing auth model; student handwriting stays behind login; presigning adds expiry logic for little gain at this scale |
| `aws4fetch` (~7 KB) | `@aws-sdk/client-s3` (large) | Worker already reads blobs with plain `fetch`; smaller surface. Trade-off: static IAM keys only (no instance-role chain) |
| Worker runs as a long-lived container | EventBridge-triggered cron tasks | The worker's scheduler has catch-up semantics, so one always-on process replaces Render cron, EventBridge rules, and the keep-alive cron in one piece |
| Static IAM key scoped to `uploads/*` | EC2 instance profile | aws4fetch signs with explicit credentials; the scoped policy contains the blast radius |
| `NEXT_OUTPUT` env gate for standalone | Always-on standalone | Keeps the Vercel build byte-identical to Plan A |
| MinIO in the compose default | S3-only | Lets the whole stack run with zero cloud accounts; switching to S3 is env vars |

## Next steps

In order, each independently verifiable:

1. **Run the compose stack once.** Install a container runtime (OrbStack or Docker Desktop), then `cp .env.aws.example .env.aws && docker compose --env-file .env.aws up -d --build`, and walk the same checklist as the live e2e above (health endpoints, signup, upload, MinIO object, auth'd serving, oversize 400). This closes the largest gap.
2. **If the web container fails to start** with missing module/binary errors (standalone tracing), retry with `NEXT_OUTPUT` unset in the `web` stage — the image then runs `next start` with full `node_modules`.
3. **Commit the work** once the compose run passes.
4. **Lightsail dry run** (~$12/mo): 2 vCPU/4 GB Ubuntu VM, `get.docker.com`, clone, compose up, point a domain, add the Caddy sidecar for HTTPS. Decide MinIO-on-VM vs real S3 at this point.
5. **Data migration decision**: start clean, or run the Blob→S3 copy script (test it on a few objects first — it is a sketch).
6. **Optional**: the App Runner + RDS path if you prefer managed hosting (~$30/mo), and a nightly `pg_dump` cron.

## How to independently verify

Everything above can be re-checked without trusting this document:

- Static: run the four commands in "Static checks".
- S3 path without AWS: `brew install minio`, start it locally, set the `S3_*` env overrides from `.env.aws.example`, run `pnpm dev:web` / `pnpm dev:worker`, and repeat the live e2e steps.
- Plan A regression: run the plain dev stack with `.env` defaults (`STORAGE_PROVIDER=local`) and do one upload.
- The 411 root cause: put a `Blob` body through `client.fetch` vs `sign()` + plain `fetch` inside a route handler against MinIO, and compare status codes (411 vs 200).
