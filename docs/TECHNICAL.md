# Technical Design

The build blueprint. The data model is the centerpiece — it is the one part that is expensive to change once real data exists.

---

## 1. Shape of the system

| Piece | Choice | Job |
|---|---|---|
| Web | Next.js (App Router) on Vercel | UI and API route handlers |
| Database | Postgres on Neon | All state, plus the job queue |
| Worker | Node service on Render (free web service, health-check pinged) | Extraction, composition, email sends |
| Queue | `jobs` table in Postgres | Work handoff, no Redis needed |
| Images | Vercel Blob | Uploaded note images |
| LLM | DeepSeek, behind one adapter module | Extraction and composition |
| Email | React Email templates; Brevo (or Resend) delivery adapter | Transactional and quiz email |
| Billing | Stripe | Modeled now, inactive |

The web app never calls the LLM inline. It writes a row and returns. The worker picks it up. That keeps request latency predictable and lets a slow extraction retry without the user waiting.

### Localization

The UI ships in English and French. `apps/web/i18n/request.ts` resolves the locale per request: a signed-in user's `ui_language`, otherwise the `NEXT_LOCALE` cookie (set by the header language switch for signed-out visitors), otherwise the `Accept-Language` header, falling back to `en`. There is no locale segment in the URL — next-intl runs without i18n routing, so every route keeps its current path.

Message catalogs live in `packages/core/src/messages` (`en/` and `fr/`, namespaces `Common`, `Layout`, `Home`, `Auth`, `Account`, `Classroom`, `Quiz`, `Category`, `Upload`, `Email`, `Api`). `getMessages`, `formatMessage`, and `toUiLocale` are shared by the web app and the worker.

- API error messages are localized centrally in `apps/web/lib/api.ts`: routes keep their English literals, which map to `Api` catalog keys before the response leaves the server.
- Transactional emails (`packages/email`) take a `UiLocale`; call sites pass the recipient's `ui_language`. React Email renders the localized components to HTML and plain text before the existing provider adapter sends them.
- Quiz stems, options, and explanations are generated in the target language and stored as content. Only UI chrome is translated; a question authored in French stays French in an English interface. A production fill_blank also carries the native cue in parentheses — see `PROMPTS.md`.

---

## 2. Data model

Postgres. All ids are UUIDs. All timestamps are `timestamptz`.

### users

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `email` | citext unique | The identifier |
| `email_verified_at` | timestamptz | |
| `username` | text | Display only, shown beside the avatar |
| `avatar_url` | text | |
| `password_hash` | text | Null for OAuth-only accounts |
| `ui_language` | text | ISO 639-1, default `en` |
| `timezone` | text | IANA name, e.g. `Asia/Shanghai` |
| `created_at` / `updated_at` | timestamptz | |

### accounts, sessions, verification_tokens

Auth.js tables. `verification_tokens` carries a `purpose` column: `verify_email`, `reset_password`, or `invite`.

### classrooms

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk → users | |
| `name` | text | |
| `target_language` | text | ISO 639-1, auto-detected from notes, editable |
| `native_language` | text | ISO 639-1 |
| `auto_stop_days` | int | Default 7; the classroom-settings override |
| `active_until` | timestamptz | Extended by every upload **and** every login |
| `paused_at` | timestamptz | Nullable; an explicit per-classroom pause of scheduled daily reviews |
| `daily_resumed_at` | timestamptz | Nullable; the last explicit resume, used for the morning cutoff |
| `archived_at` | timestamptz | Null while live |
| `created_at` / `updated_at` | timestamptz | |

`active_until` controls automatic active/dormant state. A classroom is active while `active_until > now()`, and uploads and logins both push it forward. Manual pause is independent and takes status precedence: `paused_at IS NOT NULL` means scheduled composition and inclusion in the morning email stop even if the activity window is live. Those activity extensions never clear `paused_at`. Resume clears it, records `daily_resumed_at`, and extends `active_until` to at least `now() + auto_stop_days`.

### uploads

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `classroom_id` | uuid fk | |
| `kind` | text | `text` or `image` |
| `text_content` | text | Null for image uploads |
| `storage_key` | text | Null for text uploads |
| `original_filename` / `mime_type` / `byte_size` | | |
| `extraction_status` | text | `pending`, `running`, `done`, `failed` |
| `extracted_at` / `extraction_error` | | |
| `subject` | text | Short AI-written title for the upload, null until extraction completes |
| `discarded` | jsonb | The discard list the extraction returned |
| `created_at` | timestamptz | |

### knowledge_points

The bank. One row per studyable item.

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `classroom_id` | uuid fk | |
| `source_upload_id` | uuid fk → uploads | |
| `category` | text | One of the five |
| `target_text` | text | In the target language |
| `native_text` | text | Nullable |
| `inferred` | boolean | True when the gloss was not in the notes |
| `note` | text | A correction or caveat, nullable |
| `detail` | jsonb | Grammar rule and examples, or a passage reference |
| `source_excerpt` | text | The note fragment it came from |
| `prompt_version` | text | |
| `retired_at` | timestamptz | Null while in play |
| `created_at` | timestamptz | Drives "newest material first" |

Index: `(classroom_id, created_at desc)`.

### passages

Long text that several questions can hang off: `id`, `classroom_id`, `source_upload_id`, `target_text`, `native_text`, `source_excerpt`, `created_at`.

### quizzes

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `classroom_id` | uuid fk | |
| `user_id` | uuid fk | |
| `quiz_date` | date | The user's local date |
| `kind` | text | `daily` or `manual` (default `daily`) |
| `size` | int | |
| `prompt_version` | text | |
| `composed_at` | timestamptz | |

**Partial unique index on `(classroom_id, quiz_date) WHERE kind = 'daily'`.** It keeps daily composition idempotent — a retry after a crash cannot double up. On-demand (`manual`) quizzes have no per-day limit. Index `(user_id, kind, composed_at)` supports usage counts over rolling windows.

### deleted_daily_quizzes

Tombstones for daily quizzes the learner deleted: `id`, `classroom_id` fk, `user_id` fk, `quiz_date`, `deleted_at`. Unique on `(classroom_id, quiz_date)`.

Deleting a quiz removes its questions, attempts, and attempt answers by cascade. A deleted daily quiz leaves a tombstone so the scheduler and the compose handler skip that classroom for that date instead of composing a replacement. Manual quizzes need no tombstone — nothing recreates them automatically.

### questions

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `quiz_id` | uuid fk | |
| `knowledge_point_id` | uuid fk | |
| `passage_id` | uuid fk | Nullable |
| `position` | int | |
| `category` / `type` | text | |
| `stem` | text | |
| `options` | jsonb | Nullable |
| `answer` | jsonb | See `PROMPTS.md` for shapes |
| `explanation` | text | |
| `prompt_version` | text | |
| `created_at` | timestamptz | |

### attempts / attempt_answers

`attempts`: `id`, `quiz_id`, `user_id`, `started_at`, `submitted_at`, `duration_ms`, `correct_count`, `question_count`.

`attempt_answers`: `id`, `attempt_id`, `question_id`, `response` jsonb, `is_correct`, `duration_ms`, `created_at`.

Attempts are unlimited. Every answer is kept until the learner deletes the quiz; deleting a quiz removes its attempts and answers with it.

An attempt row is written at submit. Until then, answers and progress live in a browser-local draft keyed by user and quiz; a refresh restores the draft rather than starting a new attempt. The draft expires with the attempt token after two hours.

Usage stats are computed live from `attempts` and `attempt_answers` in `packages/db/src/repos/stats.ts` (`getActivityStats`, `getLearningStats`, `listRecentAttemptScores`, `listRecentMissesForUser`). Nothing is denormalized or stored, and no API route or schema change is involved: the account server component calls the repository directly.

### email_preferences, email_sends

`email_preferences`: `user_id` pk, `daily_enabled` (default true), `send_hour_local` (retained for compatibility; the daily send time is fixed, so nothing reads it), `unsubscribed_at`.

`email_sends`: `id`, `user_id`, `sent_on` date, `kind` (`daily` or `manual`), `quiz_id` nullable, `classroom_ids` jsonb, `provider_message_id`, `created_at`. **Partial unique on `(user_id, sent_on) WHERE kind = 'daily'`** — one daily email per user per morning. **Unique on `(user_id, quiz_id)`** — one email per on-demand quiz.

### subscriptions, referrals

`subscriptions`: `id`, `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `current_period_end`, `cancel_at_period_end`, timestamps. Populated by webhooks when billing turns on. The UI stays debug-only until then.

`referrals`: `id`, `referrer_user_id`, `code` unique, `referred_user_id` nullable, `status` (`created`, `signed_up`, `rewarded`), `reward_months` default 1, `created_at`, `rewarded_at`.

### jobs

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `kind` | text | `extract`, `compose`, `send_email` |
| `payload` | jsonb | |
| `run_at` | timestamptz | |
| `status` | text | `pending`, `running`, `done`, `failed`, `cancelled` |
| `attempts` | int | |
| `locked_at` / `locked_by` | | |
| `last_error` | text | |
| `created_at` / `finished_at` | | |

Index: `(status, run_at)` where `status = 'pending'`.

Claiming is one statement, so several workers can run safely:

```sql
UPDATE jobs
SET status = 'running', locked_at = now(), locked_by = $1, attempts = attempts + 1
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'pending' AND run_at <= now()
  ORDER BY run_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

A job that has been `running` for over 10 minutes returns to `pending`, up to 3 attempts, then lands in `failed` with the error stored.

Compose jobs carry `classroomId`, `userId`, `localDate`, and `source` (`daily` or `manual`); daily jobs also carry the exact `sendAt` cutoff used by the scheduler. Cancelling a `pending` job sets its status to `cancelled`; cancelling a `running` job adds `cancelRequested: true` to the payload, and the worker re-reads that flag just before saving the quiz. Pausing performs those transitions for daily compose jobs only. The daily save path also locks and rechecks the classroom pause/resume eligibility, closing the race with a concurrent pause. Manual jobs are not cancelled or blocked.

---

## 3. Pipelines

### Extraction

```
upload stored
  → enqueue job(extract, { upload_id })
  → worker: load text + images
  → LLM extraction (EXTRACTION_PROMPT_V2)
  → write knowledge_points, passages, uploads.discarded, uploads.subject
  → uploads.extraction_status = 'done'
```

Images are sent to the model as image content and read the same way text is. Nothing distinguishes a handwritten page from a typed one downstream.

### Daily composition

The send time is **one fixed instant for everyone**: 7:00 AM America/Toronto, computed by `dailySendAt()` in `packages/core/src/schedule.ts` (11:00 UTC in summer, 12:00 UTC in winter). Users cannot choose a time. The scheduler runs every 15 minutes while the worker is awake and finds classrooms that are due:

```sql
SELECT c.*
FROM classrooms c
JOIN users u ON u.id = c.user_id
JOIN email_preferences ep ON ep.user_id = u.id
WHERE c.archived_at IS NULL
  AND c.active_until > now()
  AND c.paused_at IS NULL
  AND ep.daily_enabled
  AND ep.unsubscribed_at IS NULL
  AND now() >= $send_at
  AND COALESCE(c.daily_resumed_at, c.created_at) < $send_at
  AND NOT EXISTS (
    SELECT 1 FROM quizzes q
    WHERE q.classroom_id = c.id
      AND q.kind = 'daily'
      AND q.quiz_date = (now() AT TIME ZONE u.timezone)::date
  )
  AND NOT EXISTS (
    SELECT 1 FROM deleted_daily_quizzes d
    WHERE d.classroom_id = c.id
      AND d.quiz_date = (now() AT TIME ZONE u.timezone)::date
  );
```

`$send_at` is the current day's 7:00 AM Eastern instant. `COALESCE(daily_resumed_at, created_at) < $send_at` means a newly created or newly resumed classroom must have been eligible before that instant. A late worker can still catch up for a classroom that was eligible at send time, but a classroom resumed at or after the cutoff waits until tomorrow. The learner's local date still comes from their own timezone, so the quiz lands on the right calendar day everywhere. The same pause and cutoff predicates are used by due composition, ready-recipient, and overdue-delivery audit queries.

Each match gets a `compose` job. The worker writes the quiz and its questions, then enqueues one `send_email` job per **user** — not per classroom, because the email is a single menu.

On-demand quizzes use the same compose job and the same selection rules, enqueued directly by `POST /api/classrooms/:id/quizzes` with `source: "manual"`. They skip the daily existence check.

### Email

The worker builds one email per user per day containing every eligible classroom quiz composed that morning, questions inline, each with a link to the web quiz. When a queued email runs, its quiz query re-applies `paused_at IS NULL` and the resume cutoff, so a pause or late resume after queuing removes only that classroom while other active classrooms remain. The daily email goes out at the fixed 7:00 AM Eastern instant for every user; the account page and classroom home show the next send in the reader's own timezone, with UTC in parentheses. Sends through Brevo (or Resend), then writes `email_sends`. The unique constraint absorbs a duplicate run.

On-demand composition enqueues its own `send_email` job carrying `kind: "manual"` and the new `quizId`. That email contains just that quiz and dedupes per quiz, so it can be sent the same day the morning email already went out. Per-classroom pause does not block this path. Both kinds respect the existing account-wide `email_preferences` and unsubscribe state; pause/resume never modifies them.

### Billing

Stripe stays dark. The webhook route, the `subscriptions` table, and the plan checks exist; the UI that starts a checkout renders only in debug builds.

---

## 4. API surface

Next.js route handlers, all session-scoped.

| Method | Path | Job |
|---|---|---|
| `*` | `/api/auth/[...nextauth]` | Auth.js |
| `GET` `POST` | `/api/classrooms` | List, create |
| `GET` `PATCH` `DELETE` | `/api/classrooms/:id` | Read, rename/settings (including the dedicated `paused` transition), delete |
| `POST` | `/api/classrooms/:id/uploads` | Text body or multipart image |
| `GET` | `/api/classrooms/:id/uploads` | Timeline |
| `GET` | `/api/classrooms/:id/bank` | Counts per category |
| `GET` | `/api/classrooms/:id/quizzes/today` | Today's daily quiz plus any in-flight compose job, answers withheld |
| `POST` | `/api/classrooms/:id/quizzes` | Create an on-demand quiz (enqueues a compose job) |
| `POST` | `/api/classrooms/:id/quizzes/cancel` | Cancel the in-flight compose job |
| `GET` `DELETE` | `/api/quizzes/:id` | Read the quiz (answers withheld) or delete it with its attempts and answers |
| `POST` | `/api/quizzes/:id/attempts` | Start an attempt |
| `POST` | `/api/attempts/:id/submit` | Submit answers, receive correctness and explanations |
| `GET` | `/api/attempts/:id` | Full review |
| `GET` `PATCH` | `/api/me` | Profile |
| `GET` `PATCH` | `/api/me/email-preferences` | |
| `GET` | `/api/me/export` | Data export |
| `DELETE` | `/api/me` | Account deletion |
| `GET` | `/api/me/referrals` | Codes and status |
| `POST` | `/api/webhooks/stripe` | |
| `GET` | `/unsubscribe?token=` | One click, no login |

Answers and explanations never leave the server before a submission. The quiz payload carries stems and options only. A browser-local draft holds the learner's own responses and position between refreshes.

---

## 5. Multi-tenancy and security

- Every query goes through a repository layer that takes `user_id` and scopes by it. Ownership is enforced in the data layer, so a forgotten UI check is not a breach.
- Image reads use short-lived signed URLs.
- Upload limits: 10 MB per image, 50 uploads per user per day.
- LLM calls capped per user per day, so a runaway script cannot drain the DeepSeek balance.
- Sign-up requires an invite code while the product is invite-only.
- Passwords hashed with argon2id. Email verification required before the first upload.
- Session cookies: httpOnly, secure, sameSite lax.

---

## 6. Deployment

| Concern | Where |
|---|---|
| Web | Vercel |
| Postgres | Neon |
| Worker | Render free web service, kept awake through the 7:00 AM Eastern send by a GitHub Actions keep-alive |
| Images | Vercel Blob |
| Email | Brevo (or Resend) |
| Domain | Purchased at deploy |

Environment variables:

```
DATABASE_URL
AUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
DEEPSEEK_API_KEY
BREVO_API_KEY
RESEND_API_KEY
BLOB_READ_WRITE_TOKEN
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
APP_URL
```

Migrations run from the worker on boot, so the web app never needs database credentials at build time.

`.github/workflows/morning-ping.yml` wakes the worker at 10:05, 11:05, and 12:05 UTC and pings `/health` every two minutes for 50 minutes per run. That covers both send instants (11:00 UTC in summer, 12:00 UTC in winter) with lead time and keeps the instance from idling mid-compose or mid-send. The run fails visibly if the worker stops responding. Add the `WORKER_URL` repository variable before the first deploy.

---

## 7. Deferred

Modeled in the schema, unbuilt:

- Stripe checkout and the billing UI
- Referral UI and reward granting
- Tier-cap enforcement (3 classrooms, 5 attempts per quiz per day, quiz-type selection)
- Full spaced repetition
- On-demand quiz quotas (creation counts are tracked over rolling windows; no limit enforced)
- The account center's export and deletion jobs

---

## 8. Open technical questions

These came up while writing this and are worth deciding before the schema is written:

1. **Fill-in-the-blank grading tolerance.** The plan compares case-insensitively and ignores accents. That marks `etendoir` correct against `étendoir`. Confirm that is the intended leniency.
2. **Blank count in a grammar drill.** A grammar drill like `heureux → ____ ; triste → ____` is one question. Marking it correct only when every blank is right is harsh; marking it correct on a majority is generous. My call: all blanks required, since the learner sees the answer immediately after.
3. **Question count when the bank is small.** The formula floors at 8, so a brand-new classroom with 20 points gets 8 questions on day one and repeats material by day three. My call: that is fine — it is a review app, and repetition in week one is the point.
