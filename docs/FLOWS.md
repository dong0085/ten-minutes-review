# Flows

Screen-by-screen behaviour. This is what each screen does, not how it looks.

The signed-in app drills down. Each screen does one job; a breadcrumb trail in the top bar (Classrooms › French with Marie › Question bank › *manger*) leads back up, and on phones a back arrow returns to the parent. There are no tab strips.

---

## 1. Sign up

**Entry:** the landing page, or a referral link (`/signup?code=…`).
**Gate:** none. Sign-up is open to everyone.

1. The user chooses Google or email plus password.
2. Email sign-up sends a verification link. Google sign-up arrives verified.
3. First sign-in creates the user row. A referral row is written when the user arrived through a referral link.
4. `ui_language` starts from the browser's `Accept-Language`. `timezone` starts from the browser. Both stay editable in Account → Profile.

Referral codes are unlimited-use. They credit the referrer and leave access unchanged.

## 2. Sign in

Google or email plus password. Forgot-password sends a reset link. After sign-in the user lands on the classroom list, or back on the screen that sent them to sign in.

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

## 5. Classroom hub

The default screen once a classroom exists. It answers one question — what do I do today? — and leads to everything else one level down. Shows:

- **Header** — the classroom name, its language pair, and its status stamp (Active, Dormant, Paused).
- **Today's quiz** — take the daily quiz, or create one on demand. While a quiz is being written, the card shows live progress with Minimize and Cancel; when it is ready, it offers Take quiz. With an empty bank the button explains what to add first.
- **Add notes** — the primary action; opens the Add notes screen.
- **Unfinished** — up to three on-demand quizzes not taken yet, each one tap from the quiz runner.
- **In this classroom** — one row per deeper screen, each with a count:
  - **Notes** — uploads so far and when the last one arrived, plus a badge while notes are being read.
  - **Question bank** — knowledge points currently in quizzes.
  - **Quizzes** — quizzes so far.
  - **Settings** — name, languages, the auto-stop window, quiz length, and Daily reviews. Quiz length is a row of five steps (`<<` `<` `*` `>` `>>`, about 5 to 20 minutes) that saves on click or arrow key and applies to quizzes composed afterwards.

A dormant classroom shows a note under the header: emails have stopped, add notes or open the classroom to resume them. A manually paused classroom instead shows a paused note and keeps that status even when the classroom is opened or notes are uploaded.

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

## 8. Notes

Opened from the Notes row on the classroom hub.

One row per upload, newest first: date, kind (text or image), the AI-written subject line naming the topic (falling back to the first line of the text or a thumbnail of the image until extraction finishes), the discard count, and its reading status. The list refreshes itself while anything is still being read. Tapping a row opens that upload on its own screen with the original material in full — for an image, the image itself — plus the discard count and any extraction error.

This is the classroom's memory. Everything the user ever fed in stays readable here.

## 8b. Question bank

Opened from the Question bank row on the classroom hub.

One row per knowledge point, newest first: the target text, its meaning, category, an Inferred badge when the AI filled in the meaning, and how often the learner answered and missed questions built on it. A search box matches target text, meaning, and note. Category chips and an In quizzes / Omitted / All switch narrow the list; it opens on In quizzes. The search and filters live in the address, so stepping into a point and back returns to the same list.

Each row carries a quick **Omit / Restore** switch — the same switch as the review screen's omit control. Omitted points stay listed under Omitted and drop out of future composition; Restore brings them back.

Tapping a row opens the knowledge point on its own screen: its category and badges, the answered/missed record, Omit / Restore, the source excerpt from the notes, and an edit form for the target text, meaning, and note. The category stays fixed, since grammar and comprehension points carry structured detail tied to it. Edits reach quizzes composed afterwards; past quizzes keep their wording.

Omit is the removal path. Past quiz questions and attempts hang off each knowledge point, so the bank keeps every point it ever produced.

## 9. Daily quiz — entry

**Two doors:**

- **From the email.** The email carries the questions inline, plus a link. The link opens the web quiz. If the user is signed out, it routes through sign-in and returns them to the quiz.
- **From the site.** The classroom hub shows today's quiz. A list of classrooms, each showing whether today's quiz is ready.

**On demand.** The classroom hub can create a quiz at any time. A small modal shows progress (Queued → Writing your quiz → Ready), can be minimized back into the card, and can be cancelled. A ready quiz never redirects on its own — the user taps Take quiz. Each on-demand quiz also sends an email carrying just that quiz, subject to the user's email preferences, and stays tagged On demand everywhere.

**With several classrooms:** the site shows a menu, one entry per classroom with today's quiz available. The user picks one. One classroom per day is the intended rhythm — the others stay available, and their quizzes keep accumulating.

## 10. Taking the quiz

- The quiz runner fills the screen: no top bar, one close control back to the quiz.
- The quiz is one exam paper: every question sits on the page, numbered, so the learner can read the whole quiz first and answer in any order. The paper carries the product name, the classroom, the date, the instructions, and an empty Score box. Questions are grouped into parts by type — I. Multiple choice (image questions included), II. True or false, III. Fill in the blanks — keeping their order inside each part and numbered straight through the paper; a part with no questions is left out. Each part is worth fixed points per question — multiple choice 2, true or false 1, fill in the blanks 3 — shown beside each part and each question, with the paper's full marks in the header. Points live on the paper only; the attempt score everywhere else stays correct out of total. The header also carries the suggested time from the classroom's quiz length and an empty score table (one column per part, plus the total). The attempt review and the quiz email use the same parts and numbers. A Print button in the bar prints the paper alone, blank or graded. Choices are answer bubbles, and fill-in blanks are written on the line inside the sentence. Each question keeps its category and "I've got this down" control. A sticky bar below the paper shows how many are answered and holds Submit.
- Each question is answerable and changeable until the whole quiz is submitted. Nothing is revealed along the way.
- **Submit** is the commit point. The sheet flies up off the screen while grading runs. An attempt row is created, answers are written, and grading runs server-side.
- The timer records how long the attempt took, per question and overall. Time counts toward the question the learner last touched. A refresh keeps it running.
- Answers and the last-touched question live in a local draft, so a refresh or a same-browser reopen scrolls back to where the quiz left off.
- Enter advances on every question type: in fill-in-the-blank questions it moves to the next blank first, then to the next question, scrolling it into view; on the last question it moves to Submit, so a second Enter submits. Up/Down selects through multiple-choice options without requiring a click.
- Multiple-choice options are shuffled for each attempt, remain stable when an in-progress draft is restored, and never repeat the immediately previous attempt's order when at least two options exist.

Attempts are unlimited. The server records an attempt only at submit, so a quiz is never half-recorded; the local draft expires two hours after it starts.

## 11. Results and review

After submit, the same sheet drops back down graded, with the marks written on it in red pen:

- **Score** — the teacher fills in the score table in red: points earned per part and in total, the same number beside each part heading, and the time taken next to full marks. The bar keeps correct out of total.
- **Deductions** — each wrong question shows the points lost (−2, −3) under its cross.
- **Per question:** a tick or a cross beside the question, the correct option or True/False circled, a wrong choice struck through, the correct fill-in written under the blank, and a one-sentence explanation of why. Wrong answers are marked plainly, without scolding.
- **Retake** — starts a fresh attempt on the same quiz. The previous attempt stays in history.
- Every attempt is kept, so the same quiz can show three attempts with three scores.

## 12. Quizzes

Opened from the Quizzes row on the classroom hub. Past quizzes by date, each tagged Daily or On demand and showing the best score and the attempt count.

Tapping one opens the quiz on its own screen: its date and size, the categories it covers, a Take quiz (or Retake) button, and every attempt made against it with score, duration, and submission time. Tapping an attempt opens its full review. This is where a learner sees a category they keep missing.

The quiz screen also carries a **Delete** control. Confirming removes the quiz, its questions, and every attempt made against it, and returns to the list. A deleted daily quiz stays gone for that day — no replacement is composed.

## 12b. Exam

A longer paper that checks what has stuck, for Pro members.

- **Unlock.** The classroom hub carries an Exam card. Below 80 active knowledge points it shows progress toward 80; at 80 it says the bank is ready. That card is the reminder — nothing is sent.
- **Pro only.** A free member sees the Start button locked with the Pro badge; tapping it explains what Pro adds and offers checkout.
- **Writing.** Start an exam writes one in the background (about a minute) with Cancel; the card turns into Take the exam when it is ready. An untaken exam keeps offering Take the exam.
- **The paper.** Always 40 questions worth 100 points: I. Multiple choice, 20 × 2; II. True or false, 10 × 2; III. Fill in the blanks, 10 × 4. Suggested time 30 minutes. It covers the whole bank, recent misses first. No email is sent.
- **Answer sheet.** Beside the paper sits an optical answer card printed in the theme's ink: name, subject, date, a candidate-number grid, pencil rules with correct and incorrect mark samples, a barcode, and timing marks down the edge. Choice and true-or-false rows come in blocks of five; fill-in answers show in written boxes. Marking a bubble answers the question on the paper, answering on the paper fills the bubble in pencil, and changing an answer leaves a faint eraser smudge. Tapping a row number jumps to that question. On a phone the card opens from the bar. After grading, the card shows the score, circles each right answer, and flags each wrong row.
- **AI review.** When the graded paper drops back with mistakes on it, a comment slip clipped under the header reads "Reading your mistakes…" for about half a minute, then shows the AI's review: a short overview, one to four patterns across the wrong answers — each quoting what the learner wrote, the rule behind it, and the question numbers it covers, which jump to those questions — and what to practise next. The red-pen notes on each question stay as they are. The same slip heads the full review. If writing fails, the slip offers Try again. A perfect paper gets no slip.
- An exam is taken, graded, retaken, and reviewed like any quiz, and appears in the quizzes list tagged Exam.

## 12c. Corrections

A Pro member's running list of what they got wrong, per classroom.

- **Where.** The classroom hub lists Corrections (错题本, carnet d'erreurs) under "In this classroom", with the number of questions left to correct. A free member sees the row with a Pro badge; the page explains Pro and offers checkout.
- **What is in it.** Every question missed in a quiz or exam over the last 30 days, oldest first, shown exactly as it was asked, with where it came from (date and quiz, daily quiz, or exam) and how many times it has been missed. Options come in a fresh order.
- **Correcting.** The page is a ruled exercise book with a red margin. Each question has a Check button; Enter checks too. A right answer gets a red tick and a Corrected stamp and leaves the book. A wrong one gets the usual red-pen marks — the right option circled, the wrong answer struck through, the explanation — and a Try again button. A progress bar counts the corrections.
- **AI tutor.** Under each question sits the tutor, written in the theme's ink on a sticky note so it reads apart from the red pen. Before answering, "Get a hint" gives up to three hints, each closer than the last, none giving the answer away. After a wrong answer, "Explain my mistake" says what the answer shows the learner believes, the rule that decides it, one or two fresh examples, and a check for next time. The red-pen marks always show on their own; the tutor only answers when asked. Replies stay with the question while it is in Corrections.
- **Coming back.** A corrected question returns if a later quiz misses it again. Getting a question right on a retake also clears it. Anything whose last miss is older than 30 days drops out.

## 13. Dormant classroom

A classroom goes dormant 7 days after the last upload, or after the last login, whichever is later.

**While dormant:**

- No daily email for that classroom.
- The web quiz keeps working on demand, for free users once per day.
- The classroom hub shows the dormant state and two ways back: add notes, or just open the classroom — the act of opening it restarts the window.

Dormancy deletes nothing. The bank, the uploads, and the history all stay, apart from quizzes and classrooms the learner removes.

## 14. Manually paused classroom

Pause and Resume live only in the classroom's Settings screen. Manual pause takes visual precedence over dormancy.

**While paused:**

- Automatic daily quiz composition stops, and the classroom is omitted from the consolidated morning email.
- Notes, uploads, the question bank, history, existing quizzes, and on-demand quiz creation remain available.
- Existing daily quizzes are not deleted. On-demand quiz emails continue to follow the account's email preferences.
- Sign-in, opening the classroom, and uploading notes may extend `active_until`, but never clear the pause.

Resume is the only action that clears the pause. It refreshes `active_until` to at least the current time plus the classroom's auto-stop window. A resume before 7:00 AM Eastern can join that morning's send; a resume at or after 7:00 AM waits until the next morning and never triggers a same-day catch-up.

## 15. Account

A hub, read-first: activity and learning stats and recent quizzes at a glance, then one row per settings screen.

- **Activity and learning** — quizzes taken, questions answered, accuracy, time studied, active days in the last 30, accuracy by category (weakest first), recent misses, and a sparkline of the last ten attempts. Computed live from stored attempts, free for everyone.
- **Quiz history** — the most recent quizzes across classrooms, each opening its quiz screen.

Settings screens, one job each:

- **Profile** — username, UI language, timezone. Changing the UI language takes effect immediately across the interface and future emails.
- **Sign-in & security** — password, and the linked Google account.
- **Email** — daily email on or off, unsubscribe status, and the next send time in the user's timezone.
- **Plan & usage** — current plan and status, this month's usage against the free limits, and the Stripe checkout or billing portal. Stripe returns here.
- **Referrals** — the user's code, the share link, and who signed up with it.
- **API tokens** — create and revoke tokens for the browser extension.
- **Your data** — export everything, or delete the account.

Classrooms are managed from the classroom list and each classroom's Settings.

Account deletion removes classrooms, uploads, knowledge points, quizzes, attempts, and stored images. A confirmation step names what will be lost.

## 16. Email preferences and unsubscribe

- The daily email goes out at one fixed time, 7:00 AM Eastern, for everyone. The Email screen and the classroom hub show the next send in the user's timezone, with UTC in parentheses.
- Turning the daily email off is immediate and affects every classroom.
- Account-wide email off/unsubscribe and per-classroom pause are independent. Pause/Resume never changes the account preference, and an account-wide opt-out still blocks daily and on-demand email according to the existing email rules.
- Every email carries a one-click unsubscribe link that needs no sign-in. It lands on a page confirming the change, with a link back to settings.

---

## Flow summary

| Flow | Trigger | Ends when |
|---|---|---|
| Sign up | Landing page or referral link | User row exists, email verified |
| Create classroom | Empty state or classroom list | Classroom hub opens |
| Upload notes | Add notes action | Points appear in the bank |
| Daily quiz | Morning email, or the site | Attempt recorded |
| Review | After submit | Explanations shown |
| Reactivate | Opening a dormant classroom | `active_until` moves forward |
| Pause daily reviews | Classroom Settings | `paused_at` is set; daily compose jobs are cancelled or asked to cancel |
| Resume daily reviews | Classroom Settings | `paused_at` clears, `daily_resumed_at` is set, and `active_until` is refreshed |
| Unsubscribe | Any email | `unsubscribed_at` set |
