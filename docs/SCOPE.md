# Scope

**Brand:** Ten Minutes Review · **Repo folder:** `ten-minutes-review`
**Status:** locked. No open items. Items marked *(my call)* are decisions made on the builder's behalf — override any of them.

## What it is

A web app that turns a tutoring session's notes — text or images — into a daily quiz that takes under 10 minutes. The user answers on the site, and can optionally receive the quiz by email every morning. Every quiz belongs to a classroom.

## Classrooms

- A **classroom** = one note set + one question bank + one daily quiz series.
- A user owns multiple classrooms. Classrooms are private to their owner.
- **Notes can be added any time.** New notes are processed into the classroom's question bank and become eligible for later daily quizzes.
- **Automatic dormancy:** a classroom is active while notes have been uploaded within the last **7 days**. Active classrooms receive scheduled daily reviews. After 7 quiet days the classroom goes dormant and its scheduled reviews stop. Logging in brings it back to active.
- **Manual pause:** each classroom can independently pause scheduled quiz composition and its entry in the morning email. Pausing never archives or removes the classroom, and notes, uploads, the bank, history, existing quizzes, and on-demand quiz creation keep working. Only an explicit Resume action clears a manual pause; sign-in, opening the classroom, and uploads do not.
- Resuming before the fixed 7:00 AM Eastern send makes the classroom eligible that morning. Resuming at or after the cutoff waits until the following morning. Resume also refreshes the automatic activity window.
- Classroom settings expose the auto-stop window, defaulting to 7 days.

## Notes & uploads

- Input is typed/pasted text and **handwritten note images**.
- Images are the same kind of material as text notes — just handwritten. OCR/vision processing reads them and produces knowledge points for the bank.
- Uploads are **retained**. The user browses every past upload as a timeline, behind a history (clock) control on the classroom.
- Image upload serves other users, not the primary user, who types notes. Both paths are in MVP.

## Question generation

- **LLM: DeepSeek (flash model).** No cost or rate constraint. The backend talks to it through one adapter module so the provider can change in one place.
- **Question bank:** the backend builds and extends the bank at upload time, distilling notes into **knowledge points** tagged by category and language. Each day's quiz is **composed fresh from the bank**, so questions vary day to day. See `PROMPTS.md`.
- **Content categories — the fixed set, derived from a real session:**
  1. **Vocabulary** — single terms and their glosses
  2. **Phrases & chunks** — fixed multi-word expressions
  3. **Grammar & structure** — noun↔adjective, gender, agreement, tense, prepositions
  4. **Ideas & expression** — full sentences, opinions, narratives
  5. **Comprehension** — a passage from the session, with questions about it
- The AI picks the question type that best serves each category.
- **Question types:** MCQ, fill-in-the-blank, true/false, image-based. Short answer is out of scope.
  - *(my call)* **Image-based** questions present the retained note image — the handwritten snippet — and ask about it. They appear only in classrooms that have image uploads.
- **Vocabulary runs both directions,** weighted toward production: recognition (target→native) and production (native→target), with production asked more often. Recognition questions are easier and would flatter the learner.
- **Languages:** the top 11 spoken languages — Mandarin, Spanish, English, Hindi, Portuguese, Bengali, Russian, Japanese, Vietnamese, Korean, French. Questions are asked in the language of the notes; a tooltip shows the question in the user's UI language.
- **Extraction must tolerate mess.** Real notes carry no consistent separator, entries with no gloss, misspellings, and garbled lines. The model has to be free to discard a line as unusable. This is a hard requirement — a strict parser produces questions built on nonsense.
- **Grammar needs meta-commentary reading.** Catching a teaching point like "noun et adjective différence" means interpreting the notes, not just extracting term pairs.

## The daily quiz

- **One *daily* quiz per classroom per day**, plus on-demand quizzes the user creates whenever they like. Several on-demand quizzes can exist on one day.
- **Length scales with the bank, capped at 20 questions.** *(my call on the formula: `min(20, max(8, floor(bank_size / 8)))` — a 60-question bank gives 8, a 100-question bank gives 12, and the cap holds from 160 up.)*
- **The 10-minute promise is the binding constraint.** 20 is a ceiling, not a target; a quiz heavy on fill-in-the-blank questions stays shorter than one made of quick MCQs.
- **Composition:** newest material first within the 7-day window, plus light re-tests of knowledge points the user missed, reworded as a new question. Full spaced repetition stays out of MVP.
- **Attempts:** unlimited for now. Every attempt is recorded — answers, correctness, time taken. The answer and explanation are revealed after submit.
- **Deleting a quiz:** the quizzes list carries a Delete control. Confirming removes the quiz, its questions, and every attempt against it. A deleted daily quiz stays gone for that day; the scheduler does not compose a replacement.
- On the web, quizzes stay available on demand after a classroom goes dormant or is manually paused. Scheduled emails stop; access continues. On-demand quizzes are unlimited for now. Each creation is counted over rolling 24-hour, 7-day, and 30-day windows so fair-use limits can be introduced later.
- **On-demand quizzes** are created from the classroom home: a button opens a small progress modal (Queued → Writing your quiz → Ready) that can be minimized into the card or cancelled. Cancelling never counts and writes no quiz. Each generated on-demand quiz sends its own email with just that quiz, subject to the same email preferences. It appears in the quizzes list tagged "On demand".
- **Validated:** one real session yields roughly 110–150 knowledge points and questions — comfortably 7 days of quizzes. The 7-day window matches one session per week. Evidence in `TRIAL-RUN.md`.

## Emails

- One email per user each morning, at one fixed time: **7:00 AM Eastern**. The user's timezone is stored only to show that time on the web.
- With multiple classrooms, the email presents a **menu** of that day's classroom quizzes; the user picks one to enter.
- The email **carries the questions inline** and links to the web for interactive answering. It is a portal, not just a notification. Answering mentally without clicking is a valid path; nothing is recorded in that case.
- Sends are on by default and come with unsubscribe. Sending requires at least one active classroom.
- Account-wide email preferences and unsubscribe remain authoritative over every classroom. A classroom pause is narrower: it changes only that classroom and never changes those account settings.
- **On-demand quizzes** send their own email when generated: just that quiz, with the same preferences and unsubscribe gate as the morning email.

## Accounts & auth

- **Email is the identifier.** Username is display-only, shown beside the avatar.
- Google OAuth plus email/password, with email verification and password reset.
- **Sign-ups:** open to the public, invite-only for now.
- **Account center:** usage stats (activity and learning insight from stored attempts), profile (username, avatar, password, email), subscription status, classroom management, quiz history and results, referral stats and links, email preferences, data export, delete account.

## Plans, limits & billing

- **$2.99 USD per month.**
- Billing runs on **Stripe**. The payment UI is inactive and hidden, shown in debug builds only. The full subscription lifecycle — plan, status, cancel, webhooks — is modeled now and built later.
- **Free tier:** 3 classrooms, 5 attempts *(my call: per quiz per day)*, quiz-type selection is a paid feature. Enforcement is deferred; the fields exist.
- **Notes uploads:** free users, and paid users whose subscription has lapsed or been canceled, get 2 notes uploads per calendar month (in their timezone), shared across all classrooms. Each image counts as one upload. Paid access means a subscription with status `active` or `trialing` whose current period has not ended. This cap and the 3-classroom cap are enforced now.

## Referrals

- Reward is **one free month**.
- *(my call)* The referrer earns one free month per successful referral, and the referred user receives one free month as well. One-time per referred account, tracked by a unique referral link/code.

## Stack & infrastructure

- **Next.js + TypeScript + Postgres**, Auth.js for auth, Stripe for billing. Confirmed, no constraints. *(my call: Auth.js — it covers Google OAuth natively, with our own token flows for verification and reset.)*
- *(my call)* **Hosting:** Vercel for the app, managed Postgres (Neon), a small worker service for scheduled jobs, Brevo (or Resend) for email, domain purchased at deploy. Full detail in `TECHNICAL.md`.
- *(my call)* **Email scheduling:** one fixed send instant (7:00 AM Eastern) for everyone; a scheduler runs frequently, picks classrooms due that day, and enqueues the send — idempotent per user per day, with same-day catch-up when the worker wakes late.

## MVP vs deferred

- **MVP:** auth, classrooms, note upload (text + images), question bank + generation, daily quiz on web and by email, on-demand quizzes from the classroom home, attempt recording, answer review, upload history.
- **Deferred, modeled but unbuilt:** payment UI, referral UI, tier-cap enforcement, quiz-type selection, full spaced repetition.

---

## My calls — override any

1. Question bank built at upload, daily quiz composed fresh from it.
2. Hosting: Vercel + Postgres (Neon) + worker + Brevo (or Resend).
3. Auth.js as the auth library.
4. Referral is reciprocal: both sides get one free month.
5. Free-tier "5 attempts" means 5 per quiz per day.
6. Logging in reactivates a dormant classroom and resumes its emails.
7. Target language is auto-detected from the notes and editable by the user; the UI language lives on the profile.
8. Quiz size formula: `min(20, max(8, floor(bank_size / 8)))`, with the 10-minute budget overriding it.
9. Image-based questions show the retained handwritten note image and only exist in classrooms with image uploads.
10. The interface ships in English and French. The profile's UI language drives the web UI and transactional emails; signed-out visitors get the browser language.
