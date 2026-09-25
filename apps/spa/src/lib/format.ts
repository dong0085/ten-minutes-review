export function formatQuizDate(value: string, locale: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatDurationMs(milliseconds: number, locale: string): string {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourFormat = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "hour",
    unitDisplay: "narrow",
    maximumFractionDigits: 0,
  });
  const minuteFormat = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "minute",
    unitDisplay: "narrow",
    maximumFractionDigits: 0,
  });
  if (hours === 0) {
    return minuteFormat.format(minutes);
  }
  if (minutes === 0) {
    return hourFormat.format(hours);
  }
  return `${hourFormat.format(hours)} ${minuteFormat.format(minutes)}`;
}
