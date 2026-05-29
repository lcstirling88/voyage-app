/**
 * "Let Itinera plan it" — Step 1: the ROUTE.
 *
 * Before any booking exists, the traveller shapes the backbone of the trip:
 * which cities to base in, in what order, for how many nights. Itinera can
 * propose a route or they can build it by hand. This skeleton is what makes
 * planning-from-zero work — it colours the calendar and anchors the day-by-day
 * planner (Step 2, /plan/days) even with nothing booked.
 *
 * Renders inside the trip layout, so this is just the page body.
 */

import { differenceInDays, format, startOfDay } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { cityForBooking } from '@/lib/itinerary'
import { mapRowsToSkeleton } from '@/lib/skeleton'
import type { RouteStopDTO } from '@/lib/actions'
import { RoutePlannerClient } from '@/components/RoutePlannerClient'
import { PlanSteps } from '@/components/PlanSteps'

export default async function PlanRoutePage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const { trip } = await requireTripAccess(tripSlug)

  // Prefer an existing route skeleton. If there's none (or only the legacy
  // full-span seed), pre-fill the editor from hotel bookings so an
  // already-booked trip starts with a sensible, editable route.
  const cityRows = await prisma.city.findMany({ where: { tripId: trip.id } })
  const skeleton = mapRowsToSkeleton(cityRows, trip.startDate, trip.endDate)

  let initialStops: RouteStopDTO[]
  if (skeleton.scheduled) {
    initialStops = skeleton.stops.map((s) => ({ city: s.city, country: s.country, nights: s.nights, note: s.note }))
  } else {
    const hotels = await prisma.booking.findMany({
      where: { tripId: trip.id, type: 'hotel' },
      orderBy: { startAt: 'asc' },
      select: { location: true, address: true, startAt: true, endAt: true },
    })
    const seeded: RouteStopDTO[] = []
    for (const h of hotels) {
      const city = cityForBooking(h)
      if (!city) continue
      const nights = h.endAt
        ? Math.max(1, differenceInDays(startOfDay(h.endAt), startOfDay(h.startAt)))
        : 1
      const last = seeded[seeded.length - 1]
      if (last && last.city === city) last.nights += nights
      else seeded.push({ city, country: trip.destination, nights, note: null })
    }
    initialStops = seeded
  }

  return (
    <div className="px-5 sm:px-10 py-8 sm:py-12 max-w-3xl">
      <PlanSteps tripSlug={trip.slug} current="route" />
      <h1 className="h-display text-4xl sm:text-5xl mt-5">Shape your route</h1>
      <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base leading-relaxed">
        Where will you base yourself in {trip.destination}, and for how long? Let Itinera propose a route that flows,
        or build your own. We&rsquo;ll spread your nights across the trip and land you home on the right day — then you
        fill each day with things to do.
      </p>

      <RoutePlannerClient
        tripSlug={trip.slug}
        destination={trip.destination}
        startDateISO={format(trip.startDate, 'yyyy-MM-dd')}
        endDateISO={format(trip.endDate, 'yyyy-MM-dd')}
        initialStops={initialStops}
      />
    </div>
  )
}
