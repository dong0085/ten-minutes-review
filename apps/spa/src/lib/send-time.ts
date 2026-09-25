import { nextDailySendAt } from "@tmr/core";

export type ResetTime = {
  local: string;
  utc: string;
  tomorrow: boolean;
};

function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function formatResetTime(locale: string, timezone: string, now = new Date()): ResetTime {
  const sendAt = nextDailySendAt(now);
  return {
    local: new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(sendAt),
    utc: new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(sendAt),
    tomorrow: localDate(sendAt, timezone) !== localDate(now, timezone),
  };
}
