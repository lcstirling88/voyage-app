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
import { geocodePlace } from './weather'

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

/**
 * Best-effort legs derived from accommodation bookings: geocode each hotel's
 * location to a country, then merge consecutive same-country stays into legs.
 * The first/last legs stretch to cover the whole trip (arrival/departure days).
 * Returns [] when there are no hotels or none geocode — callers fall back to
 * the implicit single destination leg. Geocoding is cached (30d), and distinct
 * place strings are deduped + fetched in parallel to keep this cheap.
 */
async function deriveSegmentsFromBookings(trip: TripLike): Promise<ResolvedSegment[]> {
  const hotels = await prisma.booking.findMany({
    where: { tripId: trip.id, type: 'hotel' },
    orderBy: { startAt: 'asc' },
    select: { location: true, address: true, title: true, startAt: true, endAt: true },
  })
  if (hotels.length === 0) return []

  const placeOf = (h: (typeof hotels)[number]) => (h.location || h.address || h.title || '').trim()
  const distinct = [...new Set(hotels.map(placeOf).filter(Boolean))]
  // Bias ambiguous hotel place-names toward the trip's destination country so a
  // "Queenstown" stay on a New Zealand trip isn't geocoded to South Africa. The
  // hint only disambiguates same-named places; genuinely foreign cities (a
  // distinct name) still fall through to the population-ranked match, so this
  // stays safe for real multi-country trips.
  const destProfile = profileForDestination(trip.destination)
  const countryHint =
    destProfile.label && destProfile.label !== 'Unknown' ? destProfile.label : trip.destination.trim()
  const geoEntries = await Promise.all(
    distinct.map(async (p) => [p, await geocodePlace(p, { countryHint })] as const),
  )
  const geoByPlace = new Map(geoEntries)

  type Leg = { country: string; profile: ReturnType<typeof profileForDestination>; start: Date; end: Date }
  const legs: Leg[] = []
  for (const h of hotels) {
    const geo = geoByPlace.get(placeOf(h))
    if (!geo?.country) continue
    const profile = profileForDestination(geo.country)
    const country = profile.label && profile.label !== 'Unknown' ? profile.label : geo.country
    const start = h.startAt
    const end = h.endAt ?? h.startAt
    const last = legs[legs.length - 1]
    if (last && last.country === country) {
      if (end > last.end) last.end = end
    } else {
      legs.push({ country, profile, start, end })
    }
  }
  if (legs.length === 0) return []

  // Stretch the ends so the whole trip window is covered (arrival/departure).
  if (trip.startDate < legs[0].start) legs[0].start = trip.startDate
  if (trip.endDate > legs[legs.length - 1].end) legs[legs.length - 1].end = trip.endDate

  return legs.map((l) => {
    const currency = l.profile.currency || 'USD'
    return {
      id: null,
      country: l.country,
      isoNumeric: l.profile.isoNumeric ?? null,
      currency,
      currencySymbol: currencySymbol(currency),
      timezone: l.profile.timezone || 'UTC',
      flag: l.profile.passportIcon ?? null,
      startDate: l.start,
      endDate: l.end,
    }
  })
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

  // No manual legs — try to auto-derive them from accommodation bookings.
  const auto = await deriveSegmentsFromBookings(trip)
  if (auto.length > 0) return auto

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
