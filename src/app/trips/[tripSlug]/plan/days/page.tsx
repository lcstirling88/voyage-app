/**
 * "Let Itinera plan it" — Step 2: interests & budget.
 *
 * With the route (Step 1, /plan) as the backbone, the traveller sets a budget,
 * taps the broad things they're into, and picks a pace. These are generic
 * themes (no model call needed). "Next" carries the choices to Step 3
 * (/plan/picks), where Itinera turns the themes into specific, named picks per
 * city — each with a photo — to choose from.
 */

import { requireTripAccess } from '@/lib/session'
import { INTEREST_THEMES } from '@/lib/trip-planner'
import { InterestsBudgetClient } from '@/components/InterestsBudgetClient'
import { PlanSteps } from '@/components/PlanSteps'

export default async function PlanDaysPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const { trip } = await requireTripAccess(tripSlug)

  return (
    <div className="px-5 sm:px-10 py-8 sm:py-12 max-w-3xl">
      <PlanSteps tripSlug={trip.slug} current="interests" />
      <h1 className="h-display text-4xl sm:text-5xl mt-5">What are you into?</h1>
      <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base leading-relaxed">
        Set a budget, tap what you&rsquo;d love to do in {trip.destination}, and choose a pace. Next, Itinera
        shows you the most-loved spots for each — with photos — so you can pick the ones that catch your eye.
      </p>

      <InterestsBudgetClient
        tripSlug={trip.slug}
        themes={INTEREST_THEMES}
        currency={trip.homeCurrency}
      />
    </div>
  )
}
