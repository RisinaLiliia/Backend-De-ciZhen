//src/modules/bookings/bookings.rules.ts
export const BOOKING_CANCEL_MIN_HOURS_BEFORE_START = 24;
export const BOOKING_RESCHEDULE_MIN_HOURS_BEFORE_START = 24;

export function hoursToMs(h: number): number {
  return h * 60 * 60 * 1000;
}

