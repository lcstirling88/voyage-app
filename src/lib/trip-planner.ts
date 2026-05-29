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
        `experiences, outdoors, and day trips. Tailor everything tightly to the destination.`,
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
