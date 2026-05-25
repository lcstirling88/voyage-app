/**
 * Day-by-day itinerary grouping logic.
 *
 * Given a list of bookings and a specific day, decide what shows up in each
 * morning / afternoon / night session. Hotels and cars get special treatment:
 *
 *   - Hotel CHECK-IN  → full card pinned to the start of the session matching
 *                       its check-in time (e.g. 15:00 → afternoon)
 *   - Hotel CHECK-OUT → compact row pinned to the start of the session matching
 *                       its check-out time (e.g. 10:00 → morning)
 *   - Hotel STAYING   → compact "staying tonight" row pinned to the END of the
 *                       night session, on every stay night (not checkout night)
 *   - Car PICKUP / RETURN → shown in the session matching the time, only on
 *                           pickup day and return day (no middle days)
 *   - Everything else (activity, restaurant, flight, transit) → in the session
 *                           matching startAt's hour. Activities also repeat across
 *                           multi-day spans with a "Day N of M" pill.
 */

import { startOfDay, isBefore, isAfter, isEqual } from 'date-fns'
import type { Booking } from '@prisma/client'
import { safeJson } from './format'

export type Session = 'morning' | 'afternoon' | 'night'

export const SESSIONS: Session[] = ['morning', 'afternoon', 'night']

export const SESSION_LABEL: Record<Session, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night',
}

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

/**
 * Return every session that the time range [startMin, endMin] touches.
 * Used for all-day activities that span sessions (e.g. ski lessons 09:30–15:45
 * appear in BOTH morning and afternoon).
 *
 * Session minute boundaries: morning [0, 720), afternoon [720, 1080), night [1080, 1440)
 * Strict comparisons at boundaries to avoid an event ending right at noon being
 * tagged as "afternoon".
 */
export function sessionsForRange(startMin: number, endMin: number): Session[] {
  // Clamp wraparound and instant ranges
  if (endMin < startMin) endMin = startMin
  const result: Session[] = []
  if (startMin < 720 && (endMin > 0 || startMin === endMin))    result.push('morning')
  if (startMin < 1080 && endMin > 720)                            result.push('afternoon')
  if (endMin > 1080)                                              result.push('night')
  // Safety: if somehow nothing matched, default to the session of startMin
  if (result.length === 0) result.push(sessionForHour(Math.floor(startMin / 60)))
  return result
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

// ---------- Time parsing & formatting -----------------------------------------------

export type ParsedTime = { hour: number; minute: number; display: string }

/**
 * Extract HH:MM and a human display from various string formats Claude or
 * the user might produce: ISO datetimes, "15:00", "3pm", "3:00 PM", etc.
 */
export function parseTimeString(value: string | null | undefined): ParsedTime | null {
  if (!value) return null
  const v = String(value).trim()

  // Full ISO datetime (e.g. "2026-06-18T08:00:00+12:00")
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    // We want the time-of-day as Claude wrote it (in destination-local time).
    // Strip any trailing Z or ±HH:MM offset and just read hours/minutes from the literal.
    const m = v.match(/T(\d{2}):(\d{2})/)
    if (m) return makeParsedTime(parseInt(m[1], 10), parseInt(m[2], 10))
  }

  // 24h "HH:MM"
  const hhmm = v.match(/^(\d{1,2}):(\d{2})\s*$/)
  if (hhmm) return makeParsedTime(parseInt(hhmm[1], 10), parseInt(hhmm[2], 10))

  // 12h "3pm", "3:00 PM", "3 PM"
  const ampm = v.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0
    const isPm = /p/i.test(ampm[3])
    if (isPm && h < 12) h += 12
    if (!isPm && h === 12) h = 0
    return makeParsedTime(h, m)
  }

  // Bare number "3" → assume hour (skip — too ambiguous, return null)
  return null
}

function makeParsedTime(h: number, m: number): ParsedTime {
  const safeH = Math.max(0, Math.min(23, h))
  const safeM = Math.max(0, Math.min(59, m))
  const ampm = safeH >= 12 ? 'pm' : 'am'
  const h12 = safeH % 12 || 12
  const display = `${h12}:${String(safeM).padStart(2, '0')}${ampm}`
  return { hour: safeH, minute: safeM, display }
}

export function formatTime(value: string | null | undefined, fallback = '—'): string {
  return parseTimeString(value)?.display ?? (value || fallback)
}

// ---------- Day plan ----------------------------------------------------------------

export type SessionItem =
  | { kind: 'booking'; booking: Booking; position: DayPos; sortHour: number; sortMinute: number }
  | { kind: 'hotel-checkin'; booking: Booking; time: ParsedTime | null }
  | { kind: 'hotel-checkout'; booking: Booking; time: ParsedTime | null }
  | { kind: 'car-pickup'; booking: Booking; time: ParsedTime }
  | { kind: 'car-return'; booking: Booking; time: ParsedTime }
  | { kind: 'staying-tonight'; booking: Booking }

export type DayPlan = {
  sessions: Record<Session, SessionItem[]>
}

// Multi-day activities and (now) restaurants/etc. only repeat if the type allows it.
const ALWAYS_EXPAND_TYPES = new Set(['activity'])

export function planForDay(day: Date, bookings: readonly Booking[]): DayPlan {
  const plan: DayPlan = { sessions: { morning: [], afternoon: [], night: [] } }
  let sleepingTonight: Booking | null = null

  for (const b of bookings) {
    const pos = dayPos(day, b)
    if (pos === 'before' || pos === 'after') continue

    if (b.type === 'hotel') {
      const meta = safeJson<Record<string, string>>(b.metadata) ?? {}
      const checkInTime = parseTimeString(meta.checkIn)
      const checkOutTime = parseTimeString(meta.checkOut)

      if (pos === 'first') {
        // Full check-in card in the session matching check-in time (default afternoon).
        // We DON'T set sleepingTonight here — the check-in card already conveys
        // "you're sleeping here", so showing "Staying tonight at X" again at night
        // would be redundant.
        const session: Session = checkInTime ? sessionForHour(checkInTime.hour) : 'afternoon'
        plan.sessions[session].unshift({ kind: 'hotel-checkin', booking: b, time: checkInTime })
      } else if (pos === 'middle') {
        sleepingTonight = b
      } else if (pos === 'last') {
        // Check-out row in the session matching check-out time (default morning)
        const session: Session = checkOutTime ? sessionForHour(checkOutTime.hour) : 'morning'
        plan.sessions[session].unshift({ kind: 'hotel-checkout', booking: b, time: checkOutTime })
        // No "staying tonight" — they're leaving
      } else if (pos === 'single') {
        // Same-day check-in/out — show checkout row only
        const session: Session = checkOutTime ? sessionForHour(checkOutTime.hour) : 'morning'
        plan.sessions[session].unshift({ kind: 'hotel-checkout', booking: b, time: checkOutTime })
      }
      continue
    }

    if (b.type === 'car') {
      if (pos === 'first' || pos === 'single') {
        const t = makeParsedTime(b.startAt.getUTCHours(), b.startAt.getUTCMinutes())
        plan.sessions[sessionForHour(t.hour)].push({ kind: 'car-pickup', booking: b, time: t })
      } else if (pos === 'last') {
        const endTime = b.endAt ?? b.startAt
        const t = makeParsedTime(endTime.getUTCHours(), endTime.getUTCMinutes())
        plan.sessions[sessionForHour(t.hour)].push({ kind: 'car-return', booking: b, time: t })
      }
      // 'middle' days: skip
      continue
    }

    // Activity, restaurant, flight, transit, other
    if ((pos === 'middle' || pos === 'last') && !ALWAYS_EXPAND_TYPES.has(b.type)) continue
    const startMin = b.startAt.getUTCHours() * 60 + b.startAt.getUTCMinutes()
    const endMin = b.endAt
      ? b.endAt.getUTCHours() * 60 + b.endAt.getUTCMinutes()
      : startMin

    // Activities with a real time range span every session they touch (e.g. 09:30-15:45 → morning + afternoon).
    // Other types stay anchored to their start hour.
    const sessions: Session[] = b.type === 'activity' && b.endAt
      ? sessionsForRange(startMin, endMin)
      : [sessionForHour(b.startAt.getUTCHours())]

    for (const s of sessions) {
      plan.sessions[s].push({
        kind: 'booking', booking: b, position: pos,
        sortHour: Math.floor(startMin / 60), sortMinute: startMin % 60,
      })
    }
  }

  // Sort each session's regular items by time; keep pinned hotel-checkin/out at the front
  for (const s of SESSIONS) {
    const items = plan.sessions[s]
    const pinnedFront = items.filter((i) => i.kind === 'hotel-checkin' || i.kind === 'hotel-checkout')
    const rest = items.filter((i) => i.kind !== 'hotel-checkin' && i.kind !== 'hotel-checkout')
    rest.sort((a, b) => {
      const ah = a.kind === 'booking' ? a.sortHour * 60 + a.sortMinute
               : a.kind === 'car-pickup' || a.kind === 'car-return' ? a.time.hour * 60 + a.time.minute
               : 0
      const bh = b.kind === 'booking' ? b.sortHour * 60 + b.sortMinute
               : b.kind === 'car-pickup' || b.kind === 'car-return' ? b.time.hour * 60 + b.time.minute
               : 0
      return ah - bh
    })
    plan.sessions[s] = [...pinnedFront, ...rest]
  }

  // "Staying tonight at X" pinned to the END of the night session (only if not checking out tonight)
  if (sleepingTonight) {
    plan.sessions.night.push({ kind: 'staying-tonight', booking: sleepingTonight })
  }

  return plan
}
