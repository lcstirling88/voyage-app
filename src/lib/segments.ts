/**
 * Trip legs (segments) — the backbone of multi-country support.
 *
 * A trip can visit several countries, each with its own date window. Some
 * pages should ADAPT to where you are right now (clock, currency, weather);
 * others should AGGREGATE every country at once (visa, local info, packing).
 * Both read from the same resolved leg list produced here.
 *
 * If a trip has no explicit TripSegment rows, we synthesise a single implicit
 * leg from Trip.destination — so single-country trips work with zero setup.
 */

import { startOfDay } from 'date-fns'
import { prisma } from './db'
import {
  profileForDestination, profileForIsoNumeric, currencySymbol,
} from './destinations'

export type ResolvedSegment = {
  /** Row id, or null for the implicit single-leg fallback. */
  id: string | null
  country: string
  isoNumeric: string | null
  currency: string
  currencySymbol: string
  timezone: string
  flag: string | null
  startDate: Date
  endDate: Date
}

type TripLike = {
  id: string
  destination: string
  startDate: Date
  endDate: Date
  localCurrency: string | null
  timezone: string
}

function resolveByIso(isoNumeric: string | null, country: string) {
  const p = isoNumeric ? profileForIsoNumeric(isoNumeric) : null
  return p ?? profileForDestination(country)
}

/** All legs for a trip, resolved to currency/timezone/flag. Ordered by date. */
export async function getTripSegments(trip: TripLike): Promise<ResolvedSegment[]> {
  const rows = await prisma.tripSegment.findMany({
    where: { tripId: trip.id },
    orderBy: [{ startDate: 'asc' }, { displayOrder: 'asc' }],
  })

  if (rows.length > 0) {
    return rows.map((r) => {
      const p = resolveByIso(r.isoNumeric, r.country)
      const currency = p.currency || 'USD'
      return {
        id: r.id,
        country: p.label && p.label !== 'Unknown' ? p.label : r.country,
        isoNumeric: r.isoNumeric ?? p.isoNumeric ?? null,
        currency,
        currencySymbol: currencySymbol(currency),
        timezone: p.timezone || 'UTC',
        flag: p.passportIcon ?? null,
        startDate: r.startDate,
        endDate: r.endDate,
      }
    })
  }

  // Implicit single leg from the trip destination.
  const profile = profileForDestination(trip.destination)
  const currency = trip.localCurrency ?? profile.currency ?? 'USD'
  return [{
    id: null,
    country: profile.label && profile.label !== 'Unknown' ? profile.label : trip.destination,
    isoNumeric: profile.isoNumeric ?? null,
    currency,
    currencySymbol: currencySymbol(currency),
    timezone: trip.timezone && trip.timezone !== 'UTC' ? trip.timezone : profile.timezone,
    flag: profile.passportIcon ?? null,
    startDate: trip.startDate,
    endDate: trip.endDate,
  }]
}

/** True when a trip genuinely spans more than one country. */
export function isMultiCountry(segments: ResolvedSegment[]): boolean {
  const countries = new Set(segments.map((s) => s.country))
  return countries.size > 1
}

/**
 * The leg relevant "right now": the one containing today; else the next
 * upcoming leg (trip not started); else the final leg (trip over).
 */
export function activeSegment(segments: ResolvedSegment[], now: Date = new Date()): ResolvedSegment | null {
  if (segments.length === 0) return null
  const today = startOfDay(now)
  const current = segments.find(
    (s) => today >= startOfDay(s.startDate) && today <= startOfDay(s.endDate),
  )
  if (current) return current
  const upcoming = segments
    .filter((s) => startOfDay(s.startDate) > today)
    .sort((a, b) => +a.startDate - +b.startDate)[0]
  if (upcoming) return upcoming
  return segments[segments.length - 1]
}
