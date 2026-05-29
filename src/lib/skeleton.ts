/**
 * Trip "skeleton" — the route backbone: which cities, in what order, for how
 * many nights. This is what makes planning-from-zero possible: a trip can carry
 * a route BEFORE any booking exists, so the day-by-day planner has somewhere to
 * anchor its suggestions.
 *
 * Stored in the (previously write-only) City model — one row per stop with
 * arriveOn / leaveOn / displayOrder. Only PURE helpers live here (no Prisma),
 * so this module is safe to import from client components for live date
 * previews. The actual DB read happens in the caller and is mapped through
 * mapRowsToSkeleton().
 */

import { addDays, differenceInDays, startOfDay, isEqual } from 'date-fns'

/** A desired stop before it's been placed on the calendar. */
export type RouteStop = {
  city: string
  country: string
  nights: number
  note?: string | null
}

/** A stop with concrete date windows, ready to render or persist. */
export type SkeletonStop = {
  id: string | null
  city: string
  country: string
  nights: number
  arriveOn: Date
  leaveOn: Date
  order: number
  note: string | null
}

/** Whole-trip night count (the check-out day itself doesn't add a night). */
export function tripNights(start: Date, end: Date): number {
  return Math.max(0, differenceInDays(startOfDay(end), startOfDay(start)))
}

/**
 * Turn an ordered list of desired stops (city + requested nights) into
 * contiguous date windows starting at the trip's start date. The LAST stop
 * always absorbs any remaining nights, so the route ends exactly on the trip's
 * end date. Each non-last stop keeps at least one night where there's room;
 * stops that don't fit in the available nights are dropped.
 */
export function allocate(stops: RouteStop[], start: Date, end: Date): SkeletonStop[] {
  const total = tripNights(start, end)
  const s0 = startOfDay(start)
  const out: SkeletonStop[] = []
  let cursor = s0

  for (let i = 0; i < stops.length; i++) {
    const usedSoFar = differenceInDays(cursor, s0)
    const remainingTotal = total - usedSoFar
    if (remainingTotal <= 0) break

    const remainingAfter = stops.length - 1 - i
    let nights: number
    if (i === stops.length - 1) {
      // Final stop takes everything left, landing exactly on the end date.
      nights = remainingTotal
    } else {
      // Reserve one night for each stop still to come.
      const maxForThis = Math.max(1, remainingTotal - remainingAfter)
      const requested = Math.round(stops[i].nights) || 1
      nights = Math.max(1, Math.min(requested, maxForThis))
    }

    const arriveOn = cursor
    const leaveOn = addDays(cursor, nights)
    out.push({
      id: null,
      city: stops[i].city.trim() || 'Stop',
      country: (stops[i].country || '').trim(),
      nights,
      arriveOn,
      leaveOn,
      order: out.length + 1,
      note: stops[i].note ?? null,
    })
    cursor = leaveOn
  }

  return out
}

/**
 * Which city the traveller is based in on a given date. A stop covers the
 * nights [arriveOn, leaveOn); the departure day (the trip's end date) is
 * attributed to the final stop so the last day isn't left blank.
 */
export function cityForDate(stops: SkeletonStop[], date: Date, end: Date): string | null {
  if (stops.length === 0) return null
  const d = startOfDay(date)
  for (const s of stops) {
    if ((isEqual(d, s.arriveOn) || d > s.arriveOn) && d < s.leaveOn) return s.city
  }
  const last = stops[stops.length - 1]
  if (d >= last.leaveOn || isEqual(d, startOfDay(end))) return last.city
  return null
}

/** Distinct cities in route order — handy for legends / constraints. */
export function citiesInOrder(stops: SkeletonStop[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of stops) {
    if (!seen.has(s.city)) { seen.add(s.city); out.push(s.city) }
  }
  return out
}

/** Structural shape of a City row — avoids importing the Prisma type here. */
type CityRowLike = {
  id: string
  name: string
  country: string
  arriveOn: Date
  leaveOn: Date
  displayOrder: number
}

/**
 * Map stored City rows to a skeleton. `scheduled` is false when there's no
 * route, or when the rows are the legacy creation-time seed (every city
 * sharing the full trip window — createTrip used to write that before the
 * skeleton planner existed). A single full-span stop is a legitimate
 * single-city trip, so only multi-row all-identical windows count as legacy.
 */
export function mapRowsToSkeleton(
  rows: CityRowLike[],
  // start/end accepted for symmetry / future clamping; not needed for the map.
  _start?: Date,
  _end?: Date,
): { stops: SkeletonStop[]; scheduled: boolean } {
  if (!rows.length) return { stops: [], scheduled: false }

  const sorted = [...rows].sort(
    (a, b) => (a.displayOrder - b.displayOrder) || (+a.arriveOn - +b.arriveOn),
  )
  const stops: SkeletonStop[] = sorted.map((r, i) => ({
    id: r.id,
    city: r.name,
    country: r.country,
    nights: Math.max(0, differenceInDays(startOfDay(r.leaveOn), startOfDay(r.arriveOn))),
    arriveOn: startOfDay(r.arriveOn),
    leaveOn: startOfDay(r.leaveOn),
    order: r.displayOrder || i + 1,
    note: null,
  }))

  const degenerate =
    stops.length > 1 &&
    stops.every((s) => isEqual(s.arriveOn, stops[0].arriveOn) && isEqual(s.leaveOn, stops[0].leaveOn))

  return { stops, scheduled: !degenerate }
}
