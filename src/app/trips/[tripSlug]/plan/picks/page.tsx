/**
 * "Let Itinera plan it" — Step 3: specific picks.
 *
 * Carries the budget / pace / chosen themes from Step 2 (via URL query params,
 * so there's no DB write between steps). For each city the trip visits, Itinera
 * lists the most acclaimed, named attractions under those themes; we enrich each
 * with a Wikipedia photo (bounded concurrency, every fetch cached ~30d) and hand
 * them to the picker. With no valid themes we bounce back to Step 2.
 *
 * Cities are resolved exactly as the day planner does: route skeleton first,
 * then hotel cities, then the trip's countries.
 */

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { getTripSegments } from '@/lib/segments'
import { cityForBooking } from '@/lib/itinerary'
import { mapRowsToSkeleton } from '@/lib/skeleton'
import { INTEREST_THEMES, generateLocationPicks, type CityPicks } from '@/lib/trip-planner'
import { fetchPlaceImage, mapWithConcurrency } from '@/lib/place-image'
import { PicksFormClient } from '@/components/PicksFormClient'
import { PlanSteps } from '@/components/PlanSteps'

export default async function PlanPicksPage({
  params, searchParams,
}: {
  params: Promise<{ tripSlug: string }>
  searchParams: Promise<{ tier?: string; amount?: string; pace?: string; themes?: string }>
}) {
  const { tripSlug } = await params
  const sp = await searchParams
  const { trip } = await requireTripAccess(tripSlug)

  // Only themes we actually know about — anything else (or none) sends them back.
  const validThemes = (sp.themes ?? '')
    .split(',').map((s) => s.trim()).filter((id) => INTEREST_THEMES.some((t) => t.id === id))
  if (validThemes.length === 0) redirect(`/trips/${tripSlug}/plan/days`)

  const budgetTier = sp.tier ?? 'balanced'
  const budgetAmount = (sp.amount ?? '').trim()
  const pace = sp.pace ?? 'balanced'

  // Confine picks to where the trip actually goes (same precedence as the
  // day planner): route skeleton → hotel cities → the trip's countries.
  const cityRows = await prisma.city.findMany({ where: { tripId: trip.id } })
  const skeleton = mapRowsToSkeleton(cityRows, trip.startDate, trip.endDate)
  let cities: string[]
  if (skeleton.scheduled) {
    cities = [...new Set(skeleton.stops.map((s) => s.city))]
  } else {
    const hotels = await prisma.booking.findMany({
      where: { tripId: trip.id, type: 'hotel' },
      select: { location: true, address: true },
    })
    const hotelCities = [...new Set(hotels.map((h) => cityForBooking(h)).filter((c): c is string => !!c))]
    cities = hotelCities.length
      ? hotelCities
      : [...new Set((await getTripSegments(trip)).map((s) => s.country))]
  }

  const rawPicks = await generateLocationPicks(trip.destination, cities, validThemes)

  // Enrich with imagery. Fresh objects (don't mutate cached data); bounded
  // concurrency so a picks-heavy trip doesn't fan out to dozens of requests.
  const cityPicks: CityPicks[] = rawPicks.map((c) => ({
    city: c.city,
    picks: c.picks.map((p) => ({ ...p })),
  }))
  const flat = cityPicks.flatMap((c) => c.picks.map((pick) => ({ city: c.city, pick })))
  const images = await mapWithConcurrency(flat, 6, ({ city, pick }) =>
    fetchPlaceImage(pick.imageQuery, city),
  )
  flat.forEach(({ pick }, i) => { pick.image = images[i] })

  const themes = INTEREST_THEMES.filter((t) => validThemes.includes(t.id))

  return (
    <div className="px-5 sm:px-10 py-8 sm:py-12 max-w-5xl">
      <PlanSteps tripSlug={trip.slug} current="picks" />
      <h1 className="h-display text-4xl sm:text-5xl mt-5">Pick what catches your eye</h1>
      <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base leading-relaxed">
        The most-loved spots for what you&rsquo;re into, city by city. Tap the ones you&rsquo;d like to do —
        Itinera builds your days around them and fills the gaps. Nothing here is booked.
      </p>

      <PicksFormClient
        tripSlug={trip.slug}
        cityPicks={cityPicks}
        themes={themes}
        budgetTier={budgetTier}
        budgetAmount={budgetAmount}
        pace={pace}
      />
    </div>
  )
}
