# Technical Design

The build blueprint. The data model is the centerpiece — it is the one part that is expensive to change once real data exists.

---

## 1. Shape of the system

| Piece | Choice | Job |
|---|---|---|
| Web | Next.js (App Router) on Vercel | API route handlers, plus the server-rendered marketing, sign-in, and unsubscribe pages |
| Web app | React Router single-page app in `apps/web/spa`, mounted by Next | Every signed-in screen, over the API |
| Extension | Chrome/Firefox MV3 in `apps/extension` | Context-menu note capture over the API |
| Database | Postgres on Neon | All state, plus the job queue |
| Worker | Node service on Render (free web service, health-check pinged) | Extraction, composition, email sends |
| Queue | `jobs` table in Postgres | Work handoff, no Redis needed |
| Images | Vercel Blob | Uploaded note images |
| LLM | DeepSeek, behind one adapter module | Extraction and composition |
| Email | React Email templates; Resend (or Brevo) delivery adapter | Transactional and quiz email |
| Billing | Stripe | Modeled now, inactive |

The web never calls the LLM inline. It writes a row and returns. The worker picks it up. That keeps request latency predictable and lets a slow extraction retry without the user waiting.

### The signed-in web app

`apps/web/spa` is a single-page app. It holds every screen under `/classrooms`, `/account`, and `/admin`; the Next pages in `app/(site)/` cover the landing, about, and privacy pages, the auth pages (`/signin`, `/signup`, `/forgot`, `/reset`, `/verify`), and `/unsubscribe`.

- **Serving.** Next builds the SPA with everything else. The root layout holds `<html>`, fonts, and the theme; `app/(site)/layout.tsx` adds the site header, and `app/(app)/layout.tsx` mounts the SPA with `next/dynamic` and `ssr: false`, marked `noindex`. Optional catch-all pages under `app/(app)/classrooms`, `account`, and `admin` render nothing; they claim those paths so the layout serves them, and the SPA router picks the screen. The layout stays mounted as the router moves between the three paths.
- **Same origin.** The SPA and the API share one origin, so the Auth.js cookie, Google OAuth, and Stripe redirects work unchanged. Links between the SPA and the Next pages are full page loads.
- **Session.** The SPA boots from `GET /api/me`, which also resolves guests and reports the plan, feature flags, and sign-in methods. A 401 on a screen that needs an account sends the browser to `/signin?callbackUrl=<path>`, and sign-in returns there.
- **Data.** TanStack Query fetches from `/api`; mutations update or invalidate the cached queries. Screens load lazily per route.
- **Shared UI.** The shadcn primitives, `cn`, and `globals.css` live in `packages/ui`, imported by both apps.

#### Information architecture

Navigation drills down: each screen does one job, a breadcrumb trail in the top bar leads back up, and phones show a back arrow to the parent. There are no tab strips.

```
/classrooms                              classroom list
  /new                                   create a classroom
  /:id                                   classroom hub: today's quiz, add notes, rows to each section
    /notes  /notes/new  /notes/:uploadId upload timeline, add notes, one upload in full
    /bank   /bank/:pointId               question bank (filters in the URL), one knowledge point
    /quizzes  /quizzes/:quizId           quiz list, one quiz with every attempt
    /quizzes/:quizId/take                quiz runner, full screen with no top bar
    /quizzes/:quizId/attempts/:attemptId results and review
    /settings                            name, languages, daily reviews, archive or delete
/account                                 stats, recent quizzes, rows to each settings screen
  /profile  /security  /email  /plan  /referrals  /tokens  /data
```

Earlier addresses redirect in the SPA router: `/classrooms/:id/quiz/:quizId` (links in sent emails) goes to `…/quizzes/:quizId/take`, `/upload` to `/notes/new`, `/history` to `/notes`, `/attempts/:attemptId` to its nested results page, and `/account/api-tokens` to `/account/tokens`.

### Localization

The UI ships in English, French, and Chinese. `apps/web/i18n/request.ts` resolves the locale per request for the Next pages, and the SPA applies the same order on boot: a signed-in user's `ui_language`, otherwise the `NEXT_LOCALE` cookie (set by the header language switch for signed-out visitors), otherwise the `Accept-Language` header, falling back to `en`. There is no locale segment in the URL — next-intl runs without i18n routing, so every route keeps its current path.

Message catalogs live in `packages/core/src/messages` (`en/`, `fr/`, `zh/`; namespaces include `Common`, `App`, `Layout`, `Home`, `Auth`, `Account`, `Classroom`, `Quiz`, `Category`, `Upload`, `Email`, `Api`). `getMessages`, `formatMessage`, and `toUiLocale` are shared by the Next pages (next-intl), the SPA (use-intl), and the worker.

- API error messages are localized centrally in `apps/web/lib/api.ts`: routes keep their English literals, which map to `Api` catalog keys before the response leaves the server.
- Transactional emails (`packages/email`) take a `UiLocale`; call sites pass the recipient's `ui_language`. React Email renders the localized components to HTML and plain text before the existing provider adapter sends them.
- The colour palette follows the same order: a signed-in user's `ui_theme`, otherwise the `UI_THEME` cookie, falling back to `mint`. The header switch saves to the account through `PATCH /api/me` and also sets the cookie, so the palette survives sign-out.
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
| `ui_theme` | text | Colour palette (`mint`, `sky`, `sakura`, `lavender`); null until the user picks one |
| `timezone` | text | IANA name, e.g. `Asia/Shanghai` |
| `onboarded_at` | timestamptz | Set when the user finishes or skips onboarding; null sends a user with no classroom through it |
| `created_at` / `updated_at` | timestamptz | |

### accounts, sessions, verification_tokens

Auth.js tables. `verification_tokens` carries a `purpose` column: `verify_email`, `reset_password`, or `invite`. The `accounts` and `sessions` tables exist for an adapter that was never wired up — sessions are JWTs in cookies.

### api_tokens

Bearer tokens for native clients. `id` uuid pk, `user_id` fk → users, `token_hash` text unique (sha256 hex of the raw `tmr_…` token — the raw value exists only in the client's keychain), `prefix` text (first 8 characters, for display), `name` text (device label supplied at sign-in), `created_at`, `last_used_at`, `revoked_at`. Tokens carry no expiry in v1; revocation is the lifecycle. `POST /api/auth/token` mints one after argon2 verification and runs the same login side effects as a cookie sign-in.

### classrooms

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk → users | |
| `name` | text | |
| `target_language` | text | ISO 639-1, auto-detected from notes, editable |
| `native_language` | text | ISO 639-1 |
| `auto_stop_days` | int | Default 7; the classroom-settings override |
| `quiz_length` | int | Default 0; −2 to 2, scales the quiz budget by 0.5, 0.75, 1, 1.5, or 2 |
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
| `reread_id` / `reread_status` | uuid / text | The re-read in progress: `pending`, `running`, or `failed`; both null when there is none |
| `pending_text` | text | Edited text waiting to be read; null when re-reading the note as it stands |
| `reread_error` / `reread_result` | text / jsonb | Why the last re-read failed; what the last one changed (`updated`, `added`, `removed`, `keptEditedPointIds`) |
| `reread_count` | int | Successful edits and re-reads, for the free plan's per-note cap |
| `edited_at` | timestamptz | Last time the learner's edit was saved |
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
| `retired_at` | timestamptz | Null while in play; set when the learner omits the point or an edit replaces it |
| `superseded_at` | timestamptz | Set, with `retired_at`, when an edit to its note replaced the point. The row stays so past questions and answers keep it |
| `user_edited_at` | timestamptz | Set when the learner edits the point by hand; re-reads never change it |
| `created_at` | timestamptz | Marks a point as recent for composition selection |

Index: `(classroom_id, created_at desc)`.

### passages

Long text that several questions can hang off: `id`, `classroom_id`, `source_upload_id`, `target_text`, `native_text`, `source_excerpt`, `superseded_at`, `created_at`.

### note_lines, knowledge_point_lines, passage_lines

A typed note is stored as lines: `note_lines` holds `id`, `upload_id`, `position`, `text`, with blank lines kept so the lines join back into `uploads.text_content`. `knowledge_point_lines` and `passage_lines` link each point and passage to the lines it came from (many to many: a grammar rule can span lines, and one line can give a word and a rule). Image notes have no lines. Notes read before lines existed get them on their first edit, with points linked by matching `source_excerpt` to a line; a point that matches none stays unlinked.

Questions point at knowledge points with `ON DELETE CASCADE`, so points are never deleted by an edit: a replaced point gets `superseded_at` and `retired_at`, which every existing "in play" filter already skips.

### quizzes

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `classroom_id` | uuid fk | |
| `user_id` | uuid fk | |
| `quiz_date` | date | The user's local date |
| `kind` | text | `daily`, `manual`, or `exam` (default `daily`) |
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

`attempts`: `id`, `quiz_id`, `user_id`, `started_at`, `submitted_at`, `duration_ms`, `correct_count`, `question_count`, `review` jsonb (the AI review of an exam's mistakes: `overview`, `patterns[]` with `title`, `detail`, `questions`, and `nextSteps[]`), `review_prompt_version`.

`attempt_answers`: `id`, `attempt_id`, `question_id`, `response` jsonb, `is_correct`, `duration_ms`, `created_at`.

Attempts are unlimited. Every answer is kept until the learner deletes the quiz; deleting a quiz removes its attempts and answers with it.

An attempt row is written at submit. Until then, answers and progress live in a browser-local draft keyed by user and quiz; a refresh restores the draft rather than starting a new attempt. The draft expires with the attempt token after two hours.

Usage stats are computed live from `attempts` and `attempt_answers` in `packages/db/src/repos/stats.ts` (`getActivityStats`, `getLearningStats`, `listRecentAttemptScores`, `listRecentMissesForUser`). Nothing is denormalized or stored, and no API route or schema change is involved: the account server component calls the repository directly.

### mistake_practice

`mistake_practice`: `id`, `user_id`, `classroom_id`, `question_id`, `response` jsonb, `is_correct`, `created_at`. One row per answer given in the mistake book.

The mistake book itself is derived, not stored. `listOpenMistakes` (`packages/db/src/repos/mistakes.ts`) gathers the classroom's answers from the last `MISTAKE_WINDOW_DAYS` (30) — attempt answers and mistake-book answers alike — and keeps each question that a submitted quiz or exam missed in the window and whose latest answer anywhere is still wrong. A right answer clears it, in the book or on a retake; a later miss brings it back. It is ordered by the first miss in the window, then paper position. The grading route reveals a question's answer only while it is open, so an untaken quiz's answers stay server-side.

### tutor_requests

`tutor_requests`: `id`, `user_id`, `classroom_id`, `question_id`, `mode` (`hint` or `analysis`), `level` (hints count 1–3; analyses 0), `response` jsonb (the wrong answer an analysis explains), `status` (`pending`, `done`, `failed`), `content` jsonb, `prompt_version`, `created_at`, `finished_at`. One row per question put to the AI tutor on Corrections; a `tutor` job fills `content`.

### email_preferences, email_sends

`email_preferences`: `user_id` pk, `daily_enabled` (default true), `send_hour_local` (retained for compatibility; the daily send time is fixed, so nothing reads it), `unsubscribed_at`.

`email_sends`: `id`, `user_id`, `sent_on` date, `kind` (`daily` or `manual`), `quiz_id` nullable, `classroom_ids` jsonb, `provider_message_id`, `created_at`. **Partial unique on `(user_id, sent_on) WHERE kind = 'daily'`** — one daily email per user per morning. **Unique on `(user_id, quiz_id)`** — one email per on-demand quiz.

### subscriptions, referrals

`subscriptions`: `id`, `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `current_period_end`, `cancel_at_period_end`, timestamps. **Unique on `user_id`** — one row per user, upserted by the Stripe webhook.

`referrals`: `id`, `referrer_user_id`, `code` unique, `referred_user_id` nullable, `status` (`created`, `signed_up`, `rewarded`), `reward_months` default 1, `created_at`, `rewarded_at`.

### jobs

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `kind` | text | `extract`, `compose`, `send_email`, `summarize`, `tutor` |
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

Compose jobs carry `classroomId`, `userId`, `localDate`, and `source` (`daily`, `manual`, or `exam`); exam jobs are looked up apart from quiz jobs, so an exam in flight never shows as today's quiz being written; daily jobs also carry the exact `sendAt` cutoff used by the scheduler. Cancelling a `pending` job sets its status to `cancelled`; cancelling a `running` job adds `cancelRequested: true` to the payload, and the worker re-reads that flag just before saving the quiz. Pausing performs those transitions for daily compose jobs only. The daily save path also locks and rechecks the classroom pause/resume eligibility, closing the race with a concurrent pause. Manual jobs are not cancelled or blocked.

---

## 3. Pipelines

### Extraction

```
upload stored
  → enqueue job(extract, { uploadId })
  → worker (or the request's after()): split text into lines, load images
  → LLM extraction (EXTRACTION_PROMPT_V3), points cite line numbers
  → one transaction: note_lines, knowledge_points, passages and their line links,
    uploads.discarded, uploads.subject, uploads.extraction_status = 'done'
```

The worker handler and the web's `after()` path both call `runExtractJob` in `packages/db/src/note-reading.ts`. The transaction skips a note that is already `done`, so a retried job adds nothing twice.

### Editing a note

```
PATCH /uploads/:uploadId { text }   or   POST /uploads/:uploadId/reread
  → claim: UPDATE uploads SET reread_id, reread_status = 'pending', pending_text
           WHERE reread_status IS NULL OR 'failed'        (the only lock)
  → enqueue job(extract, { uploadId, rereadId })
  → diff old and new lines (planNoteEdit in packages/core/src/note-lines.ts)
      unchanged lines keep their id; a removed line next to an added one is "changed"
      points only on unchanged lines: untouched
      points on changed lines: sent to the model (REREAD_PROMPT_V1) to keep, update, or remove
      points whose lines are all gone: replaced without a model call
      passages on changed lines: replaced, with their comprehension points
      hand-edited points: never changed; reported when their lines changed
  → resolveReread keeps only what the plan allows
  → one transaction, only while reread_id still matches and the note's lines are
    the ones the plan started from: lines, points, links, then uploads.text_content
```

The note's text and points stay as they were until the re-read succeeds. A failed re-read sets `reread_status = 'failed'` and leaves the note untouched; Try again re-runs it with the same `pending_text`, and Discard clears it. A stale or repeated job finds a different `reread_id` and changes nothing. Updated points keep their id, so their answer history, omit, and quiz links stay. Image notes have no lines: reading one again replaces every point the learner has not edited, and an omit carries over only when exactly one old and one new point share category and wording.

A note whose first reading failed is simply read again (with corrected text when the learner edited it) and costs nothing. Otherwise free users get `FREE_NOTE_REREADS` (3) successful edits or re-reads per note, Pro has no per-note cap, and every re-read counts toward the shared 50-a-day upload limit. Edits leave the classroom's active window alone.

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

Exams use the same compose job with `source: "exam"`. `selectExamPoints` (`packages/core/src/exam.ts`) picks up to 8 recent misses, then the points longest without a quiz, and assigns each a type — 20 mcq, 10 true_false, 10 fill_blank, plus 4 spares each — matching categories to the types they suit. The worker writes them with `EXAM_PROMPT_V2`, keeps only questions in their assigned type, fills the blueprint in part order, and fails the job for a retry if a part comes up short. With `JUDGE_PROVIDER=jev` the questions pass through the Jev review first, and set-aside ones fill a short part before the job fails. An exam sends no email; the job records `quizId` for the hub to poll.

Submitting a Pro exam with at least one miss enqueues a `summarize` job carrying `attemptId`. The worker numbers the answers as the paper does, sends the misses — the learner's answer and the right one as text, the knowledge point, the printed explanation — with the score by part to `EXAM_REVIEW_PROMPT_V1`, and saves the parsed review on the attempt, keeping only question numbers that were missed. The review is written in the learner's interface language. The SPA polls `/api/attempts/:id/review` until it is ready.

The AI tutor on Corrections runs the same way. Asking for a hint or an analysis writes a `tutor_requests` row and enqueues a `tutor` job carrying `requestId`. The worker sends the question with its answer and explanation, the knowledge point, and either the hint level with the earlier hints or the learner's wrong answer with their miss count, to `TUTOR_HINT_PROMPT_V1` or `TUTOR_ANALYSIS_PROMPT_V1`, in the learner's interface language. A hint that contains the right option or blank, compared as grading compares answers, throws so the job retries; the last failed try marks the request `failed`. A request still pending after five minutes reads as failed, so the page can ask again. Past replies from the window come back with the Corrections list.

On-demand quizzes use the same compose job and the same selection rules, enqueued directly by `POST /api/classrooms/:id/quizzes` with `source: "manual"`. They skip the daily existence check. The worker records the new quiz's id on the job's payload, and the classroom hub polls that job, so it opens the quiz it asked for even when a daily quiz already exists for the day.

### Email

The worker builds one email per user per day containing every eligible classroom quiz composed that morning, questions inline, each with a link to the web quiz. When a queued email runs, its quiz query re-applies `paused_at IS NULL` and the resume cutoff, so a pause or late resume after queuing removes only that classroom while other active classrooms remain. The daily email goes out at the fixed 7:00 AM Eastern instant for every user; Account → Email and the classroom hub show the next send in the reader's own timezone, with UTC in parentheses. Sends through Resend (or Brevo), then writes `email_sends`. The unique constraint absorbs a duplicate run.

On-demand composition enqueues its own `send_email` job carrying `kind: "manual"` and the new `quizId`. That email contains just that quiz and dedupes per quiz, so it can be sent the same day the morning email already went out. Per-classroom pause does not block this path. Both kinds respect the existing account-wide `email_preferences` and unsubscribe state; pause/resume never modifies them.

### Billing

- `POST /api/billing/checkout` creates a Stripe Checkout Session for `STRIPE_PRICE_ID` and returns `{ url }`. The user id rides along as `client_reference_id` and as `subscription_data.metadata.userId`.
- `POST /api/billing/portal` returns a Customer Portal `{ url }` for users with a `stripe_customer_id`.
- `POST /api/webhooks/stripe` verifies the signature with `STRIPE_WEBHOOK_SECRET` and handles `customer.subscription.created`, `.updated`, and `.deleted`. Each event upserts the user's `subscriptions` row from the event payload. The user comes from `metadata.userId`, falling back to the row that already holds the Stripe customer id. `current_period_end` is read from the first subscription item.
- `hasPaidAccess` (`packages/core/src/plan.ts`) is the single paid check: status `active` or `trialing` and a period that has not ended. Everything else counts as free.
- The account page subscription card and both billing routes run when `BILLING_ENABLED=true` or in non-production builds.
- Sandbox and live mode each need their own keys, price, and webhook endpoint. Local testing uses `stripe listen --forward-to localhost:<port>/api/webhooks/stripe`.

---

## 4. API surface

Next.js route handlers. `getSessionUser` (and `getCurrentUserOrGuest`) resolve the caller from an `Authorization: Bearer tmr_…` header when one is present — the header's verdict is final — and fall back to the Auth.js session cookie otherwise, so every route below serves the web app and the browser extension.

| Method | Path | Job |
|---|---|---|
| `*` | `/api/auth/[...nextauth]` | Auth.js |
| `POST` | `/api/auth/token` | Issue an API token (email + password → `tmr_…` bearer) |
| `POST` | `/api/auth/token/revoke` | Revoke the presented token |
| `GET` `POST` | `/api/classrooms` | List (with daily status and free-plan limits), create |
| `GET` `PATCH` `DELETE` | `/api/classrooms/:id` | Read, rename/settings (including the dedicated `paused` transition), delete |
| `POST` | `/api/classrooms/:id/uploads` | Text body or multipart image |
| `GET` | `/api/classrooms/:id/uploads` | Timeline, with each note's re-read state |
| `GET` `PATCH` | `/api/classrooms/:id/uploads/:uploadId` | One note with its live points (line order) and edits left; `PATCH { text }` saves an edit and reads the changed lines again (`202`; `409` while a reading runs; `403 pro_required` past the free cap) |
| `POST` `DELETE` | `/api/classrooms/:id/uploads/:uploadId/reread` | Read the note again, or Try again after a failure; `DELETE` discards a failed re-read |
| `GET` | `/api/classrooms/:id/overview` | Classroom hub: today's daily quiz id, a compose job still in flight from the last hour, on-demand quizzes from the last 24 hours, older untaken ones, and counts of uploads, bank points, and quizzes |
| `GET` | `/api/classrooms/:id/bank` | Counts per category |
| `GET` | `/api/classrooms/:id/knowledge-points` | Every knowledge point, omitted and replaced ones included (`isSuperseded`; the bank screens hide replaced ones), with answered/missed counts |
| `PATCH` | `/api/knowledge-points/:id` | Edit target text, meaning, or note (Pro; `403 pro_required` otherwise); sets `user_edited_at`; `409` on a replaced point |
| `POST` | `/api/knowledge-points/:id/omit` | Omit from (`{ omit: true }`) or restore to future quizzes; `409` on a replaced point |
| `GET` | `/api/classrooms/:id/quizzes/today` | Today's daily quiz plus any in-flight compose job, answers withheld |
| `POST` | `/api/classrooms/:id/quizzes` | Create an on-demand quiz (enqueues a compose job, or reuses the one in flight, and returns its `jobId`) |
| `GET` | `/api/classrooms/:id/quizzes/jobs/:jobId` | Status of one compose job; once `done`, `quizId` names the on-demand quiz it wrote |
| `POST` | `/api/classrooms/:id/quizzes/cancel` | Cancel the in-flight compose job |
| `POST` | `/api/classrooms/:id/exams` | Start writing an exam (Pro, 80+ active points); returns the compose `jobId` to poll |
| `POST` | `/api/classrooms/:id/exams/cancel` | Cancel the exam being written |
| `GET` `DELETE` | `/api/quizzes/:id` | Read the quiz (answers withheld; `?includeAttempts=1` adds attempt summaries) or delete it with its attempts and answers. Reading, attempting, submitting, and the full review below also serve guests, so onboarding can end on a real quiz |
| `POST` | `/api/quizzes/:id/attempts` | Start an attempt |
| `POST` | `/api/attempts/submit` | Submit answers, receive correctness and explanations |
| `GET` | `/api/attempts/:id` | Full review |
| `GET` | `/api/classrooms/:id/mistakes` | The mistake book (Pro): open mistakes with their source quiz, answers withheld |
| `POST` | `/api/classrooms/:id/mistakes/:questionId` | Grade one mistake-book answer (Pro, open mistakes only); returns correctness, the answer, and the explanation |
| `POST` | `/api/classrooms/:id/mistakes/:questionId/tutor` | Ask the AI tutor (Pro, open mistakes only): `mode: "hint"` for the next of up to 3 hints, or `mode: "analysis"` with a wrong `response`; returns the request to poll |
| `GET` | `/api/tutor/:id` | One tutor reply (`pending`, `done`, or `failed`) |
| `GET` `POST` | `/api/attempts/:id/review` | The AI review of an exam attempt (`none`, `writing`, `ready`, or `failed`); `POST` writes it again after a failure (Pro) |
| `GET` `PATCH` | `/api/me` | Profile. `GET` also resolves guests and returns `isGuest`, `hasPassword`, `googleLinked`, the plan, and feature flags. `PATCH { onboarded: true }` records that onboarding is done |
| `GET` | `/api/me/overview` | Account hub: activity and learning stats, recent quizzes, membership, and this week's usage |
| `GET` `PATCH` | `/api/me/email-preferences` | |
| `GET` | `/api/me/export` | Data export |
| `DELETE` | `/api/me` | Account deletion |
| `GET` `POST` | `/api/me/tokens` | List, create API tokens (create returns the raw token once) |
| `DELETE` | `/api/me/tokens/:id` | Revoke a token |
| `GET` | `/api/me/referrals` | Codes and status |
| `POST` | `/api/webhooks/stripe` | |
| `GET` | `/unsubscribe?token=` | One click, no login |

Answers and explanations never leave the server before a submission. The quiz payload carries stems and options only. A browser-local draft holds the learner's own responses and position between refreshes.

The quiz payload also carries `sources` (upload id, subject, and added-at timestamp), deduplicated through its questions' knowledge points. This metadata links reviews to original lesson notes without serializing prepared answers or explanations. Bank items carry `sourceUploadId` for the same navigation. The classroom overview includes `latestReview`, the latest daily/manual attempt submitted on the reader's current local date; exams do not set this completion state. These fields derive from existing rows and require no schema migration.

---

## 5. Multi-tenancy and security

- Every query goes through a repository layer that takes `user_id` and scopes by it. Ownership is enforced in the data layer, so a forgotten UI check is not a breach.
- Image reads use short-lived signed URLs.
- Upload limits: 10 MB per image, 50 uploads per user per day.
- LLM calls capped per user per day, so a runaway script cannot drain the DeepSeek balance.
- Passwords hashed with argon2id. Email verification required before the first upload.
- Session cookies: httpOnly, secure, sameSite lax. API tokens for native clients are stored hashed and revoked on demand.
- The browser extension keeps its token in `browser.storage.local` and revokes it on sign-out. Tokens are created and inspected at Account → API tokens, which also serves Google-only accounts that cannot use the password-based `/api/auth/token`.

---

## 6. Deployment

| Concern | Where |
|---|---|
| Web and SPA | Vercel (one project, one `next build`) |
| Postgres | Neon |
| Worker | Render free web service, kept awake through the 7:00 AM Eastern send by a GitHub Actions keep-alive |
| Images | Vercel Blob |
| Email | Resend (or Brevo), from `contact.tenminutesreview.study`: Vercel sends account email as `no-reply@`, the worker sends the daily quiz as `quiz@` (each deploy sets its own `EMAIL_FROM`) |
| Domain | `tenminutesreview.study`, registered and DNS at Namecheap |

The same app also runs as Docker images on any server; [SELF-HOSTING.md](SELF-HOSTING.md) covers that path.

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
STRIPE_PRICE_ID
BILLING_ENABLED
ADMIN_EMAILS
APP_URL
```

For local billing tests, set `STRIPE_MODE=sandbox` with `STRIPE_SANDBOX_SECRET_KEY`, `STRIPE_SANDBOX_WEBHOOK_SECRET`, and `STRIPE_SANDBOX_PRICE_ID`. The web app then uses those instead of the live keys. Vercel production ignores `STRIPE_MODE`.

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
