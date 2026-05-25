/**
 * Day-by-day itinerary grouping logic.
 *
 * Given a list of bookings and a specific day, decide:
 *   - Which hotel you're sleeping at tonight (the carry-forward rule)
 *   - Whether you check out from a different hotel today
 *   - Whether you pick up / return a rental car today
 *   - What goes into morning, afternoon, and night sessions
 *
 * Used by /trips/[tripSlug]/itinerary to render each day uniformly.
 */

import { startOfDay, isBefore, isAfter, isEqual, subDays } from 'date-fns'
import type { Booking } from '@prisma/client'

export type Session = 'morning' | 'afternoon' | 'night'

export const SESSIONS: Session[] = ['morning', 'afternoon', 'night']

export const SESSION_LABEL: Record<Session, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
}

// Default hour for a manually-added item if user hasn't picked a time yet.
export const SESSION_DEFAULT_HOUR: Record<Session, number> = {
  morning: 9,
  afternoon: 13,
  night: 19,
}

export function sessionForHour(h: number): Session {
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'night'
}

export type DayPos = 'before' | 'first' | 'middle' | 'last' | 'single' | 'after'

export function dayPos(day: Date, b: Pick<Booking, 'startAt' | 'endAt'>): DayPos {
  const target = startOfDay(day)
  const start = startOfDay(b.startAt)
  const end = startOfDay(b.endAt ?? b.startAt)

  if (isBefore(target, start)) return 'before'
  if (isAfter(target, end)) return 'after'
  if (isEqual(start, end)) return isEqual(target, start) ? 'single' : 'after'
  if (isEqual(target, start)) return 'first'
  if (isEqual(target, end)) return 'last'
  return 'middle'
}

export type DayPlan = {
  sleepingTonight: Booking | null      // hotel where you'll sleep this night (start..end-1)
  checkingOutToday: Booking | null     // hotel you check out from this morning
  carPickup: Booking | null            // rental car pickup today
  carReturn: Booking | null            // rental car return today
  sessions: Record<Session, Array<{ booking: Booking; position: DayPos }>>
}

const emptyPlan = (): DayPlan => ({
  sleepingTonight: null,
  checkingOutToday: null,
  carPickup: null,
  carReturn: null,
  sessions: { morning: [], afternoon: [], night: [] },
})

/**
 * Multi-day "always-every-day" types: a 4-day ski lesson should appear on all 4 days.
 * Single-day-event types (flights, restaurants, transit hops) show only on their startAt day,
 * even if endAt happens to be the next morning.
 */
const ALWAYS_EXPAND_TYPES = new Set(['activity'])

export function planForDay(day: Date, bookings: readonly Booking[]): DayPlan {
  const plan = emptyPlan()

  for (const b of bookings) {
    const pos = dayPos(day, b)
    if (pos === 'before' || pos === 'after') continue

    if (b.type === 'hotel') {
      // Hotel covers nights between startAt date and endAt-1 (you check out the morning of endAt).
      // - 'first' or 'middle' positions → you're sleeping there tonight
      // - 'last' position → you check out this morning, NOT sleeping there tonight
      // - 'single' (same-day check-in/out, rare) → check out today
      if (pos === 'first' || pos === 'middle') plan.sleepingTonight = b
      if (pos === 'last' || pos === 'single') plan.checkingOutToday = b
      continue
    }

    if (b.type === 'car') {
      // Car hire is the only type that doesn't show in the middle days of its span.
      if (pos === 'first' || pos === 'single') plan.carPickup = b
      else if (pos === 'last') plan.carReturn = b
      continue
    }

    // Everything else (activity, restaurant, flight, transit, other):
    if (pos === 'middle' || pos === 'last') {
      // Multi-day-spanning case: only show on every day for ALWAYS_EXPAND_TYPES
      if (!ALWAYS_EXPAND_TYPES.has(b.type)) continue
    }
    const session = sessionForHour(b.startAt.getUTCHours())
    plan.sessions[session].push({ booking: b, position: pos })
  }

  // Sort each session by start time
  for (const s of SESSIONS) {
    plan.sessions[s].sort((a, b) => a.booking.startAt.getTime() - b.booking.startAt.getTime())
  }

  return plan
}
