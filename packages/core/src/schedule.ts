import { DAILY_SEND_HOUR_LOCAL, DAILY_SEND_TIMEZONE } from "./constants";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

function offsetMsAt(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return wallClock - Math.floor(instant.getTime() / MINUTE_MS) * MINUTE_MS;
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour);
  const firstOffset = offsetMsAt(new Date(target), timeZone);
  const first = target - firstOffset;
  const secondOffset = offsetMsAt(new Date(first), timeZone);
  return new Date(secondOffset === firstOffset ? first : target - secondOffset);
}

export function dailySendAt(now: Date = new Date()): Date {
  const parts = zonedParts(now, DAILY_SEND_TIMEZONE);
  return zonedTimeToUtc(parts.year, parts.month, parts.day, DAILY_SEND_HOUR_LOCAL, DAILY_SEND_TIMEZONE);
}

export function nextDailySendAt(now: Date = new Date()): Date {
  const today = dailySendAt(now);
  if (today.getTime() > now.getTime()) {
    return today;
  }
  const tomorrow = zonedParts(new Date(today.getTime() + DAY_MS), DAILY_SEND_TIMEZONE);
  return zonedTimeToUtc(
    tomorrow.year,
    tomorrow.month,
    tomorrow.day,
    DAILY_SEND_HOUR_LOCAL,
    DAILY_SEND_TIMEZONE,
  );
}

export type ClassroomDailyStatus = "active" | "dormant" | "paused";

export function classroomDailyStatus(
  classroom: { activeUntil: Date; pausedAt: Date | null },
  now: Date = new Date(),
): ClassroomDailyStatus {
  if (classroom.pausedAt !== null) {
    return "paused";
  }
  return classroom.activeUntil.getTime() <= now.getTime() ? "dormant" : "active";
}

export function isClassroomEligibleForDailySend(
  classroom: { createdAt: Date; dailyResumedAt: Date | null },
  sendAt: Date,
): boolean {
  return (classroom.dailyResumedAt ?? classroom.createdAt).getTime() < sendAt.getTime();
}
