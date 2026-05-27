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

// ---------- Accommodation colour palettes -------------------------------------------

export type ColorPalette = 'pastel' | 'jewel' | 'mono'

export type PaletteSpec = {
  key: ColorPalette
  label: string
  description: string
  colors: string[]      // background colours
  textOnColor: string   // foreground text colour for contrast
}

export const PALETTES: Record<ColorPalette, PaletteSpec> = {
  pastel: {
    key: 'pastel',
    label: 'Pastel',
    description: 'Soft complementary pastels — gentle on the eye, magazine-like.',
    colors: [
      '#E8C9C9', // dusty rose
      '#CBDCE8', // powder blue
      '#CFE5D2', // soft mint
      '#E8DFC4', // butter
      '#D8C9E8', // lavender
      '#E8D2BD', // peach
      '#C9E2E8', // duck egg
      '#E2C9E8', // mauve
    ],
    textOnColor: '#3A2418',
  },
  jewel: {
    key: 'jewel',
    label: 'Jewel',
    description: 'Rich saturated tones — emerald, sapphire, ruby. More punch.',
    colors: [
      '#2E5A47', // emerald
      '#2A4A72', // sapphire
      '#7A2E3A', // ruby
      '#503279', // amethyst
      '#7A5621', // topaz
      '#562055', // mulberry
      '#1F5462', // teal
      '#7A3318', // garnet
    ],
    textOnColor: '#FBF8F1',
  },
  mono: {
    key: 'mono',
    label: 'Mono',
    description: 'Single sage tone — subtle, all hotels look the same.',
    colors: ['#3F5B4E'],
    textOnColor: '#FBF8F1',
  },
}

export function getPalette(key: string | null | undefined): PaletteSpec {
  if (key && key in PALETTES) return PALETTES[key as ColorPalette]
  return PALETTES.pastel
}

/**
 * Return a deterministic colour for a given hotel within the trip, using the
 * provided ordered list of distinct hotel IDs to cycle through the palette.
 */
export function colorForHotel(hotelId: string, hotelIdsInOrder: string[], palette: PaletteSpec): string {
  const idx = hotelIdsInOrder.indexOf(hotelId)
  const safe = idx < 0 ? 0 : idx
  return palette.colors[safe % palette.colors.length]
}

/**
 * Get the ordered list of distinct hotel booking IDs in the trip, sorted by startAt.
 * Used together with colorForHotel to assign stable per-trip colours.
 */
export function hotelOrderForTrip(bookings: readonly Booking[]): string[] {
  const seen = new Set<string>()
  const sorted = [...bookings]
    .filter((b) => b.type === 'hotel')
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  const ids: string[] = []
  for (const b of sorted) {
    if (!seen.has(b.id)) { seen.add(b.id); ids.push(b.id) }
  }
  return ids
}

/**
 * Chronologically-ordered list of distinct cities the traveller stays in,
 * derived from hotel bookings in startAt order. Used together with
 * colorForCity to assign stable per-trip city colours for the calendar strip.
 *
 * If two hotels are in the same city they share one slot here (and therefore
 * one colour), unlike hotelOrderForTrip which gives each hotel its own slot.
 */
export function cityOrderForTrip(bookings: readonly Booking[]): string[] {
  const seen = new Set<string>()
  const cities: string[] = []
  const sorted = [...bookings]
    .filter((b) => b.type === 'hotel')
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  for (const b of sorted) {
    const city = cityForBooking(b)
    if (city && !seen.has(city)) {
      seen.add(city)
      cities.push(city)
    }
  }
  return cities
}

/**
 * Stable colour for a given city within the trip, using the chronological
 * cityOrder list to index into the palette. Returns the first palette colour
 * if the city isn't in the list (defensive fallback — shouldn't happen in
 * practice).
 */
export function colorForCity(city: string, citiesInOrder: string[], palette: PaletteSpec): string {
  const idx = citiesInOrder.indexOf(city)
  const safe = idx < 0 ? 0 : idx
  return palette.colors[safe % palette.colors.length]
}

/**
 * Strip the room-type / suite descriptor that comes after an en-dash or em-dash
 * in many hotel booking titles. "Galaxy Boutique Hotel – Two-Bedroom Lake View
 * Suite" → "Galaxy Boutique Hotel".
 */
export function cleanHotelName(title: string): string {
  const m = title.match(/^([\s\S]+?)\s+[–—]\s+/)
  return m ? m[1].trim() : title
}

/**
 * Extract a sensible city label for a booking. Prefers booking.location; falls
 * back to a heuristic on booking.address (second-to-last comma-separated chunk,
 * with postcodes stripped). Returns null if nothing usable found.
 */
export function cityForBooking(b: Pick<Booking, 'location' | 'address'>): string | null {
  if (b.location && b.location.trim()) return b.location.trim()
  if (!b.address) return null
  const parts = b.address
    .split(',')
    .map((s) => s.trim().replace(/^\d{4,6}\s+/, '').replace(/\s+\d{4,6}$/, '').replace(/^\d{4,6}$/, '').trim())
    .filter(Boolean)
  if (parts.length >= 2) return parts[parts.length - 2] || null
  return parts[0] || null
}

/**
 * Find the hotel booking that covers the NIGHT of the given day, if any.
 * Hotel covers nights from startAt (inclusive) to endAt-1 (inclusive). On the
 * endAt day itself you've already checked out in the morning.
 */
export function sleepingTonightFor(day: Date, bookings: readonly Booking[]): Booking | null {
  const target = startOfDay(day)
  for (const b of bookings) {
    if (b.type !== 'hotel') continue
    const start = startOfDay(b.startAt)
    const end = startOfDay(b.endAt ?? b.startAt)
    if (isEqual(start, end)) continue // 0-night stays — skip
    // Sleeping nights = [start, end-1]. So target sleeping if start <= target < end.
    if ((isEqual(target, start) || isAfter(target, start)) && isBefore(target, end)) {
      return b
    }
  }
  return null
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

  // (The "Staying tonight at X" text row has been replaced by the coloured
  // accommodation bar under each day header. See sleepingTonightFor() + the
  // colour palette helpers above.)
  void sleepingTonight

  return plan
}
