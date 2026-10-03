# Classroom hub redesign

The intent behind the classroom hub layout (`apps/web/spa/routes/classroom-hub.tsx`). `FLOWS.md` § 5 describes how the hub behaves; this page records why it looks the way it does, so later changes keep the same direction.

## Why people open a classroom

A learner opens a classroom to do one of four things, in this order of frequency:

1. **Take today's quiz.**
2. **Add notes** from their latest lesson.
3. **Check their quizzes and exams** — what exists, when it was made, and what they scored.
4. **Take an exam.**

The hub gives each job one clear place. Job 1 is the biggest thing on the screen. Jobs 3 and 4 share one section, because an exam is a kind of quiz.

## 1. Today's quiz: the mailbox is the button

The mailbox animation tells the story by itself: a dated quiz sheet waiting in a letterbox. So the whole card is the call to action.

- **Layout.** The mailbox sits in the centre of the card, large. The side column, the kicker, the title, and the long blurb are gone.
- **One click target.** The whole card is a single link. Hover and keyboard focus slide the sheet out, raise the flag, lift the card, and lift the button.
- **A short button.** The button lives in the card under the mailbox and says "Open". The animation explains the rest.
- **Text on top.** A short handwritten line above the mailbox invites the click: "Your quiz is here".
- **Date at the bottom.** Today's date sits under the button in handwriting, e.g. "Friday, October 2".
- **A playful font.** Caveat, a handwriting font, sets the top line, the date, and the lettering on the mailbox and the quiz sheet (month, day, weekday). Body text keeps the regular fonts. Chinese uses the regular type for these lines too, because Caveat covers Latin letters only.
- **Only today's quiz lives here.** On-demand practice has its own tile in the quizzes section (§ 3), so the two ideas stay apart. "Done for today" means today's daily quiz has been taken; an on-demand quiz leaves it alone.

### States

The mailbox is there in every state, so the hub always looks the same; the scene and the click target change.

| State | Mailbox | Top line | Click goes to |
| --- | --- | --- | --- |
| Quiz ready | Sheet peeking out; hover pulls it out and raises the flag | "Your quiz is here" | Take the quiz |
| Taken today | Sheet out, stamped with the score | "Done for today" | Review the attempt |
| No quiz yet today | Empty box | "Nothing in the box yet", with the next delivery time | Nothing; the card is informational |
| Notes being read | Empty box | "Reading your notes…" | Nothing |
| Empty bank | Empty box | "Add notes to get your first quiz" | Add notes |
| Paused | Empty box | "Daily quizzes are paused" | Settings |
| Guest | Empty box | "Daily quizzes delivered to your inbox" | Sign up |

## 2. Add notes: stand out from the page

The legal pad used to be a pale cream-yellow on a cream page, so it blended in. It is now a canary legal-pad yellow with faint blue rules, a deeper shadow, and a strip of tape at the top, so it reads as an object sitting on the desk. Dark mode uses a muted olive version.

## 3. Quizzes and exams: one section

Extra practice used to be spread over five places: the "Practise now" button, the recent on-demand cards, the "Optional practice to return to" chips, the "Before your next lesson" box, and the exam card at the very bottom. "Practise now" and "Before your next lesson" started the same on-demand quiz. Now it all lives in one section, right under the two main cards.

- **Title:** "Your quizzes and exams", with "See all" leading to the Quizzes screen.
- **Two tiles:**
  - **On demand** — "Create a quiz" writes a quiz from this classroom's notes. This is the only place that starts one. The name matches the "On demand" tag used everywhere else.
  - **Exam** — progress toward 80 knowledge points, then Start an exam (Pro badge for free members) or Take the exam.
- **One list** of the five latest quizzes and exams, newest first. Each row shows its kind (Daily, On demand, Exam), its date, its size, and its status: Not started, or the best score. Each row has one action: Take or Review.
- A quiz being written shows at the top of the list with the pencil animation, then gives way to the new quiz with a short glow.
- The Quizzes row left "In this classroom", since this section leads there.

## Decisions

- **Status covers two cases: Not started, or a score.** The server learns about an attempt only when it is submitted, and answers in progress live in the browser for 2 hours, so the list has no "In progress" status.
- **Chinese uses the regular type** for the handwritten lines.
- **The button says "Open".**
- **The list shows five items** before "See all".
