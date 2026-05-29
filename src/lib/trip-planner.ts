/**
 * Trip planner — AI-generated preference options for "Let Itinera plan it".
 *
 * generatePlanOptions(destination, cities) returns destination-specific
 * categories of taggable things to do (theme parks, museums, food, quirky,
 * day trips…), each with NAMED options. Cached per destination so the model
 * isn't re-called on every visit. The day-by-day plan generation itself lives
 * in actions.ts (generateTripPlan) because it writes bookings.
 */

import { unstable_cache } from 'next/cache'
import { getAnthropic, PARSER_MODEL } from './anthropic'
import type { RouteStop } from './skeleton'

export type PlanOption = { id: string; label: string }
export type PlanCategory = { key: string; label: string; options: PlanOption[] }

// Generic fallback if the model is unavailable — still useful, just not
// destination-specific.
const FALLBACK_CATEGORIES: PlanCategory[] = [
  { key: 'sights', label: 'Sights & landmarks', options: [
    { id: 'icons', label: 'The famous icons' },
    { id: 'viewpoints', label: 'Viewpoints & skylines' },
    { id: 'old-town', label: 'Old town & historic streets' },
    { id: 'architecture', label: 'Notable architecture' },
  ] },
  { key: 'culture', label: 'Museums & culture', options: [
    { id: 'art', label: 'Art museums' },
    { id: 'history', label: 'History & heritage' },
    { id: 'galleries', label: 'Galleries & design' },
  ] },
  { key: 'food', label: 'Food & dining', options: [
    { id: 'street-food', label: 'Street food & markets' },
    { id: 'local-classics', label: 'Local classic dishes' },
    { id: 'special-dinner', label: 'A special dinner out' },
    { id: 'cafes', label: 'Cafés & coffee' },
  ] },
  { key: 'outdoors', label: 'Outdoors & nature', options: [
    { id: 'parks', label: 'Parks & gardens' },
    { id: 'walks', label: 'Walks & hikes' },
    { id: 'water', label: 'Beaches & water' },
  ] },
  { key: 'quirky', label: 'Quirky & local', options: [
    { id: 'hidden-gems', label: 'Hidden gems' },
    { id: 'shopping', label: 'Shopping & boutiques' },
    { id: 'nightlife', label: 'Bars & nightlife' },
  ] },
  { key: 'daytrips', label: 'Day trips', options: [
    { id: 'nearby', label: 'Easy day trips nearby' },
  ] },
]

async function generateUncached(destination: string, cities: string): Promise<PlanCategory[]> {
  const anthropic = getAnthropic()
  if (!anthropic) return FALLBACK_CATEGORIES
  try {
    const response = await anthropic.messages.create({
      model: PARSER_MODEL,
      max_tokens: 2048,
      system:
        `You are an expert local travel concierge. For the given destination, produce a set of categories ` +
        `of things a traveller might want to do, each with SPECIFIC, NAMED options real to that place ` +
        `(actual attractions, experiences, neighbourhoods, signature dishes, day trips — never generic ` +
        `labels like "a museum"). Return 5-7 categories, each with 4-8 options. Keep option labels short ` +
        `(2-5 words). Include a mix: signature attractions, museums/culture, food & dining, quirky/local ` +
        `experiences, outdoors, and short local day trips. Tailor everything to the SPECIFIC cities/areas ` +
        `named in the user message — every option must be in one of those cities; never include ` +
        `attractions from any other city.`,
      tools: [{
        name: 'save_plan_options',
        description: 'Destination-specific categories of taggable things to do.',
        input_schema: {
          type: 'object' as const,
          properties: {
            categories: {
              type: 'array' as const,
              minItems: 4,
              maxItems: 7,
              items: {
                type: 'object' as const,
                properties: {
                  key: { type: 'string' as const, description: 'short slug, e.g. "theme-parks"' },
                  label: { type: 'string' as const, description: 'category heading' },
                  options: {
                    type: 'array' as const,
                    minItems: 3,
                    maxItems: 8,
                    items: {
                      type: 'object' as const,
                      properties: {
                        id: { type: 'string' as const, description: 'short slug, unique within category' },
                        label: { type: 'string' as const, description: 'specific named option' },
                      },
                      required: ['id', 'label'],
                    },
                  },
                },
                required: ['key', 'label', 'options'],
              },
            },
          },
          required: ['categories'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_plan_options' },
      messages: [{
        role: 'user',
        content: `Destination: ${destination}\nCities / areas on this trip: ${cities || destination}`,
      }],
    })
    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (toolUse && toolUse.type === 'tool_use') {
      const out = toolUse.input as { categories?: PlanCategory[] }
      if (out.categories && out.categories.length) return out.categories
    }
  } catch (err) {
    console.error('[generatePlanOptions] error:', err)
  }
  return FALLBACK_CATEGORIES
}

/** Destination-specific preference categories, cached ~30 days per destination. */
export async function generatePlanOptions(destination: string, cities: string): Promise<PlanCategory[]> {
  const cached = unstable_cache(
    () => generateUncached(destination, cities),
    ['plan-options', destination, cities],
    { revalidate: 60 * 60 * 24 * 30 },
  )
  return cached()
}

// ----- Route / skeleton generation --------------------------------------------------

export type GenerateRouteInput = {
  destination: string
  countries: string[]      // distinct countries on the trip (multi-country aware)
  totalNights: number
  adultCount: number
  childCount: number
  childrenAges: string | null
  mustInclude: string[]    // cities the traveller insists on
  notes: string            // free-text steer ("beaches", "no long drives", …)
}

/**
 * Ask Itinera to propose a realistic multi-city ROUTE for the trip: which
 * cities, in what order, for how many nights — summing to the trip's total
 * nights. This is the skeleton the day-by-day planner then fills. Returns the
 * desired stops (city + nights); the caller turns nights into dates via
 * skeleton.allocate(). Not cached — it depends on dates, party and steer.
 */
export async function generateRoute(input: GenerateRouteInput): Promise<RouteStop[]> {
  const anthropic = getAnthropic()
  if (!anthropic) return []

  const { destination, countries, totalNights, adultCount, childCount, childrenAges, mustInclude, notes } = input
  const countryLine = countries.length ? countries.join(', ') : destination
  const partyLine =
    `${adultCount} adult(s)` +
    (childCount ? `, ${childCount} child(ren)${childrenAges ? ` aged ${childrenAges}` : ''}` : '')

  try {
    const response = await anthropic.messages.create({
      model: PARSER_MODEL,
      max_tokens: 1536,
      system:
        `You are an expert trip-routing concierge. Given a destination, the total number of nights, and the ` +
        `travelling party, propose a REALISTIC route of cities to base in — the kind a good travel agent would ` +
        `suggest. RULES:\n` +
        `- The nights across all stops MUST sum to exactly the total nights given.\n` +
        `- Order stops to minimise backtracking (a sensible geographic flow, e.g. arrival hub → onward → ` +
        `return), accounting for how people actually move between these cities.\n` +
        `- Don't over-fragment: prefer fewer, longer stays unless the trip is long. As a rule of thumb give a ` +
        `city at least 2-3 nights; only use a 1-night stop for a deliberate stopover.\n` +
        `- Stay within the destination country/countries given. Use real, well-known bases travellers actually ` +
        `sleep in (cities/towns), not regions or attractions.\n` +
        `- Always include any "must include" cities the traveller named.\n` +
        `- Factor in the party: with young children, fewer moves and shorter transfers.\n` +
        `- For each stop give a ONE-line note on why it's worth the nights (what they'll do / see there).`,
      tools: [{
        name: 'save_route',
        description: 'An ordered multi-city route whose nights sum to the trip total.',
        input_schema: {
          type: 'object' as const,
          properties: {
            stops: {
              type: 'array' as const,
              minItems: 1,
              items: {
                type: 'object' as const,
                properties: {
                  city: { type: 'string' as const, description: 'City/town to base in' },
                  country: { type: 'string' as const, description: 'Country this city is in' },
                  nights: { type: 'number' as const, description: 'Nights based here (integer ≥ 1)' },
                  note: { type: 'string' as const, description: 'One line: why it earns these nights' },
                },
                required: ['city', 'country', 'nights'],
              },
            },
          },
          required: ['stops'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_route' },
      messages: [{
        role: 'user',
        content:
          `Destination: ${destination}\n` +
          `Country/countries on this trip: ${countryLine}\n` +
          `Total nights to allocate: ${totalNights}\n` +
          `Travelling party: ${partyLine}\n` +
          `Must include these cities: ${mustInclude.length ? mustInclude.join(', ') : '(none specified)'}\n` +
          `Extra steer: ${notes || '(none)'}\n\n` +
          `Propose the route now — nights must sum to exactly ${totalNights}.`,
      }],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (toolUse && toolUse.type === 'tool_use') {
      const out = toolUse.input as { stops?: Array<{ city?: string; country?: string; nights?: number; note?: string }> }
      const stops = (out.stops ?? [])
        .map((s) => ({
          city: String(s.city ?? '').trim(),
          country: String(s.country ?? destination).trim(),
          nights: Math.max(1, Math.round(Number(s.nights) || 1)),
          note: s.note ? String(s.note) : null,
        }))
        .filter((s) => s.city)
      if (stops.length) return stops
    }
  } catch (err) {
    console.error('[generateRoute] error:', err)
  }
  return []
}
