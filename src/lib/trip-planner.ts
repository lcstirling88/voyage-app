/**
 * Trip planner helpers for "Let Itinera plan it".
 *
 * The planner is a three-step flow:
 *   1. Route        (cities + nights — generateRoute, below)
 *   2. Interests    (generic INTEREST_THEMES + budget + pace — a static list,
 *                    no model call, since the themes are universal)
 *   3. Specific picks (generateLocationPicks — per-city, top-rated NAMED
 *                    attractions under the chosen themes, each carrying an
 *                    imageQuery the page turns into a Wikipedia photo)
 *
 * The day-by-day plan generation itself lives in actions.ts (generateTripPlan)
 * because it writes bookings; it consumes the picks the traveller selects here.
 */

import { unstable_cache } from 'next/cache'
import { getAnthropic, PARSER_MODEL } from './anthropic'
import type { RouteStop } from './skeleton'

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)

// ----- Step 2: generic interest themes ----------------------------------------------

/**
 * A broad interest theme shown in Step 2. These are deliberately universal
 * (not destination-specific), so no model call is needed to list them. Each
 * carries an `icon` key (mapped to a lucide icon in components/theme-icons) and
 * a `hint` that steers the Step-3 picks model toward the right kind of place.
 */
export type InterestTheme = { id: string; label: string; icon: string; hint: string }

export const INTEREST_THEMES: InterestTheme[] = [
  { id: 'outdoors',  label: 'Outdoor activities',  icon: 'mountain',     hint: 'hikes, nature, scenic walks, adventure sports, water activities, viewpoints' },
  { id: 'landmarks', label: 'Iconic sights',        icon: 'landmark',     hint: 'famous landmarks, monuments, must-see icons, notable architecture' },
  { id: 'museums',   label: 'Museums & galleries',  icon: 'building-2',   hint: 'art museums, history museums, galleries, exhibitions' },
  { id: 'culture',   label: 'Culture & heritage',   icon: 'drama',        hint: 'temples, shrines, historic quarters, local traditions and heritage' },
  { id: 'food',      label: 'Food & drink',         icon: 'utensils',     hint: 'signature restaurants, street food, food markets, cafés, tastings' },
  { id: 'nightlife', label: 'Nightlife',            icon: 'martini',      hint: 'bars, clubs, rooftops, lively evening districts' },
  { id: 'shows',     label: 'Live shows',           icon: 'ticket',       hint: 'theatre, concerts, live music, performances, sport events' },
  { id: 'animals',   label: 'Animal experiences',   icon: 'paw-print',    hint: 'zoos, aquariums, wildlife encounters, sanctuaries, safaris' },
  { id: 'shopping',  label: 'Shopping',             icon: 'shopping-bag', hint: 'shopping districts, boutiques, markets, department stores' },
  { id: 'wellness',  label: 'Wellness & relaxing',  icon: 'flower-2',     hint: 'spas, onsen, hot springs, beaches, gardens, relaxation' },
  { id: 'family',    label: 'Family & kids',        icon: 'baby',         hint: 'theme parks, kid-friendly attractions, hands-on family fun' },
  { id: 'daytrips',  label: 'Day trips',            icon: 'route',        hint: 'easy half- and full-day excursions near the city' },
]

// ----- Step 3: per-location specific picks ------------------------------------------

export type LocationPick = {
  id: string
  name: string         // specific, real, named place / experience
  blurb: string        // one short line: what it is / why go
  theme: string        // INTEREST_THEMES id this belongs to
  imageQuery: string   // a precise search term for a Wikipedia photo
  image?: string | null
}
export type CityPicks = { city: string; picks: LocationPick[] }

async function generatePicksUncached(
  destination: string,
  cities: string[],
  themeIds: string[],
): Promise<CityPicks[]> {
  const anthropic = getAnthropic()
  const themes = INTEREST_THEMES.filter((t) => themeIds.includes(t.id))
  if (!anthropic || cities.length === 0 || themes.length === 0) return []

  const themeLines = themes.map((t) => `  - ${t.id}: ${t.label} (${t.hint})`).join('\n')
  const allowed = new Set(themes.map((t) => t.id))

  try {
    const response = await anthropic.messages.create({
      model: PARSER_MODEL,
      max_tokens: 6144,
      system:
        `You are an expert local travel concierge. For each city given, list the most popular, ` +
        `highest-rated, MUST-DO real attractions and experiences — the ones most acclaimed by travellers — ` +
        `that fall under the traveller's chosen interest themes. RULES:\n` +
        `- Only REAL, specific, NAMED places/experiences that actually exist in that city. Never generic ` +
        `("a museum", "a nice restaurant").\n` +
        `- Order each city's picks best-first (most acclaimed / iconic first).\n` +
        `- Up to 5 picks per theme per city, and at most 12 picks per city in total. Quality over quantity.\n` +
        `- Tag every pick with EXACTLY ONE of the provided theme ids.\n` +
        `- Only use the themes provided; if a theme has nothing strong in a city, skip it for that city.\n` +
        `- imageQuery: the best search term to find a PHOTO of this exact place on Wikipedia — usually its ` +
        `proper name plus the city (e.g. "Senso-ji Temple Tokyo", "Sydney Opera House").\n` +
        `- blurb: ONE short sentence on what it is / why it's worth it.`,
      tools: [{
        name: 'save_picks',
        description: 'Per-city lists of top-rated attractions under the chosen themes.',
        input_schema: {
          type: 'object' as const,
          properties: {
            cities: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  city: { type: 'string' as const, description: 'one of the cities given' },
                  picks: {
                    type: 'array' as const,
                    maxItems: 12,
                    items: {
                      type: 'object' as const,
                      properties: {
                        name: { type: 'string' as const, description: 'specific named place / experience' },
                        blurb: { type: 'string' as const, description: 'one short sentence' },
                        theme: { type: 'string' as const, description: 'one of the provided theme ids' },
                        imageQuery: { type: 'string' as const, description: 'search term for a Wikipedia photo' },
                      },
                      required: ['name', 'blurb', 'theme', 'imageQuery'],
                    },
                  },
                },
                required: ['city', 'picks'],
              },
            },
          },
          required: ['cities'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_picks' },
      messages: [{
        role: 'user',
        content:
          `Destination: ${destination}\n` +
          `Cities to cover (use ONLY these, never any other city): ${cities.join(', ')}\n` +
          `Chosen interest themes:\n${themeLines}\n\n` +
          `List the top picks per city now, best-first.`,
      }],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (toolUse && toolUse.type === 'tool_use') {
      const out = toolUse.input as {
        cities?: Array<{ city?: string; picks?: Array<Partial<LocationPick>> }>
      }
      const result: CityPicks[] = []
      const seen = new Set<string>()
      for (const c of out.cities ?? []) {
        const city = String(c.city ?? '').trim()
        if (!city) continue
        const picks: LocationPick[] = []
        for (const p of c.picks ?? []) {
          const name = String(p.name ?? '').trim()
          if (!name) continue
          const theme = allowed.has(String(p.theme)) ? String(p.theme) : themes[0].id
          let id = `${slugify(city)}-${slugify(name)}`
          while (seen.has(id)) id = `${id}-x`
          seen.add(id)
          picks.push({
            id,
            name,
            blurb: String(p.blurb ?? '').trim(),
            theme,
            imageQuery: String(p.imageQuery ?? `${name} ${city}`).trim(),
          })
        }
        if (picks.length) result.push({ city, picks })
      }
      if (result.length) return result
    }
  } catch (err) {
    console.error('[generateLocationPicks] error:', err)
  }
  return []
}

/**
 * Top-rated NAMED picks per city under the chosen themes, cached ~30 days. The
 * cache key folds in the (sorted) cities and themes so different selections
 * don't collide but a repeat of the same selection is instant.
 */
export async function generateLocationPicks(
  destination: string,
  cities: string[],
  themeIds: string[],
): Promise<CityPicks[]> {
  const cityKey = [...cities].sort().join('|')
  const themeKey = [...themeIds].sort().join(',')
  const cached = unstable_cache(
    () => generatePicksUncached(destination, cities, themeIds),
    ['location-picks', destination, cityKey, themeKey],
    { revalidate: 60 * 60 * 24 * 30 },
  )
  return cached()
}

// ----- Step 1: Route / skeleton generation ------------------------------------------

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
