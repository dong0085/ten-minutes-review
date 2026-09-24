import { describe, expect, it } from "vitest";
import {
  classroomDailyStatus,
  classroomQuizDaysRemaining,
  dailySendAt,
  isClassroomEligibleForDailySend,
  nextDailySendAt,
  startOfMonthAt,
} from "./schedule";

describe("startOfMonthAt", () => {
  it("returns local midnight on the first of the month", () => {
    expect(
      startOfMonthAt("America/Toronto", new Date("2026-09-24T12:00:00Z")).toISOString(),
    ).toBe("2026-09-01T04:00:00.000Z");
  });

  it("uses the local calendar month near a month boundary", () => {
    expect(
      startOfMonthAt("America/Toronto", new Date("2026-10-01T02:00:00Z")).toISOString(),
    ).toBe("2026-09-01T04:00:00.000Z");
    expect(startOfMonthAt("Asia/Shanghai", new Date("2026-09-30T17:00:00Z")).toISOString()).toBe(
      "2026-09-30T16:00:00.000Z",
    );
  });
});

describe("dailySendAt", () => {
  it("maps 7am Eastern to 12:00 UTC in winter", () => {
    expect(dailySendAt(new Date("2026-01-15T12:00:00Z")).toISOString()).toBe(
      "2026-01-15T12:00:00.000Z",
    );
  });

  it("maps 7am Eastern to 11:00 UTC in summer", () => {
    expect(dailySendAt(new Date("2026-07-15T12:00:00Z")).toISOString()).toBe(
      "2026-07-15T11:00:00.000Z",
    );
  });

  it("uses the Eastern calendar date of the given instant", () => {
    expect(dailySendAt(new Date("2026-01-16T04:59:00Z")).toISOString()).toBe(
      "2026-01-15T12:00:00.000Z",
    );
  });

  it("maps 7am Eastern to 11:00 UTC on the spring forward day", () => {
    expect(dailySendAt(new Date("2026-03-08T06:00:00Z")).toISOString()).toBe(
      "2026-03-08T11:00:00.000Z",
    );
  });

  it("maps 7am Eastern to 12:00 UTC on the fall back day", () => {
    expect(dailySendAt(new Date("2026-11-01T06:00:00Z")).toISOString()).toBe(
      "2026-11-01T12:00:00.000Z",
    );
  });
});

describe("nextDailySendAt", () => {
  it("returns today when the send moment is still ahead", () => {
    expect(nextDailySendAt(new Date("2026-01-15T11:00:00Z")).toISOString()).toBe(
      "2026-01-15T12:00:00.000Z",
    );
  });

  it("returns tomorrow once the send moment has passed", () => {
    expect(nextDailySendAt(new Date("2026-01-15T13:00:00Z")).toISOString()).toBe(
      "2026-01-16T12:00:00.000Z",
    );
  });

  it("returns tomorrow at exactly the send moment", () => {
    expect(nextDailySendAt(new Date("2026-01-15T12:00:00Z")).toISOString()).toBe(
      "2026-01-16T12:00:00.000Z",
    );
  });

  it("stays on summer time after the switch", () => {
    expect(nextDailySendAt(new Date("2026-07-15T13:00:00Z")).toISOString()).toBe(
      "2026-07-16T11:00:00.000Z",
    );
  });

  it("handles the spring forward and fall back days", () => {
    expect(nextDailySendAt(new Date("2026-03-08T12:00:00Z")).toISOString()).toBe(
      "2026-03-09T11:00:00.000Z",
    );
    expect(nextDailySendAt(new Date("2026-11-01T13:00:00Z")).toISOString()).toBe(
      "2026-11-02T12:00:00.000Z",
    );
  });
});

describe("classroomDailyStatus", () => {
  const now = new Date("2026-09-15T11:00:00.000Z");

  it("gives an explicit pause precedence over dormancy", () => {
    expect(
      classroomDailyStatus(
        {
          activeUntil: new Date("2026-09-14T11:00:00.000Z"),
          pausedAt: new Date("2026-09-10T11:00:00.000Z"),
        },
        now,
      ),
    ).toBe("paused");
  });

  it("distinguishes dormant and active classrooms", () => {
    expect(
      classroomDailyStatus({ activeUntil: new Date("2026-09-15T10:59:59.000Z"), pausedAt: null }, now),
    ).toBe("dormant");
    expect(
      classroomDailyStatus({ activeUntil: new Date("2026-09-15T11:00:01.000Z"), pausedAt: null }, now),
    ).toBe("active");
  });
});

describe("classroomQuizDaysRemaining", () => {
  const timeZone = "America/Toronto";

  it("counts whole local days after today", () => {
    const now = new Date("2026-09-15T15:00:00.000Z");
    expect(
      classroomQuizDaysRemaining(
        { activeUntil: new Date("2026-09-18T15:00:00.000Z") },
        timeZone,
        now,
      ),
    ).toBe(3);
  });

  it("returns zero when the active window ends today", () => {
    const now = new Date("2026-09-15T15:00:00.000Z");
    expect(
      classroomQuizDaysRemaining(
        { activeUntil: new Date("2026-09-15T22:00:00.000Z") },
        timeZone,
        now,
      ),
    ).toBe(0);
  });

  it("clamps a past window to zero", () => {
    const now = new Date("2026-09-15T15:00:00.000Z");
    expect(
      classroomQuizDaysRemaining(
        { activeUntil: new Date("2026-09-10T15:00:00.000Z") },
        timeZone,
        now,
      ),
    ).toBe(0);
  });

  it("uses the given timezone's calendar day", () => {
    // 02:00 UTC on Sep 16 is still Sep 15 in Toronto.
    const now = new Date("2026-09-16T02:00:00.000Z");
    expect(
      classroomQuizDaysRemaining(
        { activeUntil: new Date("2026-09-18T15:00:00.000Z") },
        timeZone,
        now,
      ),
    ).toBe(3);
  });
});

describe("isClassroomEligibleForDailySend", () => {
  const sendAt = new Date("2026-09-15T11:00:00.000Z");
  const createdAt = new Date("2026-09-01T12:00:00.000Z");

  it("includes a classroom resumed before the send cutoff", () => {
    expect(
      isClassroomEligibleForDailySend(
        { createdAt, dailyResumedAt: new Date("2026-09-15T10:59:59.999Z") },
        sendAt,
      ),
    ).toBe(true);
  });

  it("defers a classroom resumed at or after the send cutoff", () => {
    expect(
      isClassroomEligibleForDailySend({ createdAt, dailyResumedAt: sendAt }, sendAt),
    ).toBe(false);
    expect(
      isClassroomEligibleForDailySend(
        { createdAt, dailyResumedAt: new Date("2026-09-15T11:00:00.001Z") },
        sendAt,
      ),
    ).toBe(false);
  });
});
