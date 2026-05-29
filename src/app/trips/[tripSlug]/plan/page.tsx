/**
 * "Let Itinera plan it" — preferences page.
 *
 * Itinera (Claude) generates destination-aware categories of taggable things
 * to do; the traveller ticks what they're into, sets a budget tier + pace, and
 * submits. generateTripPlan then drafts a day-by-day plan (grouped by area so
 * each day flows) and drops it onto the itinerary as removable suggestions.
 *
 * Renders inside the trip layout (top bar / breadcrumb), so this is just the
 * page body.
 */

import { Sparkles } from 'lucide-react'
import { requireTripAccess } from '@/lib/session'
import { getTripSegments } from '@/lib/segments'
import { generatePlanOptions } from '@/lib/trip-planner'
import { PlanTripFormClient } from '@/components/PlanTripFormClient'

export default async function PlanPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const { trip } = await requireTripAccess(tripSlug)
  const segments = await getTripSegments(trip)
  const cities = segments.map((s) => s.country).join(', ')
  const categories = await generatePlanOptions(trip.destination, cities)

  return (
    <div className="px-5 sm:px-10 py-8 sm:py-12 max-w-3xl">
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted flex items-center gap-2">
        <Sparkles className="w-3 h-3" /> Plan with Itinera
      </div>
      <h1 className="h-display text-4xl sm:text-5xl mt-2">What are you into?</h1>
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
