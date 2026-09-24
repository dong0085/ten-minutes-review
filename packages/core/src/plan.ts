const PAID_STATUSES = new Set(["active", "trialing"]);

export function hasPaidAccess(
  subscription: { status: string; currentPeriodEnd: Date | null } | null,
  now: Date = new Date(),
): boolean {
  if (!subscription || !PAID_STATUSES.has(subscription.status)) {
    return false;
  }
  return !subscription.currentPeriodEnd || subscription.currentPeriodEnd.getTime() > now.getTime();
}
