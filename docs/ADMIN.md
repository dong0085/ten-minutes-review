# Admin console

One operator runs the product. The admin console gives that person one place to watch the service, help a learner, and change settings without a deploy.

## Access

- `ADMIN_EMAILS` (comma-separated) lists the admins. An admin is a signed-in, email-verified user whose address is on that list.
- Admin API routes live under `/api/admin/*` and accept the Auth.js cookie only. A request carrying `Authorization: Bearer tmr_…` gets 403, so an extension token can never reach admin data.
- `/api/me` returns `isAdmin`, and the SPA shows an "Admin" entry in the account menu for admins.
- Every admin write, and every view of a learner's content, lands in `admin_audit_log`.
- The screens live in the SPA under `/admin`, with their own shell and a side navigation.

## Screens

| Path | What it shows | Actions |
|---|---|---|
| `/admin` | KPIs (users, active learners, paying users, MRR, LLM cost), 30-day charts, alerts (failed jobs, failed extractions, stuck jobs, overdue emails, Stripe mismatches) | — |
| `/admin/users` | Search by email or id; filter by guest, plan, disabled | — |
| `/admin/users/:id` | Profile, sign-in methods, plan, usage this week, limit overrides, classrooms, API tokens, email sends, LLM cost, referrals, audit trail | Sign out everywhere, revoke tokens, mark email verified, grant or end complimentary Pro, set limit overrides, turn off daily email, disable or enable, delete |
| `/admin/users/:id/classrooms/:classroomId` | Read-only view of a learner's classroom: notes, knowledge points, quizzes, attempts | Re-run a failed extraction |
| `/admin/uploads` | Recent notes uploads, filter by extraction status | — |
| `/admin/uploads/:id` | Source text or images, extraction result, discarded lines, error | Re-run extraction |
| `/admin/jobs` | Queue by kind and status, stuck jobs, worker heartbeat | — |
| `/admin/jobs/:id` | Payload, attempts, last error, related LLM calls | Retry, cancel |
| `/admin/llm` | Tokens and cost by day and purpose, top users, error rate, latency | — |
| `/admin/billing` | Subscriptions, MRR, churn, complimentary grants | Sync one user from Stripe |
| `/admin/emails` | Email sends by day and kind, unsubscribes | — |
| `/admin/referrals` | Referral links, sign-ups, rewards | — |
| `/admin/settings` | Free-tier limits, daily safety caps, LLM prices | Edit |
| `/admin/audit` | Every admin action | — |

## Viewing a learner's content

The console shows a learner's data read-only through admin API routes. It never signs in as the learner, so an admin can look but cannot answer quizzes, change settings, or send email in their name. Each view writes an audit row (`view_user_content`). The privacy policy should say that the operator can view uploaded notes and results to give support and fix problems.

## Data

- `users.disabled_at`, `users.disabled_reason` — a disabled user cannot sign in or use a token, and the scheduler skips them.
- `user_limit_overrides` — per-user free-tier limits (classrooms, notes uploads per week). Empty fields fall back to the global setting.
- `app_settings` — key/value JSON: `limits` (free-tier limits and daily caps) and `llm_prices` (USD per million tokens: input, cached input, output).
- `llm_calls` — one row per LLM request: purpose (`extract`, `compose`, `summarize`, `tutor`), provider, model, user, job, input/cached/output tokens, duration, success, error. Cost is computed at read time from `llm_prices`.
- `admin_audit_log` — admin, action, target type and id, JSON detail, time.
- Complimentary Pro is a `subscriptions` row with `plan = 'comp'`, `status = 'active'`, and an end date. A real Stripe subscription replaces it through the webhook.

## Phases

1. Access, audit log, schema, LLM call recording.
2. Dashboard, users (list, detail, actions), read-only content view.
3. Jobs, uploads, LLM usage.
4. Billing, emails, referrals, settings with runtime limits, audit screen.

Later: Resend bounce and complaint webhook with automatic suppression, announcements, CSV export, content reports from learners.
