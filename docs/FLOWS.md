# Flows

Screen-by-screen behaviour. This is what each screen does, not how it looks.

---

## 1. Sign up

**Entry:** the landing page, or an invite link.
**Gate:** an invite code is required while the product is invite-only.

1. The user enters an invite code, or arrives with one already in the link.
2. They choose Google or email plus password.
3. Email sign-up sends a verification link. Google sign-up arrives verified.
4. First sign-in creates the user row. A referral row is written if the invite code belonged to an existing user.
5. `ui_language` starts from the browser's `Accept-Language`. `timezone` starts from the browser. Both stay editable in the account center.

An invite code that has already been fully redeemed still works — codes are unlimited-use while the product is invite-only. The code exists to gate access, and to credit referrals.

## 2. Sign in

Google or email plus password. Forgot-password sends a reset link. After sign-in the user lands on the classroom list, or on the last classroom they opened.

---

## 3. Empty state

**Shown when:** the user owns no classrooms.

Explains the product in one line and offers a single action: create a classroom. This is the only screen a new user sees with no quiz and no notes, so it carries the explanation.

## 4. Create a classroom

A form with two fields:

- **Name** — free text, e.g. "French with Marie".
- **I'm learning** — the target language, one of the eleven supported.
- **I speak** — the native language, defaulted from `ui_language`.

Both languages stay editable, and extraction corrects them if the notes disagree. On save the classroom opens to its empty home.

## 5. Classroom home

The default screen once a classroom exists. Shows:

- **Bank summary** — a count of knowledge points per category. Empty before the first upload.
- **Today's quiz** — take the daily quiz, or create one on demand. While a quiz is being written, the card shows live progress with Minimize and Cancel; when it is ready, it offers Take quiz. With an empty bank the button explains what to add first.
- **Recent quizzes** — the five latest quizzes, each tagged Daily or On demand, with Take on ones not yet attempted.
- **Unfinished** — up to three on-demand quizzes not taken yet, each one tap away.
- **Add notes** — the primary action.
- **History** — a clock control that opens the upload timeline.
- **Settings** — name, languages, the auto-stop window, and a separate Daily reviews card with Pause or Resume.

A dormant classroom shows a banner here: emails have stopped, add notes or open the classroom to resume them. A manually paused classroom instead shows a paused banner and keeps that status even when the classroom is opened or notes are uploaded.

## 6. Upload notes

Two inputs on one screen:

- **Paste or type text.**
- **Attach images** — photos of handwritten notes, up to 10 MB each.

The user submits. The upload row is written immediately and the screen moves to the processing state. Nothing blocks on the LLM.

## 7. Processing

Shown while `extraction_status` is `pending` or `running`.

- A short line: the notes are being read.
- The user can leave, close the tab, or upload more. Extraction continues in the worker.
- On completion the bank summary updates and a count appears: how many points were added, and how many lines were skipped.
- The skipped count is shown, not hidden. It reassures the user that `au bibeau` was ignored on purpose.

On failure the upload shows an error with a retry action. The uploaded material is never lost.

## 8. Upload timeline

Opened from the clock control on the classroom.

One row per upload, newest first: date, kind (text or image), the AI-written subject line naming the topic (falling back to the first line of the text or a thumbnail of the image until extraction finishes), the count of points extracted, and the discard count. Tapping a row shows the original material in full — for an image, the image itself.

This is the classroom's memory. Everything the user ever fed in stays readable here.

## 9. Daily quiz — entry

**Two doors:**

- **From the email.** The email carries the questions inline, plus a link. The link opens the web quiz. If the user is signed out, it routes through sign-in and returns them to the quiz.
- **From the site.** The classroom home shows today's quiz. A list of classrooms, each showing whether today's quiz is ready.

**On demand.** The classroom home can create a quiz at any time. A small modal shows progress (Queued → Writing your quiz → Ready), can be minimized back into the card, and can be cancelled. A ready quiz never redirects on its own — the user taps Take quiz. Each on-demand quiz also sends an email carrying just that quiz, subject to the user's email preferences, and stays tagged On demand everywhere.

**With several classrooms:** the site shows a menu, one entry per classroom with today's quiz available. The user picks one. One classroom per day is the intended rhythm — the others stay available, and their quizzes keep accumulating.

## 10. Taking the quiz

- Questions are presented one at a time, with progress shown.
- Each question is answerable and changeable until the whole quiz is submitted. Nothing is revealed along the way.
- **Submit** is the commit point. An attempt row is created, answers are written, and grading runs server-side.
- The timer records how long the attempt took, per question and overall. A refresh keeps it running.
- Answers and the current question live in a local draft, so a refresh or a same-browser reopen resumes where the quiz left off.
- Enter advances on every question type: in fill-in-the-blank questions it moves to the next blank first, then to the next question; on the last question it submits the quiz. Multiple-choice options receive focus when their question opens, and Up/Down selects through them without requiring a click.
- Multiple-choice options are shuffled for each attempt, remain stable when an in-progress draft is restored, and never repeat the immediately previous attempt's order when at least two options exist.

Attempts are unlimited. The server records an attempt only at submit, so a quiz is never half-recorded; the local draft expires two hours after it starts.

## 11. Results and review

After submit:

- **Score** — correct out of total.
- **Per question:** the user's answer, the correct answer, and a one-sentence explanation of why. Wrong answers are marked plainly, without scolding.
- **Retake** — starts a fresh attempt on the same quiz. The previous attempt stays in history.
- Every attempt is kept, so the same quiz can show three attempts with three scores.

## 12. Quiz history

Per classroom: past quizzes by date, each tagged Daily or On demand and showing the best score and the attempt count. Tapping one opens its questions and every attempt made against it. This is where a learner sees a category they keep missing.

Each row also carries a **Delete** control. Confirming removes the quiz, its questions, and every attempt made against it. A deleted daily quiz stays gone for that day — no replacement is composed.

## 13. Dormant classroom

A classroom goes dormant 7 days after the last upload, or after the last login, whichever is later.

**While dormant:**

- No daily email for that classroom.
- The web quiz keeps working on demand, for free users once per day.
- The classroom home shows the dormant state and two ways back: add notes, or just open the classroom — the act of opening it restarts the window.

Dormancy deletes nothing. The bank, the uploads, and the history all stay, apart from quizzes and classrooms the learner removes.

## 14. Manually paused classroom

Pause and Resume live only in the classroom's Settings screen. Manual pause takes visual precedence over dormancy.

**While paused:**

- Automatic daily quiz composition stops, and the classroom is omitted from the consolidated morning email.
- Notes, uploads, the question bank, history, existing quizzes, and on-demand quiz creation remain available.
- Existing daily quizzes are not deleted. On-demand quiz emails continue to follow the account's email preferences.
- Sign-in, opening the classroom, and uploading notes may extend `active_until`, but never clear the pause.

Resume is the only action that clears the pause. It refreshes `active_until` to at least the current time plus the classroom's auto-stop window. A resume before 7:00 AM Eastern can join that morning's send; a resume at or after 7:00 AM waits until the next morning and never triggers a same-day catch-up.

## 15. Account center

One page, read-first: account details, usage stats, and history are visible at a glance, and each editable section shows an **Edit** control that expands its form in place.

Sections:

- **Activity and learning** — quizzes taken, questions answered, accuracy, time studied, active days in the last 30, accuracy by category (weakest first), recent misses, and a sparkline of the last ten attempts. Computed live from stored attempts, free for everyone.
- **Profile** — username, avatar, email, password, UI language (English or French), timezone. Changing the UI language takes effect immediately across the interface and future emails.
- **Subscription** — current plan and status. **Debug builds only** while billing is inactive.
- **Classrooms** — the list, with archive and delete.
- **Quiz history** — a cross-classroom view.
- **Referrals** — the user's code, the share link, and who signed up with it.
- **Email preferences** — daily email on or off, unsubscribe, and the next send time in the user's timezone.
- **Data** — export everything, or delete the account.

Account deletion removes classrooms, uploads, knowledge points, quizzes, attempts, and stored images. A confirmation step names what will be lost.

## 16. Email preferences and unsubscribe

- The daily email goes out at one fixed time, 7:00 AM Eastern, for everyone. The account page and the classroom home show the next send in the user's timezone, with UTC in parentheses.
- Turning the daily email off is immediate and affects every classroom.
- Account-wide email off/unsubscribe and per-classroom pause are independent. Pause/Resume never changes the account preference, and an account-wide opt-out still blocks daily and on-demand email according to the existing email rules.
- Every email carries a one-click unsubscribe link that needs no sign-in. It lands on a page confirming the change, with a link back to settings.

---

## Flow summary

| Flow | Trigger | Ends when |
|---|---|---|
| Sign up | Invite code | User row exists, email verified |
| Create classroom | Empty state or account center | Classroom opens |
| Upload notes | Add notes action | Points appear in the bank |
| Daily quiz | Morning email, or the site | Attempt recorded |
| Review | After submit | Explanations shown |
| Reactivate | Opening a dormant classroom | `active_until` moves forward |
| Pause daily reviews | Classroom Settings | `paused_at` is set; daily compose jobs are cancelled or asked to cancel |
| Resume daily reviews | Classroom Settings | `paused_at` clears, `daily_resumed_at` is set, and `active_until` is refreshed |
| Unsubscribe | Any email | `unsubscribed_at` set |
