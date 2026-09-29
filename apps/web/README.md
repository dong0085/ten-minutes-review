# web

The Next.js 16 app for Ten Minutes Review. One Next server runs:

- `app/(site)/` — the landing, auth, and unsubscribe pages, rendered on the server
- `app/api/` — the API routes, used by the signed-in app and the browser extension
- `spa/` — the React Router app for every screen under `/classrooms`, `/account`, and `/admin`. `app/(app)/layout.tsx` mounts it in the browser only.

Run it from the repo root with `pnpm dev`, then open [http://localhost:3000](http://localhost:3000). See the [root README](../../README.md) for setup and [`docs/TECHNICAL.md`](../../docs/TECHNICAL.md) for the architecture.
