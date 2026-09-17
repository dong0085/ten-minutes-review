import { dailySendAt } from "@tmr/core";
import {
  enqueueJob,
  hasActiveDailyComposeJob,
  hasActiveDailyEmailJob,
  listDueClassrooms,
  listReadyDailyEmailRecipients,
  listUnsentDailyEmailRecipients,
} from "@tmr/db";
import type { Db } from "@tmr/db";

const OVERDUE_AFTER_MS = 30 * 60 * 1000;

export async function enqueueDueDailyComposeJobs(
  db: Db,
  now: Date = new Date(),
): Promise<number> {
  const sendAt = dailySendAt(now);
  const due = await listDueClassrooms(db, sendAt);
  let enqueued = 0;
  for (const classroom of due) {
    if (
      await hasActiveDailyComposeJob(db, classroom.classroomId, classroom.localDate)
    ) {
      continue;
    }
    await enqueueJob(db, {
      kind: "compose",
      payload: {
        classroomId: classroom.classroomId,
        userId: classroom.userId,
        localDate: classroom.localDate,
        source: "daily",
        sendAt: sendAt.toISOString(),
      },
    });
    enqueued += 1;
  }
  return enqueued;
}

export async function enqueueReadyDailyEmailJobs(
  db: Db,
  now: Date = new Date(),
): Promise<number> {
  const sendAt = dailySendAt(now);
  const recipients = await listReadyDailyEmailRecipients(db, sendAt);
  let enqueued = 0;
  for (const recipient of recipients) {
    if (await hasActiveDailyEmailJob(db, recipient.userId, recipient.localDate)) {
      continue;
    }
    await enqueueJob(db, {
      kind: "send_email",
      payload: {
        userId: recipient.userId,
        quizDate: recipient.localDate,
        kind: "daily",
        sendAt: sendAt.toISOString(),
      },
    });
    enqueued += 1;
  }
  return enqueued;
}

export async function auditOverdueDailyEmails(db: Db, now: Date = new Date()) {
  const sendAt = dailySendAt(now);
  if (now.getTime() < sendAt.getTime() + OVERDUE_AFTER_MS) {
    return [];
  }
  return listUnsentDailyEmailRecipients(db, sendAt);
}
