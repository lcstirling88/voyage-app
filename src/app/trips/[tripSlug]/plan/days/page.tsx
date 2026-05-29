/**
 * "Let Itinera plan it" — Step 2: fill the DAYS.
 *
 * With the route (Step 1, /plan) as the backbone, Itinera generates
 * destination-aware categories of taggable things to do; the traveller ticks
 * what they're into, sets a budget tier + pace, and submits. generateTripPlan
 * then drafts a day-by-day plan (grouped by area so each day flows) and drops
 * it onto the itinerary as removable suggestions.
 *
 * Options are confined to the cities the trip actually visits — preferring the
 * route skeleton, then hotels, then the trip's countries.
 */

import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { getTripSegments } from '@/lib/segments'
import { cityForBooking } from '@/lib/itinerary'
import { mapRowsToSkeleton } from '@/lib/skeleton'
import { generatePlanOptions } from '@/lib/trip-planner'
import { PlanTripFormClient } from '@/components/PlanTripFormClient'
import { PlanSteps } from '@/components/PlanSteps'

export default async function PlanDaysPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const { trip } = await requireTripAccess(tripSlug)

  // Confine options to where the trip actually goes. Prefer the route
  // skeleton; fall back to hotel cities, then the trip's countries.
  const cityRows = await prisma.city.findMany({ where: { tripId: trip.id } })
  const skeleton = mapRowsToSkeleton(cityRows, trip.startDate, trip.endDate)

  let cities: string
  if (skeleton.scheduled) {
    cities = [...new Set(skeleton.stops.map((s) => s.city))].join(', ')
  } else {
    const hotels = await prisma.booking.findMany({
      where: { tripId: trip.id, type: 'hotel' },
      select: { location: true, address: true },
    })
    const hotelCities = [...new Set(hotels.map((h) => cityForBooking(h)).filter((c): c is string => !!c))]
    cities = hotelCities.length
      ? hotelCities.join(', ')
      : (await getTripSegments(trip)).map((s) => s.country).join(', ')
  }
  const categories = await generatePlanOptions(trip.destination, cities)

  return (
    <div className="px-5 sm:px-10 py-8 sm:py-12 max-w-3xl">
      <PlanSteps tripSlug={trip.slug} current="days" />
      <h1 className="h-display text-4xl sm:text-5xl mt-5">What are you into?</h1>
      <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base leading-relaxed">
        Tick what you&rsquo;d love to do in {trip.destination}, set a budget and a pace, and Itinera will fill
        your days with ideas — grouping things that are close together so each day flows. They arrive as
        removable suggestions on your itinerary, nothing booked.
      </p>

      <PlanTripFormClient
        tripSlug={trip.slug}
        categories={categories}
        currency={trip.homeCurrency}
      />
    </div>
  )
}
