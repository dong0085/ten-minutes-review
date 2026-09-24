import { describe, expect, it } from "vitest";
import { hasPaidAccess } from "./plan";

const now = new Date("2026-09-24T12:00:00Z");

describe("hasPaidAccess", () => {
  it("treats a missing subscription as free", () => {
    expect(hasPaidAccess(null, now)).toBe(false);
  });

  it("grants access to an active subscription inside its period", () => {
    const currentPeriodEnd = new Date("2026-10-24T12:00:00Z");
    expect(hasPaidAccess({ status: "active", currentPeriodEnd }, now)).toBe(true);
    expect(hasPaidAccess({ status: "trialing", currentPeriodEnd }, now)).toBe(true);
  });

  it("drops access once the paid period has ended", () => {
    const currentPeriodEnd = new Date("2026-09-01T00:00:00Z");
    expect(hasPaidAccess({ status: "active", currentPeriodEnd }, now)).toBe(false);
  });

  it("drops access for lapsed or canceled subscriptions", () => {
    for (const status of ["inactive", "canceled", "past_due", "unpaid", "incomplete_expired"]) {
      expect(hasPaidAccess({ status, currentPeriodEnd: null }, now)).toBe(false);
    }
  });
});
