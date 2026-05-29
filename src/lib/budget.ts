/**
 * Budget-loop math for the planning → booking bridge. Turns a trip's bookings
 * into "how much of my experiences budget have I committed, and where would I
 * land if I kept every idea?" — the feedback that closes the planning loop on
 * the itinerary.
 *
 * Scope: activities + restaurants only — the "things to do + dining" the planner
 * is given a budget for. Lodging, flights and transit live on the Costs tab.
 *
 * Currency & party size: AI estimates are captured PER PERSON in the trip's
 * home currency (see createSuggestionRows / the planner tool schemas), so a
 * party total is estimate × party size. Real booked costs are already party
 * totals (what the traveller actually paid), so they're taken as-is.
 */

import { startOfDay, addDays } from 'date-fns'
import { convertCurrency } from './destinations'
import type { Booking } from '@prisma/client'

const EXPERIENCE_TYPES = new Set(['activity', 'restaurant'])

/**
 * A baseline daily food allowance, per person, in USD — converted to the trip's
 * home currency at read time. Mid-range: enough for casual breakfast/lunch and a
 * sit-down dinner without being a splurge. Only applied to days where the
 * traveller hasn't logged a specific dining cost, so a real meal always wins.
 */
const FOOD_PER_PERSON_PER_DAY_USD = 60

/**
 * A booking's cost expressed as a PARTY total. Real booked rows are already
 * party totals (what the traveller actually paid); estimate rows from the
 * planner (idea / planned / to_book) are captured PER PERSON, so they scale by
 * party size. Centralised so every money surface applies the same convention.
 */
export function bookingPartyCost(
  b: { status: string; cost: number | null },
  partySize: number,
): number {
  if (b.cost == null) return 0
  return b.status === 'booked' ? b.cost : b.cost * Math.max(1, partySize)
}

/** Statuses that represent real or kept spend (everything except unkept ideas). */
export function isCommittedStatus(status: string): boolean {
  return status === 'booked' || status === 'planned' || status === 'to_book'
}

export type PlanBudget = {
  currency: string
  /** The traveller's stated budget for experiences + dining, or null if they set a tier instead of a number. */
  budget: number | null
  partySize: number
  /** Party totals, in the home currency. */
  booked: number
  planned: number // status 'planned' + 'to_book'
  ideas: number // status 'idea' (not yet kept)
  /** Baseline food allowance for trip days with no logged dining cost (party total). */
  food: number
  /** Per-person daily food allowance used, in home currency (for display). */
  foodPerPersonPerDay: number
  /** How many trip days fall back to the food estimate. */
  foodEstimateDays: number
  committed: number // booked + planned — what they're on the hook for
  projected: number // committed + ideas + food — where they'd land keeping everything
  /** How many experiences contribute a cost (drives whether the bar renders at all). */
  itemCount: number
}

type BudgetInput = Pick<Booking, 'type' | 'status' | 'cost' | 'metadata' | 'startAt'>

/**
 * The plan's budget amount is stashed on each suggestion's prefs metadata (no
 * schema column). Any idea/planned row from that generation carries it; take
 * the first that parses to a positive number, preferring still-live suggestions.
 */
function budgetFromMetadata(bookings: BudgetInput[]): number | null {
  const ordered = [...bookings].sort((a, b) => rank(a.status) - rank(b.status))
  for (const b of ordered) {
    if (!b.metadata) continue
    try {
      const meta = JSON.parse(b.metadata) as { prefs?: { budgetAmount?: unknown } }
      const raw = meta?.prefs?.budgetAmount
      const n =
        typeof raw === 'number' ? raw
        : typeof raw === 'string' ? parseFloat(raw.replace(/[^0-9.]/g, ''))
        : NaN
      if (Number.isFinite(n) && n > 0) return n
    } catch {
      /* ignore unparseable metadata */
    }
  }
  return null
}

// idea/planned rows hold the freshest prefs; booked rows may have had metadata
// overwritten by a forwarded confirmation, so look at them last.
function rank(status: string): number {
  return status === 'idea' ? 0 : status === 'planned' || status === 'to_book' ? 1 : 2
}

export function computePlanBudget(
  bookings: BudgetInput[],
  opts: { homeCurrency: string; partySize: number; tripStart?: Date; tripEnd?: Date },
): PlanBudget {
  const partySize = Math.max(1, opts.partySize)
  let booked = 0
  let planned = 0
  let ideas = 0
  let itemCount = 0
  // Days that already carry a specific dining cost — these "spend" their food
  // budget explicitly, so the generic estimate skips them (no double counting).
  const diningDays = new Set<number>()

  for (const b of bookings) {
    if (b.type === 'restaurant' && b.cost != null && b.startAt) {
      diningDays.add(startOfDay(b.startAt).getTime())
    }
    if (!EXPERIENCE_TYPES.has(b.type) || b.cost == null) continue
    if (b.status === 'booked') {
      booked += b.cost // already a party total
      itemCount++
    } else if (b.status === 'planned' || b.status === 'to_book') {
      planned += b.cost * partySize
      itemCount++
    } else if (b.status === 'idea') {
      ideas += b.cost * partySize
      itemCount++
    }
  }

  // Food estimate: a per-person daily allowance for every trip day WITHOUT a
  // logged meal. As real dining costs are added, those days drop out and the
  // estimate shrinks — the "estimate disappears when you log the real thing"
  // behaviour, applied per day.
  const foodPerPersonPerDay = Math.round(convertCurrency(FOOD_PER_PERSON_PER_DAY_USD, 'USD', opts.homeCurrency))
  let foodEstimateDays = 0
  if (opts.tripStart && opts.tripEnd) {
    const last = startOfDay(opts.tripEnd).getTime()
    for (let d = startOfDay(opts.tripStart); d.getTime() <= last; d = addDays(d, 1)) {
      if (!diningDays.has(d.getTime())) foodEstimateDays++
    }
  }
  const food = foodEstimateDays * foodPerPersonPerDay * partySize

  const committed = booked + planned
  return {
    currency: opts.homeCurrency,
    budget: budgetFromMetadata(bookings),
    partySize,
    booked,
    planned,
    ideas,
    food,
    foodPerPersonPerDay,
    foodEstimateDays,
    committed,
    projected: committed + ideas + food,
    itemCount,
  }
}
