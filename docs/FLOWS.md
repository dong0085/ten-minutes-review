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

**Entry:** the "Sign in" button in the top bar, beside "Sign up", on every screen a visitor or guest sees, and the link under the landing page's hero.

Google or email plus password. Forgot-password sends a reset link. After sign-in the user lands on the classroom list, or back on the screen that sent them to sign in.

---

## 3. Onboarding

**Shown when:** a visitor, guest, or new account owns no classrooms and has not finished or skipped onboarding. The landing page's "Try it" button opens it at `/classrooms/start`, and the classroom list sends such users there. Accounts created before onboarding existed count as onboarded.

A full-screen welcome followed by two steps, with a two-part progress line and "Skip for now" in the header:

1. **Welcome** — explain reviewing between language lessons: choose a language, add lesson notes, then keep practising before the next lesson.
2. **Language** — eleven cards, each greeting in its own script; the chosen one flies into the header as a chip. "I speak" defaults to the interface language. Continue goes directly to notes. A secondary "See how a review works" action opens the existing seven-stop sample-paper tour; finishing it also goes to notes.
3. **Your notes** — pasted text by default, or a photo (one for a guest), with sample notes in the chosen language when no notes are at hand. A line count under the text box suggests one item per line; onboarding skips the upload preview to keep the first run quick. Submitting creates the classroom ("My Spanish"), uploads the notes, shows them being read, then the points found. "Start my first review" writes an on-demand quiz and opens it in the runner. Guests can practise now and create an account to retain notes and receive daily emails.

Skipping, or creating the classroom, marks onboarding done: on the account for a signed-in user, in the browser for a visitor.

## 3b. Empty state

**Shown when:** the user owns no classrooms and has finished or skipped onboarding.

Explains the product in one line and offers a single action: create a classroom.

## 4. Create a classroom

A form with two fields:

- **Name** — free text, e.g. "French with Marie".
- **I'm learning** — the target language, one of the eleven supported.
- **I speak** — the native language, defaulted from `ui_language`.

Both languages stay editable, and extraction corrects them if the notes disagree. On save the classroom opens to its empty home.

## 5. Classroom hub

The default screen once a classroom exists. It is built around the four reasons people open a classroom: take today's quiz, add notes, check their quizzes and exams, and take an exam. Shows:

- **Header** — the classroom name, its language pair, and its status stamp (Active, Dormant, Paused).
- **Today's quiz** — a mailbox in the middle of a large card, with a handwritten line above it and today's date in handwriting below. When there is somewhere to go, the whole card is one link: hovering or focusing it slides the dated quiz sheet out, raises the flag, and lifts the button. The card is only about today's daily quiz:
  - **Ready** — "Your quiz is here", the quiz length, and Open; the card opens the quiz.
  - **Taken** — once today's daily quiz has an attempt: "Done for today", the sheet sits out of the box stamped with the latest score, and the card opens that attempt's review.
  - **No quiz yet** — an empty box with the next delivery time in the learner's timezone, UTC in parentheses. The card is informational.
  - **Notes being read** — "Reading your notes…" while the first upload is processed.
  - **Empty bank** — "Add notes to get your first quiz"; the card opens Add notes.
  - **Paused** — "Daily quizzes are paused"; the card opens Settings.
  - **Guest** — daily quizzes come with an account; the card opens sign-up.
- **Add notes** — a canary-yellow legal pad taped to the page; opens the Add notes screen.
- **Your quizzes and exams** — one section for everything beyond today's quiz:
  - **On demand** — a tile that creates a quiz from the classroom's notes (see § 9). It is the only place that starts one.
  - **Exam** — the exam tile (see § 12b). Hidden for guests.
  - **The list** — the five latest quizzes and exams of every kind, newest first, each with its date, a Daily, On demand, or Exam tag, its size, and Not started or its best score. An untaken one opens the quiz runner; a taken one opens its quiz screen. "See all" opens the Quizzes screen.
- **In this classroom** — one row per deeper screen, each with a count:
  - **Notes** — uploads so far and when the last one arrived, plus a badge while notes are being read.
  - **Question bank** — knowledge points currently in quizzes.
  - **Corrections** — see § 12c.
  - **Settings** — name, languages, the auto-stop window, quiz length, and Daily reviews. Quiz length is a row of five steps (`<<` `<` `*` `>` `>>`, about 5 to 20 minutes) that saves on click or arrow key and applies to quizzes composed afterwards.

The handwriting font covers Latin letters only; in Chinese the same lines use the regular type.

A dormant classroom shows a note under the header: emails have stopped, add notes or open the classroom to resume them. A manually paused classroom instead shows a paused note and keeps that status even when the classroom is opened or notes are uploaded.

## 6. Upload notes

Two inputs on one screen:

- **Paste or type text.** The hint asks for one word, phrase, or rule per line.
- **Attach images** — photos of handwritten notes, up to 10 MB each.

Below the form, signed-in users see a pointer to the Firefox add-on, which saves text selected on any page as a note.

**Upload notes** with text opens a preview before anything is saved: each line with the number the reading uses (the same numbers the edit screen shows later), blank lines included. It counts the lines that will be read, plus any attached images. A line long enough to hold several items is flagged, and **Split into lines** breaks it at semicolons, bullets, and sentence ends (never at the dash or equals sign joining a term to its meaning), with Undo. Free users see what confirming uses of this week's uploads. **Back to edit** returns to the form; **Read N lines** uploads. The preview counts lines, not points: only the reading knows how many points the notes hold. Images alone skip the preview.

On confirm, the upload row is written immediately and the screen moves to the processing state. Nothing blocks on the LLM.

## 7. Processing

Shown while `extraction_status` is `pending` or `running`.

- A short line: the notes are being read.
- The user can leave, close the tab, or upload more. Extraction continues in the worker.
- On completion the bank summary updates and a count appears: how many points were added, and how many lines were skipped.
- When new practice points are ready, show examples from the uploaded notes, with links to their details, and offer practice now or a look at the bank.
- The skipped count is shown, not hidden. It reassures the user that `au bibeau` was ignored on purpose.

On failure the upload shows an error with a retry action. The uploaded material is never lost.

## 8. Notes

Opened from the Notes row on the classroom hub.

One row per upload, newest first: date, kind (text or image), the AI-written subject line naming the topic (falling back to the first line of the text or a thumbnail of the image until extraction finishes), the discard count, and its reading status (Re-reading while an edit is being read). The list refreshes itself while anything is still being read. Tapping a row opens that upload on its own screen with the original material in full — for an image, the image itself — plus the discard count, any extraction error, and the points it gave, in line order, each linking to its point screen.

**Editing a note.** On a typed note that has been read, **Edit notes** turns the text into a text box. The learner fixes, adds, or deletes lines and chooses **Save and read again**. Only the changed lines are read again: points from untouched lines keep their wording, history, and omits; a point on a changed line is corrected in place or removed; new lines can add points; points whose lines were deleted leave the bank. Points the learner edited by hand stay as written, and the note says how many. **Read again** reads the whole note again as it stands, and is the only option for an image.

While the edit is read, the screen shows the edited text under "Reading your changes…", and reviews keep using the current points. When it finishes, a line sums up what changed ("1 updated · 1 new · 0 removed"). If reading fails, the note and its points stay as they were; **Try again** reads the same edit again and **Discard edit** drops it. A note whose first reading failed shows **Try again** too, which reads it again for free.

Free users can edit or re-read each note 3 times; the screen shows how many are left, and past the cap the Pro prompt appears with an upgrade button. Pro has no per-note cap. Edits leave the classroom's active window alone.

This is the classroom's memory. Everything the user ever fed in stays readable here.

## 8b. Question bank

Opened from the Question bank row on the classroom hub.

One row per knowledge point, newest first: the target text, its meaning, category, an Inferred badge when the AI filled in the meaning, and how often the learner answered and missed questions built on it. A search box matches target text, meaning, and note. Category chips and an In quizzes / Omitted / All switch narrow the list; it opens on In quizzes. The search and filters live in the address, so stepping into a point and back returns to the same list.

Each row carries a quick **Omit / Restore** switch — the same switch as the review screen's omit control. Omitted points stay listed under Omitted and drop out of future composition; Restore brings them back.

Tapping a row opens the knowledge point on its own screen: its category and badges, the answered/missed record, Omit / Restore, the source excerpt from the notes, and an edit form for the target text, meaning, and note. A point that an edit to its note replaced no longer appears in the list; links to it from past quizzes still open its screen, marked Replaced, without Omit or the edit form. The category stays fixed, since grammar and comprehension points carry structured detail tied to it. Edits reach quizzes composed afterwards; past quizzes keep their wording.

Omit is the removal path. Past quiz questions and attempts hang off each knowledge point, so the bank keeps every point it ever produced.

## 9. Daily quiz — entry

**Two doors:**

- **From the email.** The email carries the questions inline, plus a link. The link opens the web quiz. If the user is signed out, it routes through sign-in and returns them to the quiz.
- **From the site.** The classroom hub shows today's quiz. A list of classrooms, each showing whether today's quiz is ready.

**On demand.** The classroom hub can create a quiz at any time. The quiz is written in the background, so the user never waits: a row slides in at the head of the quizzes list, a pencil writing on a small sheet beside it, with its progress (Queued → Writing your quiz) and a Cancel button, while the Create a quiz button shows it is busy. The user can leave the page; coming back picks the job up again. When it is done, the row gives way to the new quiz's own row, which drops in with a short glow and Take, and a failed or stopped quiz says so on the row with Try again or Close. A ready quiz never redirects on its own. Each on-demand quiz also sends an email carrying just that quiz, subject to the user's email preferences, and stays tagged On demand everywhere.

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
- **Finish** — returns to the classroom and is the primary completion action. Retakes and extra practice stay optional. Each graded question links to its knowledge point and original note context. The saved attempt review also lists the uploads used in the quiz.
- Every attempt is kept, so the same quiz can show three attempts with three scores.

## 12. Quizzes

Opened from the Quizzes row on the classroom hub. Past quizzes by date, each tagged Daily or On demand and showing the best score and the attempt count.

Tapping one opens the quiz on its own screen: its date and size, the categories it covers, a Take quiz (or Retake) button, and every attempt made against it with score, duration, and submission time. Tapping an attempt opens its full review. This is where a learner sees a category they keep missing.

The quiz screen also carries a **Delete** control. Confirming removes the quiz, its questions, and every attempt made against it, and returns to the list. A deleted daily quiz stays gone for that day — no replacement is composed.

## 12b. Exam

A longer paper that checks what has stuck, for Pro members.

- **Unlock.** The classroom hub carries an Exam tile in its quizzes section, beside the on-demand tile; past exams appear in the list under it. Below 80 active knowledge points it shows progress toward 80; at 80 it says the bank is ready. That card is the reminder — nothing is sent.
- **Pro only.** A free member sees the Start button locked with the Pro badge; tapping it explains what Pro adds and offers checkout.
- **Writing.** Start an exam writes one in the background (about a minute) with Cancel, while a pencil writes on the top sheet of the card's exam stack; the card turns into Take the exam when it is ready. An untaken exam keeps offering Take the exam.
- **The paper.** Always 40 questions worth 100 points: I. Multiple choice, 20 × 2; II. True or false, 10 × 2; III. Fill in the blanks, 10 × 4. Suggested time 30 minutes. It covers the whole bank, recent misses first. No email is sent.
- **Answer sheet.** Beside the paper sits an optical answer card printed in the theme's ink: name, subject, date, a candidate-number grid, pencil rules with correct and incorrect mark samples, a barcode, and timing marks down the edge. Choice and true-or-false rows come in blocks of five; fill-in answers show in written boxes. Marking a bubble answers the question on the paper, answering on the paper fills the bubble in pencil, and changing an answer leaves a faint eraser smudge. Tapping a row number jumps to that question. On a phone the card opens from the bar. After grading, the card shows the score, circles each right answer, and flags each wrong row.
- **AI review.** When the graded paper drops back with mistakes on it, a comment slip clipped under the header reads "Reading your mistakes…" for about half a minute, then shows the AI's review: a short overview, one to four patterns across the wrong answers — each quoting what the learner wrote, the rule behind it, and the question numbers it covers, which jump to those questions — and what to practise next. The red-pen notes on each question stay as they are. The same slip heads the full review. If writing fails, the slip offers Try again. A perfect paper gets no slip.
- An exam is taken, graded, retaken, and reviewed like any quiz, and appears in the quizzes list tagged Exam.

## 12c. Corrections

A Pro member's running list of what they got wrong, per classroom.

- **Where.** The classroom hub lists Corrections (错题本, carnet d'erreurs) under "In this classroom", with the number of questions left to correct. A free member sees the row with a Pro badge; the page explains Pro and offers checkout.
- **What is in it.** Every question missed in a quiz or exam over the last 30 days, oldest first, shown exactly as it was asked, with where it came from (date and quiz, daily quiz, or exam) and how many times it has been missed. Options come in a fresh order.
- **Correcting.** The page is a ruled exercise book with a red margin. Each question has a Check button; Enter checks too. A right answer gets a red tick and a Corrected stamp and leaves the book. A wrong one gets the usual red-pen marks — the right option circled, the wrong answer struck through, the explanation — and a Try again button. A progress bar counts the corrections.
- **AI tutor.** The tutor's buttons sit in each question's answer row, and its replies appear below on sticky notes in the theme's ink so they read apart from the red pen. Before answering, a light bulb button gives up to three hints; three dots on it show how many are left, and its tooltip says "Get a hint" with the count. Once all three are used the bulb dims and its tooltip says so, each closer than the last, none giving the answer away. After a wrong answer, "Explain my mistake" says what the answer shows the learner believes, the rule that decides it, one or two fresh examples, and a check for next time. The red-pen marks always show on their own; the tutor only answers when asked. Replies stay with the question while it is in Corrections.
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
- **Plan & usage** — current plan and status, this week's usage against the free limits, and the Stripe checkout or billing portal. Stripe returns here.
- **Referrals** — the user's code, the share link, and who signed up with it.
- **API tokens** — create and revoke tokens for the browser extension, with a link to the Firefox add-on.
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
| Onboarding | First visit, or a new account with no classroom | First quiz opens, or the user skips |
| Create classroom | Empty state or classroom list | Classroom hub opens |
| Upload notes | Add notes action | Points appear in the bank |
| Daily quiz | Morning email, or the site | Attempt recorded |
| Review | After submit | Explanations shown |
| Reactivate | Opening a dormant classroom | `active_until` moves forward |
| Pause daily reviews | Classroom Settings | `paused_at` is set; daily compose jobs are cancelled or asked to cancel |
| Resume daily reviews | Classroom Settings | `paused_at` clears, `daily_resumed_at` is set, and `active_until` is refreshed |
| Unsubscribe | Any email | `unsubscribed_at` set |
