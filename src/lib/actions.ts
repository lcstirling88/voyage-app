'use server'

import { randomBytes } from 'crypto'
import { format, startOfDay } from 'date-fns'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { prisma } from './db'
import { parseEmail, type ParserResult } from './email-parser'
import { persistParserResult } from './ingest'
import { deriveThemeFromDestination, type ThemeKey } from './theme'
import { requireUser, requireTripAccess } from './session'
import { getAnthropic, PARSER_MODEL } from './anthropic'
import { profileForDestination, profileForIsoNumeric } from './destinations'
import { uploadAttachment } from './blob'
import { getTripSegments } from './segments'
import { cityForBooking, sessionForHour, SESSION_DEFAULT_HOUR, type Session } from './itinerary'
import { allocate, mapRowsToSkeleton, cityForDate, tripNights, type RouteStop, type SkeletonStop } from './skeleton'
import { generateRoute } from './trip-planner'
import type { Booking } from '@prisma/client'

// ----- Trip creation ----------------------------------------------------------------

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'trip'
}

function generateInboxToken(): string {
  // 8 chars URL-safe, lowercased
  return randomBytes(6).toString('base64url').toLowerCase()
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let n = 2
  while (await prisma.trip.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`
    if (n > 100) throw new Error('Could not find a unique slug')
  }
  return slug
}

async function uniqueInboxToken(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const token = generateInboxToken()
    const existing = await prisma.trip.findUnique({ where: { inboxToken: token } })
    if (!existing) return token
  }
  throw new Error('Could not generate unique inbox token')
}

const STARTER_CHECKLIST = [
  { section: '3mo',    text: 'Book flights',                            position: 1 },
  { section: '3mo',    text: 'Book accommodation',                      position: 2 },
  { section: '3mo',    text: 'Check visa / entry requirements',         position: 3 },
  { section: '3mo',    text: 'Book signature restaurants / experiences', position: 4 },

  { section: '1mo',    text: 'Buy travel insurance',                    position: 1 },
  { section: '1mo',    text: 'Buy / activate eSIM',                     position: 2 },
  { section: '1mo',    text: 'Order foreign cash',                      position: 3 },
  { section: '1mo',    text: 'Notify bank of travel dates',             position: 4 },
  { section: '1mo',    text: 'Confirm seat selection',                  position: 5 },

  { section: '1wk',    text: 'Pack',                                    position: 1 },
  { section: '1wk',    text: 'Charge devices + power bank',             position: 2 },
  { section: '1wk',    text: 'Print booking PDFs as backup',            position: 3 },
  { section: '1wk',    text: 'Download offline maps',                   position: 4 },
  { section: '1wk',    text: 'Arrange mail / pets / plants',            position: 5 },

  { section: 'day_of', text: 'Passport, wallet, phone, charger',        position: 1 },
  { section: 'day_of', text: 'Switch on eSIM at the gate',              position: 2 },
  { section: 'day_of', text: 'Lock doors / windows',                    position: 3 },
  { section: 'day_of', text: 'Arrive at airport on time',               position: 4 },
] as const

export type CreateTripResult =
  | { ok: true; slug: string }
  | { ok: false; error: string }

export async function createTrip(formData: FormData): Promise<CreateTripResult> {
  const user = await requireUser()
  const name = String(formData.get('name') ?? '').trim()
  const tagline = String(formData.get('tagline') ?? '').trim() || null
  const destination = String(formData.get('destination') ?? '').trim()
  const startDateStr = String(formData.get('startDate') ?? '')
  const endDateStr = String(formData.get('endDate') ?? '')
  const homeCurrency = String(formData.get('homeCurrency') ?? 'AUD').trim().toUpperCase() || 'AUD'
  const travelerNames = String(formData.get('travelerNames') ?? '').trim() || null
  const departureCity = String(formData.get('departureCity') ?? '').trim() || null
  const themeOverride = String(formData.get('themeKey') ?? '').trim()
  const citiesRaw = String(formData.get('cities') ?? '').trim()
  const adultCount = Math.max(0, parseInt(String(formData.get('adultCount') ?? '1'), 10) || 1)
  const childCount = Math.max(0, parseInt(String(formData.get('childCount') ?? '0'), 10) || 0)
  const childrenAges = String(formData.get('childrenAges') ?? '').trim() || null
  const colorPalette = (String(formData.get('colorPalette') ?? 'pastel').trim() || 'pastel') as 'pastel' | 'jewel' | 'mono'

  // Validate
  if (!name) return { ok: false, error: 'Trip name is required.' }
  if (!destination) return { ok: false, error: 'Destination is required.' }
  if (!startDateStr || !endDateStr) return { ok: false, error: 'Start and end dates are required.' }
  const startDate = new Date(startDateStr + 'T00:00:00Z')
  const endDate = new Date(endDateStr + 'T00:00:00Z')
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { ok: false, error: 'Invalid dates.' }
  }
  if (endDate < startDate) return { ok: false, error: 'End date must be after start date.' }

  const themeKey: ThemeKey = (themeOverride as ThemeKey) || deriveThemeFromDestination(destination)
  const profile = profileForDestination(destination)
  const slug = await uniqueSlug(slugify(name))
  const inboxToken = await uniqueInboxToken()

  // Parse cities (optional)
  const cityNames = citiesRaw
    ? citiesRaw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 12)
    : []

  // Create everything in one transaction — including the owner Membership
  await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        slug,
        name,
        tagline,
        destination,
        themeKey,
        startDate,
        endDate,
        homeCurrency,
        localCurrency: profile.currency,
        timezone: profile.timezone,
        inboxToken,
        travelerNames,
        departureCity,
        adultCount,
        childCount,
        childrenAges,
        colorPalette,
        memberships: {
          create: { userId: user.id, role: 'owner' },
        },
      },
    })

    if (cityNames.length > 0) {
      // Seed a real route skeleton from the typed cities: split the trip's
      // nights roughly evenly across them (the last stop absorbs the remainder)
      // so the new trip already has a sensible backbone the user can tweak on
      // the planner's Route step. The previous code wrote every city spanning
      // the full trip, which is no longer how the skeleton is read.
      const total = tripNights(startDate, endDate)
      const per = Math.max(1, Math.floor(total / cityNames.length))
      const stops = allocate(
        cityNames.map((c) => ({ city: c, country: destination, nights: per })),
        startDate,
        endDate,
      )
      if (stops.length > 0) {
        await tx.city.createMany({
          data: stops.map((s) => ({
            tripId: trip.id,
            name: s.city,
            country: s.country,
            arriveOn: s.arriveOn,
            leaveOn: s.leaveOn,
            displayOrder: s.order,
          })),
        })
      }
    }

    await tx.checklistItem.createMany({
      data: STARTER_CHECKLIST.map((c) => ({ tripId: trip.id, ...c })),
    })
  })

  revalidatePath('/trips')
  // Land on the itinerary, where a brand-new (empty) trip is greeted with the
  // two doors: "let Itinera plan it" vs "I've already booked — forward emails".
  redirect(`/trips/${slug}/itinerary`)
}

// ----- AI Local Info generation -----------------------------------------------------

export type GenerateLocalInfoResult = { ok: true } | { ok: false; error: string }

export async function generateLocalInfo(formData: FormData): Promise<GenerateLocalInfoResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  const anthropic = getAnthropic()
  if (!anthropic) return { ok: false, error: 'AI not configured. Add ANTHROPIC_API_KEY.' }

  const { trip } = await requireTripAccess(tripSlug)

  // One local-info section per distinct country leg (multi-country aware).
  const segments = await getTripSegments(trip)
  const distinct: { country: string; iso: string | null }[] = []
  const seen = new Set<string>()
  for (const s of segments) {
    if (seen.has(s.country)) continue
    seen.add(s.country)
    distinct.push({ country: s.country, iso: s.isoNumeric })
  }
  if (distinct.length === 0) distinct.push({ country: trip.destination, iso: null })

  try {
    const results = await Promise.all(
      distinct.map(async (d) => ({ d, input: await requestCountryLocalInfo(anthropic, d.country, trip) })),
    )
    const countries = results
      .filter((r) => r.input)
      .map((r) => ({ country: r.d.country, isoNumeric: r.d.iso, info: { destination: r.d.country, ...r.input } }))
    if (countries.length === 0) return { ok: false, error: 'AI did not return local info.' }

    await prisma.trip.update({
      where: { id: trip.id },
      data: { localInfoJson: JSON.stringify({ generatedAt: new Date().toISOString(), countries }) },
    })
    revalidatePath(`/trips/${tripSlug}/local`)
    return { ok: true }
  } catch (err) {
    console.error('[generateLocalInfo]', err)
    return { ok: false, error: 'AI request failed. Try again.' }
  }
}

/** One Claude call producing the local-info blob for a single country. */
async function requestCountryLocalInfo(
  anthropic: NonNullable<ReturnType<typeof getAnthropic>>,
  country: string,
  trip: { homeCurrency: string; startDate: Date; endDate: Date; adultCount: number; childCount: number; childrenAges: string | null },
): Promise<Record<string, unknown> | null> {
  const response = await anthropic.messages.create({
      model: PARSER_MODEL,
      max_tokens: 4096,
      system:
        `You are an expert travel concierge generating ACCURATE, SPECIFIC local information for a traveler. ` +
        `Avoid generic clichés — give real, actionable, current advice. Be honest about what travelers commonly get wrong. ` +
        `For phrases: pick 8 most useful, ones a tourist will actually say. For emergency numbers: list the real numbers for that country plus relevant embassy / insurance hotlines where useful.`,
      tools: [{
        name: 'save_local_info',
        description: 'Save structured local-info content for this destination.',
        input_schema: {
          type: 'object' as const,
          properties: {
            tipping: {
              type: 'object' as const,
              properties: {
                summary: { type: 'string' as const, description: 'One-sentence summary of tipping culture.' },
                rules: { type: 'array' as const, items: { type: 'string' as const }, description: '3-5 specific situations and what to do (e.g. "Restaurants: 10–15% if no service charge").' },
              },
              required: ['summary', 'rules'],
            },
            power: {
              type: 'object' as const,
              properties: {
                type: { type: 'string' as const, description: 'Plug types, e.g. "Type I"' },
                voltage: { type: 'string' as const, description: 'e.g. "230V"' },
                frequency: { type: 'string' as const, description: 'e.g. "50Hz"' },
                notes: { type: 'array' as const, items: { type: 'string' as const }, description: '2-3 practical notes' },
              },
              required: ['type', 'voltage', 'frequency', 'notes'],
            },
            cashVsCard: {
              type: 'object' as const,
              properties: {
                summary: { type: 'string' as const },
                notes: { type: 'array' as const, items: { type: 'string' as const }, description: '3-5 practical notes' },
              },
              required: ['summary', 'notes'],
            },
            connectivity: {
              type: 'object' as const,
              properties: {
                summary: { type: 'string' as const },
                notes: { type: 'array' as const, items: { type: 'string' as const }, description: '3-5 specific notes — coverage, carriers, eSIM availability' },
              },
              required: ['summary', 'notes'],
            },
            phrases: {
              type: 'array' as const,
              minItems: 6,
              maxItems: 10,
              items: {
                type: 'object' as const,
                properties: {
                  phrase: { type: 'string' as const, description: 'Local-language phrase, romanised if non-Latin script' },
                  translation: { type: 'string' as const, description: 'English meaning' },
                },
                required: ['phrase', 'translation'],
              },
            },
            dontDoThis: {
              type: 'array' as const,
              minItems: 4,
              maxItems: 8,
              items: { type: 'string' as const, description: 'Specific cultural / etiquette warnings' },
            },
            emergencyNumbers: {
              type: 'array' as const,
              minItems: 2,
              maxItems: 6,
              items: {
                type: 'object' as const,
                properties: {
                  label: { type: 'string' as const, description: 'e.g. "Police", "Ambulance", "AU Embassy [city]"' },
                  number: { type: 'string' as const },
                },
                required: ['label', 'number'],
              },
            },
            ruleOfThumbCurrency: { type: 'string' as const, description: 'A quick mental conversion tip from home currency to local, e.g. "Drop the last digit on yen for a rough AUD figure".' },
          },
          required: ['tipping', 'power', 'cashVsCard', 'connectivity', 'phrases', 'dontDoThis', 'emergencyNumbers'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_local_info' },
      messages: [{
        role: 'user',
        content:
          `Generate local info for a traveler going to: ${country}\n` +
          `Home country (for currency / embassy references): ${trip.homeCurrency}\n` +
          `Trip dates: ${trip.startDate.toISOString().slice(0,10)} to ${trip.endDate.toISOString().slice(0,10)}\n` +
          `Travellers: ${trip.adultCount} adult(s), ${trip.childCount} child(ren)${trip.childrenAges ? ` aged ${trip.childrenAges}` : ''}\n` +
          `Please tailor where relevant (e.g. family-friendly notes if children, embassy of home country, etc.).`,
      }],
    })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') return null
  return toolUse.input as Record<string, unknown>
}

// ----- AI visa / entry requirements -------------------------------------------------

export type GenerateVisaResult = { ok: true } | { ok: false; error: string }

export async function generateVisaInfo(formData: FormData): Promise<GenerateVisaResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  const anthropic = getAnthropic()
  if (!anthropic) return { ok: false, error: 'AI not configured. Add ANTHROPIC_API_KEY.' }

  const { trip, user } = await requireTripAccess(tripSlug)

  // Passport = explicit nationality, else home country.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { nationalityIso: true, homeCountryIso: true },
  })
  const passportIso = dbUser?.nationalityIso ?? dbUser?.homeCountryIso ?? null
  if (!passportIso) {
    return { ok: false, error: 'Set your passport on your profile first.' }
  }
  const passportLabel = profileForIsoNumeric(passportIso)?.label ?? passportIso

  // Distinct destination countries from the trip legs (skip the passport
  // country itself — no visa needed for your own passport).
  const segments = await getTripSegments(trip)
  const distinct: { country: string; iso: string | null }[] = []
  const seen = new Set<string>()
  for (const s of segments) {
    if (s.isoNumeric === passportIso) continue
    if (seen.has(s.country)) continue
    seen.add(s.country)
    distinct.push({ country: s.country, iso: s.isoNumeric })
  }
  if (distinct.length === 0) {
    return { ok: false, error: 'No foreign destinations to check (you only travel within your passport country).' }
  }

  try {
    const response = await anthropic.messages.create({
      model: PARSER_MODEL,
      max_tokens: 3072,
      system:
        `You are an immigration & entry-requirements assistant. Given a traveller's passport nationality and a list of destination countries, return ACCURATE, CURRENT general entry requirements for short-stay tourism. ` +
        `Be specific about visa status (visa-free / ETA / eVisa / visa-on-arrival / visa-required), the permitted visa-free stay length in days, passport-validity rules (e.g. "valid 6 months beyond departure"), and any common gotchas (onward ticket, proof of funds, ETA application before travel). ` +
        `If you are not confident for a country, set status "unknown" and say so. This is general guidance only — the UI shows a disclaimer telling the user to verify with official government sources.`,
      tools: [{
        name: 'save_visa_info',
        description: 'Save per-country entry requirements for this passport holder.',
        input_schema: {
          type: 'object' as const,
          properties: {
            countries: {
              type: 'array' as const,
              minItems: 1,
              items: {
                type: 'object' as const,
                properties: {
                  country: { type: 'string' as const, description: 'Destination country name' },
                  status: { type: 'string' as const, enum: ['visa-free', 'eta', 'evisa', 'visa-on-arrival', 'visa-required', 'unknown'] },
                  allowedStayDays: { type: 'number' as const, description: 'Permitted visa-free/visa stay in days; omit if not applicable' },
                  summary: { type: 'string' as const, description: 'One sentence: what this passport holder needs to enter' },
                  requirements: { type: 'array' as const, items: { type: 'string' as const }, description: '2–5 specifics: passport validity, ETA/visa application steps, onward ticket, proof of funds' },
                  passportValidityRule: { type: 'string' as const, description: 'e.g. "Passport valid for 6 months beyond your departure date"' },
                },
                required: ['country', 'status', 'summary', 'requirements'],
              },
            },
          },
          required: ['countries'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_visa_info' },
      messages: [{
        role: 'user',
        content:
          `Passport / nationality: ${passportLabel}\n` +
          `Destination countries for this trip: ${distinct.map((d) => d.country).join(', ')}\n` +
          `Give short-stay tourist entry requirements for a ${passportLabel} passport holder for each destination.`,
      }],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return { ok: false, error: 'AI did not return visa info.' }
    }
    const out = toolUse.input as { countries: Array<Record<string, unknown>> }

    // Attach our isoNumeric to each returned country by name match.
    const countries = (out.countries ?? []).map((c) => {
      const name = String(c.country ?? '')
      const match = distinct.find((d) => d.country.toLowerCase() === name.toLowerCase())
      return {
        country: name,
        isoNumeric: match?.iso ?? null,
        status: String(c.status ?? 'unknown'),
        allowedStayDays: typeof c.allowedStayDays === 'number' ? c.allowedStayDays : null,
        summary: String(c.summary ?? ''),
        requirements: Array.isArray(c.requirements) ? c.requirements.map(String) : [],
        passportValidityRule: c.passportValidityRule ? String(c.passportValidityRule) : null,
      }
    })

    await prisma.trip.update({
      where: { id: trip.id },
      data: { visaInfoJson: JSON.stringify({ generatedAt: new Date().toISOString(), passportIso, passportLabel, countries }) },
    })

    revalidatePath(`/trips/${tripSlug}/local`)
    return { ok: true }
  } catch (err) {
    console.error('[generateVisaInfo]', err)
    return { ok: false, error: 'AI request failed. Try again.' }
  }
}

// ----- AI activity suggestions ------------------------------------------------------

export type Suggestion = {
  title: string
  time: string                                          // "HH:MM" 24h
  type: 'activity' | 'restaurant' | 'transit' | 'other'
  location?: string
  durationMinutes?: number
  notes: string
  estimatedCost?: number
  estimatedCurrency?: string
}

export type SuggestResult =
  | { ok: true; suggestions: Suggestion[] }
  | { ok: false; error: string }

export async function suggestActivities(formData: FormData): Promise<SuggestResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  const date = String(formData.get('date') ?? '')        // YYYY-MM-DD
  const session = String(formData.get('session') ?? '')  // morning|afternoon|night|''
  const query = String(formData.get('query') ?? '').trim()

  if (!tripSlug || !date) return { ok: false, error: 'Missing trip or date.' }
  if (!query) return { ok: false, error: "Tell me what you're after." }

  const anthropic = getAnthropic()
  if (!anthropic) {
    return { ok: false, error: 'AI not configured. Add ANTHROPIC_API_KEY to your environment.' }
  }

  const { trip } = await requireTripAccess(tripSlug)

  // Gather context: same-day bookings + nearby days' last/next items
  const dayStart = new Date(date + 'T00:00:00Z')
  const dayEnd = new Date(date + 'T23:59:59Z')
  const sameDay = await prisma.booking.findMany({
    where: { tripId: trip.id, startAt: { gte: dayStart, lte: dayEnd } },
    orderBy: { startAt: 'asc' },
  })

  const tripContext =
    `Trip name: ${trip.name}\n` +
    `Destination: ${trip.destination}\n` +
    `Trip dates: ${format(trip.startDate, 'yyyy-MM-dd')} to ${format(trip.endDate, 'yyyy-MM-dd')}\n` +
    `Travellers: ${trip.travelerNames ?? '(not specified)'}\n` +
    `Home currency: ${trip.homeCurrency}\n` +
    `Requested day: ${date}${session ? ` (${session})` : ''}\n` +
    `Already on this day:\n` +
    (sameDay.length === 0
      ? '  (nothing yet)\n'
      : sameDay.map((b) => `  - ${b.title} (${b.type}) at ${format(b.startAt, 'HH:mm')}`).join('\n'))

  try {
    const response = await anthropic.messages.create({
      model: PARSER_MODEL,
      max_tokens: 2048,
      system:
        `You are an expert travel concierge with deep, current local knowledge. ` +
        `Suggest specific, NAMED, actionable activities/restaurants/things to do based on the trip context and the user's request. ` +
        `Avoid generic answers ("find a cafe", "explore the town") — name real businesses, attractions, tours, neighborhoods, dishes. ` +
        `Each suggestion should slot naturally into the requested session (morning / afternoon / night). ` +
        `Use 24h time format (HH:MM). Keep notes to 1-2 sentences — why it's a good fit. ` +
        `Return up to 3 suggestions. If the user's request doesn't make sense or is too vague, still try your best.`,
      tools: [{
        name: 'suggest_activities',
        description: 'Return up to 3 specific travel suggestions for the given day/session.',
        input_schema: {
          type: 'object' as const,
          properties: {
            suggestions: {
              type: 'array' as const,
              minItems: 1,
              maxItems: 3,
              items: {
                type: 'object' as const,
                properties: {
                  title: { type: 'string' as const, description: 'Specific, named place or activity' },
                  time: { type: 'string' as const, description: '24h "HH:MM"' },
                  type: { type: 'string' as const, enum: ['activity', 'restaurant', 'transit', 'other'] },
                  location: { type: 'string' as const, description: 'Address or neighborhood' },
                  durationMinutes: { type: 'number' as const },
                  notes: { type: 'string' as const, description: '1-2 sentences why this fits' },
                  estimatedCost: { type: 'number' as const, description: `Per person, in the home currency ${trip.homeCurrency}` },
                  estimatedCurrency: { type: 'string' as const, description: `ISO 4217 — use ${trip.homeCurrency}` },
                },
                required: ['title', 'time', 'type', 'notes'],
              },
            },
          },
          required: ['suggestions'],
        },
      }],
      tool_choice: { type: 'tool', name: 'suggest_activities' },
      messages: [{ role: 'user', content: `${tripContext}\n\nUser request: ${query}` }],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return { ok: false, error: 'AI did not return suggestions.' }
    }
    const out = toolUse.input as { suggestions: Suggestion[] }
    return { ok: true, suggestions: out.suggestions ?? [] }
  } catch (err) {
    console.error('[suggestActivities] error:', err)
    return { ok: false, error: 'AI request failed. Try again in a moment.' }
  }
}

// ----- AI trip planner --------------------------------------------------------------

type PlanItem = {
  date: string
  session: 'morning' | 'afternoon' | 'night'
  type: 'activity' | 'restaurant'
  title: string
  area?: string
  location?: string
  estimatedCost?: number
  estimatedCurrency?: string
  note?: string
}

export type GenerateTripPlanResult = { ok: true; count: number } | { ok: false; error: string }
export type SwapSuggestionResult = { ok: true } | { ok: false; error: string }
export type RegenerateDayResult = { ok: true; count: number } | { ok: false; error: string }

/**
 * Preferences captured when the planner first ran. Stored on EACH suggestion's
 * metadata (no schema change) so the iterative actions — swap one, reimagine a
 * whole day — can stay true to what the traveller originally chose.
 */
type PlanPrefs = { interests: string[]; budgetTier: string; budgetAmount: string; pace: string }

const SESSION_TIME: Record<string, string> = { morning: '09:30', afternoon: '14:00', night: '19:00' }

function parseMeta(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {}
  try { const o = JSON.parse(s); return o && typeof o === 'object' ? (o as Record<string, unknown>) : {} } catch { return {} }
}
function isSuggested(b: { status: string }): boolean {
  return b.status === 'idea'
}
function readPrefsFromMeta(meta: Record<string, unknown>): PlanPrefs {
  const p = (meta.prefs ?? {}) as Record<string, unknown>
  return {
    interests: Array.isArray(p.interests) ? (p.interests as unknown[]).map(String) : [],
    budgetTier: typeof p.budgetTier === 'string' ? p.budgetTier : 'balanced',
    budgetAmount: typeof p.budgetAmount === 'string' ? p.budgetAmount : '',
    pace: typeof p.pace === 'string' ? p.pace : 'balanced',
  }
}

/** Budget + pace guidance lines, shared by the planner and its iterative cousins. */
function budgetPaceText(homeCurrency: string, prefs: PlanPrefs): { budgetText: string; paceText: string } {
  const budgetText = prefs.budgetAmount
    ? `Budget: roughly ${homeCurrency} ${prefs.budgetAmount} total for activities + dining across the trip — prioritise to fit.`
    : `Budget level: ${prefs.budgetTier} — ${
        prefs.budgetTier === 'budget' ? 'favour free / cheap experiences, street food, public transport'
        : prefs.budgetTier === 'splurge' ? 'premium experiences and notable restaurants are welcome'
        : 'sensible mid-range choices'
      }.`
  const paceText =
    prefs.pace === 'relaxed' ? '1-2 things per day with downtime'
    : prefs.pace === 'packed' ? '3-4 things per day, full days'
    : '2-3 things per day, balanced'
  return { budgetText, paceText }
}

/**
 * Which city the traveller is based in on a given date: the route skeleton
 * first (works before any booking), then the hotel covering that night, then
 * the bare destination.
 */
function cityForPlanDate(
  trip: { destination: string; endDate: Date },
  skeleton: { scheduled: boolean; stops: SkeletonStop[] },
  hotels: Array<Pick<Booking, 'location' | 'address' | 'startAt' | 'endAt'>>,
  date: Date,
): string {
  if (skeleton.scheduled) {
    const c = cityForDate(skeleton.stops, date, trip.endDate)
    if (c) return c
  }
  const d = startOfDay(date)
  for (const h of hotels) {
    const start = startOfDay(h.startAt)
    const end = h.endAt ? startOfDay(h.endAt) : start
    if (+d === +start || (d >= start && d < end)) {
      const c = cityForBooking(h)
      if (c) return c
    }
  }
  return trip.destination
}

/**
 * Create suggested booking rows from plan items. Stores area + session + the
 * capture-time prefs in metadata so each suggestion can be iterated on later.
 */
async function createSuggestionRows(
  trip: { id: string; startDate: Date; endDate: Date; localCurrency: string | null; homeCurrency: string },
  items: PlanItem[],
  prefs: PlanPrefs,
): Promise<number> {
  const tripStart = startOfDay(trip.startDate)
  const tripEnd = startOfDay(trip.endDate)
  let count = 0
  for (const it of items) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date)) continue
    const day = startOfDay(new Date(`${it.date}T00:00:00Z`))
    if (day < tripStart || day > tripEnd) continue
    const session = it.session === 'morning' || it.session === 'afternoon' || it.session === 'night' ? it.session : 'afternoon'
    const time = SESSION_TIME[session] ?? '12:00'
    const startAt = new Date(`${it.date}T${time}:00Z`)
    if (isNaN(startAt.getTime())) continue
    const type = it.type === 'restaurant' ? 'restaurant' : 'activity'
    await prisma.booking.create({
      data: {
        tripId: trip.id,
        type,
        title: (it.title || 'Suggestion').slice(0, 200),
        startAt,
        status: 'idea',
        location: it.location || it.area || null,
        notes: it.note || null,
        cost: typeof it.estimatedCost === 'number' ? it.estimatedCost : null,
        // Estimates are captured PER PERSON in the home currency (see tool schema)
        // so they sum cleanly against the trip budget — force it, don't trust the
        // model's currency label, to keep every estimate in one unit.
        currency: trip.homeCurrency,
        metadata: JSON.stringify({ __suggested: true, area: it.area ?? null, session, prefs }),
      },
    })
    count++
  }
  return count
}

/**
 * "Let Itinera plan it" — turn the traveller's ticked interests + budget + pace
 * into a day-by-day set of suggested activities/restaurants, grouped by area so
 * each day flows. Writes them as bookings flagged { __suggested: true } in
 * metadata (rendered as dashed placeholders on the itinerary). Regenerating
 * first clears any previous suggestions so it's idempotent.
 */
export async function generateTripPlan(formData: FormData): Promise<GenerateTripPlanResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }

  const interests = String(formData.get('interests') ?? '')
    .split('||').map((s) => s.trim()).filter(Boolean)
  const budgetTier = String(formData.get('budgetTier') ?? 'balanced')
  const budgetAmount = String(formData.get('budgetAmount') ?? '').trim()
  const pace = String(formData.get('pace') ?? 'balanced')

  const anthropic = getAnthropic()
  if (!anthropic) return { ok: false, error: 'AI not configured. Add ANTHROPIC_API_KEY to your environment.' }

  const { trip } = await requireTripAccess(tripSlug)
  const bookings = await prisma.booking.findMany({
    where: { tripId: trip.id },
    orderBy: { startAt: 'asc' },
  })

  // Where each date is based, so the model keeps a day's suggestions in one
  // area. The trip's ROUTE SKELETON (City rows) is the source of truth when it
  // exists — that's what makes planning work before any hotel is booked. We
  // fall back to the accommodation timeline, then to the bare destination.
  const cityRows = await prisma.city.findMany({ where: { tripId: trip.id } })
  const skeleton = mapRowsToSkeleton(cityRows, trip.startDate, trip.endDate)
  const hotels = bookings.filter((b) => b.type === 'hotel')

  let basedIn: string
  let tripCities: string[]
  if (skeleton.scheduled) {
    basedIn = skeleton.stops
      .map((s) => `  ${format(s.arriveOn, 'yyyy-MM-dd')} -> ${format(s.leaveOn, 'yyyy-MM-dd')}: ${s.city}`)
      .join('\n')
    tripCities = [...new Set(skeleton.stops.map((s) => s.city))]
  } else if (hotels.length) {
    basedIn = hotels
      .map((h) => {
        const city = cityForBooking(h) ?? h.location ?? trip.destination
        return `  ${format(h.startAt, 'yyyy-MM-dd')} -> ${format(h.endAt ?? h.startAt, 'yyyy-MM-dd')}: ${city}`
      })
      .join('\n')
    tripCities = [...new Set(hotels.map((h) => cityForBooking(h)).filter((c): c is string => !!c))]
  } else {
    basedIn = `  (no route or accommodation set yet — assume the whole trip is around ${trip.destination})`
    tripCities = []
  }

  // Suggestions must stay within these cities — the model otherwise wanders to
  // famous cities (e.g. adding Kyoto to a Tokyo + Hokkaido trip).
  const citiesLine = tripCities.length ? tripCities.join(', ') : trip.destination

  // What's already planned, so the model fills gaps rather than clashing.
  const existing = bookings.filter((b) => b.type !== 'hotel')
  const existingByDay = existing.length
    ? existing.map((b) => `  ${format(b.startAt, 'yyyy-MM-dd')} ${format(b.startAt, 'HH:mm')} — ${b.title} (${b.type})`).join('\n')
    : '  (nothing yet)'

  const prefs: PlanPrefs = { interests, budgetTier, budgetAmount, pace }
  const { budgetText, paceText } = budgetPaceText(trip.homeCurrency, prefs)

  const context =
    `Trip: ${trip.name}\n` +
    `Destination: ${trip.destination}\n` +
    `Cities on this trip — suggest ONLY places in these, never any other city: ${citiesLine}\n` +
    `Dates: ${format(trip.startDate, 'yyyy-MM-dd')} to ${format(trip.endDate, 'yyyy-MM-dd')}\n` +
    `Party: ${trip.adultCount} adult(s)${trip.childCount ? `, ${trip.childCount} child(ren)${trip.childrenAges ? ` aged ${trip.childrenAges}` : ''}` : ''}\n` +
    `Local spending currency: ${trip.localCurrency ?? trip.homeCurrency}. ESTIMATE EVERY COST PER PERSON IN THE HOME CURRENCY ${trip.homeCurrency} so it sums against their budget.\n\n` +
    `Accommodation timeline (which city they're based in each night; for any day not covered, use the nearest listed city by date — never introduce a new city):\n${basedIn}\n\n` +
    `Already on the itinerary (don't duplicate; build around these):\n${existingByDay}\n\n` +
    `Interests they ticked:\n${interests.length ? interests.map((i) => `  - ${i}`).join('\n') : '  - (open — surprise them with the classics)'}\n\n` +
    `${budgetText}\nPace: ${paceText}`

  try {
    const response = await anthropic.messages.create({
      model: PARSER_MODEL,
      // A WHOLE-trip plan is many items of JSON. Too small a ceiling truncates
      // the forced tool call mid-array → the JSON never closes → zero usable
      // items come back (for reference, one single day uses 2048). 8192 fits a
      // bounded first draft (~40 items, see the cap in the rules) comfortably.
      max_tokens: 8192,
      system:
        `You are an expert local travel concierge building a day-by-day plan of specific, NAMED ` +
        `activities and restaurants. RULES:\n` +
        `- CRITICAL: only suggest places located in the cities listed under "Cities on this trip". ` +
        `Never suggest anything in any other city (e.g. do not add Kyoto, Osaka or Nara unless they are ` +
        `in that list). No long-distance day trips.\n` +
        `- Use only dates within the trip range.\n` +
        `- Each date, the traveller is based in the city from the accommodation timeline — keep that ` +
        `day's suggestions in or very near that city.\n` +
        `- GROUP GEOGRAPHICALLY: cluster places close together (same neighbourhood/area) on the SAME day ` +
        `so the day flows with minimal back-and-forth. Always state the area.\n` +
        `- Honour the ticked interests; you may add a few complementary classics. Respect budget and pace.\n` +
        `- Put restaurants at sensible meal sessions (lunch = afternoon, dinner = night).\n` +
        `- Name REAL places, never generic ("a museum"). One short sentence per note.\n` +
        `- Don't duplicate things already on the itinerary.\n` +
        `- Keep it a focused FIRST DRAFT: about 2-3 per day and no more than ~40 across the whole ` +
        `trip. The traveller can reimagine any day for more later.`,
      tools: [{
        name: 'save_plan',
        description: 'A day-by-day set of suggested activities and restaurants.',
        input_schema: {
          type: 'object' as const,
          properties: {
            items: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  date: { type: 'string' as const, description: 'YYYY-MM-DD within the trip' },
                  session: { type: 'string' as const, enum: ['morning', 'afternoon', 'night'] },
                  type: { type: 'string' as const, enum: ['activity', 'restaurant'] },
                  title: { type: 'string' as const, description: 'specific named place / experience' },
                  area: { type: 'string' as const, description: 'neighbourhood / area used for grouping' },
                  location: { type: 'string' as const, description: 'address or area' },
                  estimatedCost: { type: 'number' as const, description: `per person, in the traveller's HOME currency ${trip.homeCurrency} (so it sums against their budget)` },
                  estimatedCurrency: { type: 'string' as const, description: `ISO 4217 — use ${trip.homeCurrency}` },
                  note: { type: 'string' as const, description: '1 sentence why it fits' },
                },
                required: ['date', 'session', 'type', 'title', 'area'],
              },
            },
          },
          required: ['items'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_plan' },
      messages: [{ role: 'user', content: context }],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return { ok: false, error: 'Itinera could not draft a plan. Try again.' }
    }
    const items = (toolUse.input as { items?: PlanItem[] }).items ?? []

    // A forced tool call that hits the token ceiling returns no usable items
    // (the JSON array never closes). Surface that rather than silently
    // "succeeding" with nothing — and DON'T wipe any existing suggestions.
    if (items.length === 0) {
      console.warn(`[generateTripPlan] empty plan (stop_reason=${response.stop_reason}) for ${tripSlug}`)
      return { ok: false, error: 'Itinera couldn’t draft your plan just now. Please try again.' }
    }

    // Clear previous suggestions so regenerating doesn't pile up duplicates —
    // only now that we have a fresh set in hand.
    await prisma.booking.deleteMany({
      where: { tripId: trip.id, status: 'idea' },
    })

    const count = await createSuggestionRows(trip, items, prefs)
    console.log(`[generateTripPlan] ${tripSlug}: stop=${response.stop_reason} items=${items.length} written=${count}`)

    // Items parsed but every one fell outside the trip dates (or failed
    // validation). Tell the traveller instead of dropping them on an
    // unchanged itinerary.
    if (count === 0) {
      return { ok: false, error: 'Itinera’s draft didn’t line up with your trip dates — please try again.' }
    }

    revalidatePath(`/trips/${tripSlug}/itinerary`)
    revalidatePath(`/trips/${tripSlug}`, 'layout')
    return { ok: true, count }
  } catch (err) {
    console.error('[generateTripPlan] error:', err)
    return { ok: false, error: 'AI request failed. Try again in a moment.' }
  }
}

// ----- Suggestion management (from the AI planner) ---------------------------------

/** "Keep" an AI idea: promote it from a dashed suggestion to a PLANNED item the
 *  traveller intends to do (status 'idea' → 'planned'). Also strips the legacy
 *  __suggested metadata flag so nothing stale lingers. */
export async function confirmSuggestion(formData: FormData): Promise<void> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!tripSlug || !id) return
  const { trip } = await requireTripAccess(tripSlug)
  const booking = await prisma.booking.findFirst({ where: { id, tripId: trip.id } })
  if (!booking) return
  let meta: Record<string, unknown> = {}
  try { meta = booking.metadata ? JSON.parse(booking.metadata) : {} } catch { meta = {} }
  delete meta.__suggested
  const newMeta = Object.keys(meta).length ? JSON.stringify(meta) : null
  await prisma.booking.update({ where: { id }, data: { status: 'planned', metadata: newMeta } })
  revalidatePath(`/trips/${tripSlug}/itinerary`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}

/** Remove every AI suggestion (status 'idea') from a trip in one go. */
export async function clearTripSuggestions(formData: FormData): Promise<void> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return
  const { trip } = await requireTripAccess(tripSlug)
  await prisma.booking.deleteMany({
    where: { tripId: trip.id, status: 'idea' },
  })
  revalidatePath(`/trips/${tripSlug}/itinerary`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}

/**
 * Move an item along the planning → booking lifecycle. Used by the "Book it"
 * (→ to_book) and "Mark booked" (→ booked) controls. Validated against the
 * known statuses so a bad value can't slip in.
 */
const BOOKING_STATUSES = new Set(['idea', 'planned', 'to_book', 'booked'])
export async function setBookingStatus(formData: FormData): Promise<void> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!tripSlug || !id || !BOOKING_STATUSES.has(status)) return
  const { trip } = await requireTripAccess(tripSlug)
  const booking = await prisma.booking.findFirst({ where: { id, tripId: trip.id } })
  if (!booking) return
  await prisma.booking.update({ where: { id }, data: { status } })
  revalidatePath(`/trips/${tripSlug}/itinerary`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}

/**
 * Swap a single suggestion for a fresh alternative — same day, same session,
 * same type, same city — honouring the preferences captured when the plan was
 * first generated (stored on the suggestion's metadata). Updates the row in
 * place so its spot on the itinerary holds.
 */
export async function swapSuggestion(formData: FormData): Promise<SwapSuggestionResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!tripSlug || !id) return { ok: false, error: 'Missing trip or suggestion.' }

  const anthropic = getAnthropic()
  if (!anthropic) return { ok: false, error: 'AI not configured.' }

  const { trip } = await requireTripAccess(tripSlug)
  const target = await prisma.booking.findFirst({ where: { id, tripId: trip.id } })
  if (!target) return { ok: false, error: 'Suggestion not found.' }
  if (!isSuggested(target)) return { ok: false, error: 'That item is not a suggestion.' }

  const meta = parseMeta(target.metadata)
  const prefs = readPrefsFromMeta(meta)
  const session: Session =
    meta.session === 'morning' || meta.session === 'afternoon' || meta.session === 'night'
      ? (meta.session as Session)
      : sessionForHour(target.startAt.getUTCHours())
  const type: 'activity' | 'restaurant' = target.type === 'restaurant' ? 'restaurant' : 'activity'
  const dateStr = target.startAt.toISOString().slice(0, 10)

  // Which city this day is based in (skeleton → hotel → bare destination).
  const cityRows = await prisma.city.findMany({ where: { tripId: trip.id } })
  const skeleton = mapRowsToSkeleton(cityRows, trip.startDate, trip.endDate)
  const allBookings = await prisma.booking.findMany({ where: { tripId: trip.id } })
  const hotels = allBookings.filter((b) => b.type === 'hotel')
  const city = cityForPlanDate(trip, skeleton, hotels, target.startAt)

  // Don't repeat anything already on the itinerary — including the item we're
  // replacing, so the alternative is genuinely different.
  const avoid = [...new Set(allBookings.filter((b) => b.type !== 'hotel').map((b) => b.title))]
  const { budgetText } = budgetPaceText(trip.homeCurrency, prefs)

  const context =
    `Trip: ${trip.name} — ${trip.destination}\n` +
    `Propose ONE ${type} in ${city} for ${dateStr} (${session}).\n` +
    `Estimate the cost PER PERSON in the home currency ${trip.homeCurrency} (their local spending currency is ${trip.localCurrency ?? trip.homeCurrency}).\n` +
    `Interests: ${prefs.interests.length ? prefs.interests.join(', ') : '(open)'}\n` +
    `${budgetText}\n` +
    `It MUST be a real, specific, named place in ${city}.\n` +
    `Do NOT propose any of these (already on the itinerary):\n${avoid.length ? avoid.map((t) => `  - ${t}`).join('\n') : '  (none)'}`

  try {
    const response = await anthropic.messages.create({
      model: PARSER_MODEL,
      max_tokens: 1024,
      system:
        `You are a local travel concierge proposing a single replacement ${type}. It must be in ` +
        `${city}, a real named place, fit the interests and budget, and must NOT duplicate anything ` +
        `in the avoid list. One short sentence for the note.`,
      tools: [{
        name: 'suggest_one',
        description: `A single replacement ${type}.`,
        input_schema: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const, description: 'specific named place / experience' },
            area: { type: 'string' as const, description: 'neighbourhood / area' },
            location: { type: 'string' as const, description: 'address or area' },
            estimatedCost: { type: 'number' as const, description: 'per person, local currency' },
            estimatedCurrency: { type: 'string' as const, description: 'ISO 4217, e.g. JPY' },
            note: { type: 'string' as const, description: '1 sentence why it fits' },
          },
          required: ['title', 'area'],
        },
      }],
      tool_choice: { type: 'tool', name: 'suggest_one' },
      messages: [{ role: 'user', content: context }],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return { ok: false, error: 'Itinera could not find an alternative.' }
    const pick = toolUse.input as {
      title?: string; area?: string; location?: string
      estimatedCost?: number; estimatedCurrency?: string; note?: string
    }
    if (!pick.title) return { ok: false, error: 'Itinera could not find an alternative.' }

    await prisma.booking.update({
      where: { id },
      data: {
        title: pick.title.slice(0, 200),
        status: 'idea',
        location: pick.location || pick.area || null,
        notes: pick.note || null,
        cost: typeof pick.estimatedCost === 'number' ? pick.estimatedCost : null,
        currency: trip.homeCurrency, // per-person estimate in home currency (matches budget)
        metadata: JSON.stringify({ __suggested: true, area: pick.area ?? null, session, prefs }),
      },
    })

    revalidatePath(`/trips/${tripSlug}/itinerary`)
    revalidatePath(`/trips/${tripSlug}`, 'layout')
    return { ok: true }
  } catch (err) {
    console.error('[swapSuggestion] error:', err)
    return { ok: false, error: 'AI request failed. Try again in a moment.' }
  }
}

/**
 * Re-imagine a whole day's suggestions. Anything real on that day (already
 * booked / confirmed) stays fixed and is built around; only the day's AI
 * suggestions are replaced, in the same city, honouring the captured prefs.
 * The old suggestions are deleted only AFTER a successful AI response, so a
 * failed call leaves the existing day intact.
 */
export async function regenerateDay(formData: FormData): Promise<RegenerateDayResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  const dateStr = String(formData.get('date') ?? '')
  if (!tripSlug || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, error: 'Missing trip or date.' }

  const anthropic = getAnthropic()
  if (!anthropic) return { ok: false, error: 'AI not configured.' }

  const { trip } = await requireTripAccess(tripSlug)

  const tripStart = startOfDay(trip.startDate)
  const tripEnd = startOfDay(trip.endDate)
  const day = startOfDay(new Date(`${dateStr}T00:00:00Z`))
  if (day < tripStart || day > tripEnd) return { ok: false, error: 'That date is outside the trip.' }

  const cityRows = await prisma.city.findMany({ where: { tripId: trip.id } })
  const skeleton = mapRowsToSkeleton(cityRows, trip.startDate, trip.endDate)
  const allBookings = await prisma.booking.findMany({ where: { tripId: trip.id }, orderBy: { startAt: 'asc' } })
  const hotels = allBookings.filter((b) => b.type === 'hotel')
  const city = cityForPlanDate(trip, skeleton, hotels, day)

  const onThisDay = allBookings.filter(
    (b) => b.type !== 'hotel' && b.startAt.toISOString().slice(0, 10) === dateStr,
  )
  const daySuggestionIds = new Set(onThisDay.filter((b) => isSuggested(b)).map((b) => b.id))
  const fixed = onThisDay.filter((b) => !isSuggested(b)) // real plans — keep & build around

  // Prefs: a suggestion on this day, else any suggestion on the trip, else defaults.
  const prefsSource = onThisDay.find((b) => isSuggested(b)) ?? allBookings.find((b) => isSuggested(b))
  const prefs = readPrefsFromMeta(prefsSource ? parseMeta(prefsSource.metadata) : {})
  const { budgetText, paceText } = budgetPaceText(trip.homeCurrency, prefs)

  // Avoid everything else on the trip (including other days), EXCEPT this day's
  // own suggestions — those are exactly what we're replacing.
  const avoid = [
    ...new Set(
      allBookings.filter((b) => b.type !== 'hotel' && !daySuggestionIds.has(b.id)).map((b) => b.title),
    ),
  ]
  const fixedText = fixed.length
    ? fixed.map((b) => `  ${format(b.startAt, 'HH:mm')} — ${b.title} (${b.type})`).join('\n')
    : '  (nothing fixed — the whole day is open)'

  const context =
    `Trip: ${trip.name} — ${trip.destination}\n` +
    `Plan ${dateStr}: a day based in ${city}. Aim for ${paceText}.\n` +
    `Estimate the cost PER PERSON in the home currency ${trip.homeCurrency} (their local spending currency is ${trip.localCurrency ?? trip.homeCurrency}).\n` +
    `Interests: ${prefs.interests.length ? prefs.interests.join(', ') : '(open — classics welcome)'}\n` +
    `${budgetText}\n` +
    `Everything must be real, specific, named places in ${city}, grouped so the day flows.\n` +
    `Already fixed this day (build around these, don't clash):\n${fixedText}\n` +
    `Do NOT repeat any of these (already elsewhere on the trip):\n${avoid.length ? avoid.map((t) => `  - ${t}`).join('\n') : '  (none)'}`

  try {
    const response = await anthropic.messages.create({
      model: PARSER_MODEL,
      max_tokens: 2048,
      system:
        `You are a local travel concierge planning ONE day in ${city}. Every place must be real, ` +
        `named, and in ${city}. Cluster places by area so the day flows with little back-and-forth. ` +
        `Honour the interests, budget and pace. Put restaurants at meal sessions (lunch = afternoon, ` +
        `dinner = night). Don't duplicate the fixed items or anything in the avoid list. One short ` +
        `sentence per note.`,
      tools: [{
        name: 'save_day',
        description: 'A fresh set of suggested activities and restaurants for one day.',
        input_schema: {
          type: 'object' as const,
          properties: {
            items: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  session: { type: 'string' as const, enum: ['morning', 'afternoon', 'night'] },
                  type: { type: 'string' as const, enum: ['activity', 'restaurant'] },
                  title: { type: 'string' as const, description: 'specific named place / experience' },
                  area: { type: 'string' as const, description: 'neighbourhood / area used for grouping' },
                  location: { type: 'string' as const, description: 'address or area' },
                  estimatedCost: { type: 'number' as const, description: `per person, in the traveller's HOME currency ${trip.homeCurrency} (so it sums against their budget)` },
                  estimatedCurrency: { type: 'string' as const, description: `ISO 4217 — use ${trip.homeCurrency}` },
                  note: { type: 'string' as const, description: '1 sentence why it fits' },
                },
                required: ['session', 'type', 'title', 'area'],
              },
            },
          },
          required: ['items'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_day' },
      messages: [{ role: 'user', content: context }],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return { ok: false, error: 'Itinera could not reimagine the day.' }
    const rawItems = (toolUse.input as { items?: Array<Omit<PlanItem, 'date'>> }).items ?? []
    const items: PlanItem[] = rawItems.map((it) => ({ ...it, date: dateStr }))

    // Success — now (and only now) clear this day's old suggestions, then write the new set.
    if (daySuggestionIds.size) {
      await prisma.booking.deleteMany({ where: { id: { in: [...daySuggestionIds] } } })
    }
    const count = await createSuggestionRows(trip, items, prefs)

    revalidatePath(`/trips/${tripSlug}/itinerary`)
    revalidatePath(`/trips/${tripSlug}`, 'layout')
    return { ok: true, count }
  } catch (err) {
    console.error('[regenerateDay] error:', err)
    return { ok: false, error: 'AI request failed. Try again in a moment.' }
  }
}

// ----- Trip route / skeleton (the planning backbone) --------------------------------

export type RouteStopDTO = { city: string; country: string; nights: number; note: string | null }
export type RouteResult = { ok: true; stops: RouteStopDTO[] } | { ok: false; error: string }

/** Place desired stops on the calendar and replace the trip's City rows. */
async function writeSkeleton(tripId: string, stops: RouteStop[], start: Date, end: Date) {
  const placed = allocate(stops, start, end)
  await prisma.city.deleteMany({ where: { tripId } })
  if (placed.length > 0) {
    await prisma.city.createMany({
      data: placed.map((s) => ({
        tripId,
        name: s.city,
        country: s.country,
        arriveOn: s.arriveOn,
        leaveOn: s.leaveOn,
        displayOrder: s.order,
      })),
    })
  }
  return placed
}

function toDTO(stops: { city: string; country: string; nights: number; note: string | null }[]): RouteStopDTO[] {
  return stops.map((s) => ({ city: s.city, country: s.country, nights: s.nights, note: s.note }))
}

/** AI-propose a multi-city route (cities + nights) and save it as the skeleton. */
export async function generateTripSkeleton(formData: FormData): Promise<RouteResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  const anthropic = getAnthropic()
  if (!anthropic) return { ok: false, error: 'AI not configured. Add ANTHROPIC_API_KEY.' }
  const { trip } = await requireTripAccess(tripSlug)

  const mustInclude = String(formData.get('mustInclude') ?? '')
    .split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
  const notes = String(formData.get('notes') ?? '').trim()

  const segments = await getTripSegments(trip)
  const countries = [...new Set(segments.map((s) => s.country))]

  const proposed = await generateRoute({
    destination: trip.destination,
    countries,
    totalNights: tripNights(trip.startDate, trip.endDate),
    adultCount: trip.adultCount,
    childCount: trip.childCount,
    childrenAges: trip.childrenAges,
    mustInclude,
    notes,
  })
  if (proposed.length === 0) return { ok: false, error: 'Itinera could not draft a route. Try again.' }

  const placed = await writeSkeleton(trip.id, proposed, trip.startDate, trip.endDate)
  revalidatePath(`/trips/${tripSlug}/itinerary`)
  revalidatePath(`/trips/${tripSlug}/plan`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
  return { ok: true, stops: toDTO(placed) }
}

/** Persist a route the traveller edited by hand (city / nights / order). */
export async function saveTripSkeleton(formData: FormData): Promise<RouteResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  const { trip } = await requireTripAccess(tripSlug)

  let raw: unknown
  try { raw = JSON.parse(String(formData.get('stops') ?? '[]')) } catch { return { ok: false, error: 'Bad route data.' } }
  if (!Array.isArray(raw)) return { ok: false, error: 'Bad route data.' }

  const stops: RouteStop[] = raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>
      return {
        city: String(o.city ?? '').trim(),
        country: String(o.country ?? trip.destination).trim(),
        nights: Math.max(1, Math.round(Number(o.nights) || 1)),
        note: o.note ? String(o.note) : null,
      }
    })
    .filter((s) => s.city)

  if (stops.length === 0) {
    // Clearing the route entirely.
    await prisma.city.deleteMany({ where: { tripId: trip.id } })
    revalidatePath(`/trips/${tripSlug}/itinerary`)
    revalidatePath(`/trips/${tripSlug}`, 'layout')
    return { ok: true, stops: [] }
  }

  const placed = await writeSkeleton(trip.id, stops, trip.startDate, trip.endDate)
  revalidatePath(`/trips/${tripSlug}/itinerary`)
  revalidatePath(`/trips/${tripSlug}/plan`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
  return { ok: true, stops: toDTO(placed) }
}

/** Wipe the trip's route skeleton (City rows). */
export async function clearTripSkeleton(formData: FormData): Promise<void> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return
  const { trip } = await requireTripAccess(tripSlug)
  await prisma.city.deleteMany({ where: { tripId: trip.id } })
  revalidatePath(`/trips/${tripSlug}/itinerary`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}

// ----- Manual booking add -----------------------------------------------------------

export type AddBookingResult = { ok: true } | { ok: false; error: string }

export async function addBookingManually(formData: FormData): Promise<AddBookingResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  const { trip } = await requireTripAccess(tripSlug)

  const title = String(formData.get('title') ?? '').trim()
  const type = String(formData.get('type') ?? 'activity').trim() as
    | 'activity' | 'restaurant' | 'transit' | 'flight' | 'hotel' | 'car' | 'other'
  const dateStr = String(formData.get('date') ?? '')           // YYYY-MM-DD
  const timeStr = String(formData.get('time') ?? '09:00')      // HH:mm
  const endDateStr = String(formData.get('endDate') ?? '')     // optional
  const endTimeStr = String(formData.get('endTime') ?? '')     // optional
  const location = String(formData.get('location') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!title) return { ok: false, error: 'Title is required.' }
  if (!dateStr) return { ok: false, error: 'Date is required.' }

  const startAt = new Date(`${dateStr}T${timeStr || '09:00'}:00Z`)
  if (isNaN(startAt.getTime())) return { ok: false, error: 'Invalid date/time.' }

  let endAt: Date | null = null
  if (endDateStr) {
    endAt = new Date(`${endDateStr}T${endTimeStr || '23:59'}:00Z`)
    if (isNaN(endAt.getTime())) return { ok: false, error: 'Invalid end date/time.' }
    if (endAt < startAt) return { ok: false, error: 'End must be after start.' }
  }

  await prisma.booking.create({
    data: {
      tripId: trip.id,
      type,
      title,
      startAt,
      endAt,
      location,
      notes,
    },
  })

  revalidatePath(`/trips/${tripSlug}/itinerary`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
  return { ok: true }
}

// ----- Quick add: inline plan or loose note -----------------------------------------

export type QuickAddResult = { ok: true } | { ok: false; error: string }

/**
 * The inline per-session "+ Add a plan or note" affordance on the itinerary.
 * A *plan* is a lightweight activity (status 'planned', no cost yet); a *note*
 * is a non-booking jotting (type 'note') that carries no cost and shows no
 * book-it lifecycle. Both are pinned to the chosen session's default hour and
 * nudged a minute later than whatever is already in that session, so repeated
 * adds stack in the order they were typed.
 */
export async function quickAddItem(formData: FormData): Promise<QuickAddResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  const { trip } = await requireTripAccess(tripSlug)

  const title = String(formData.get('title') ?? '').trim()
  const dateStr = String(formData.get('date') ?? '')                 // YYYY-MM-DD
  const sessionRaw = String(formData.get('session') ?? 'morning')
  const session: Session =
    sessionRaw === 'afternoon' || sessionRaw === 'night' ? sessionRaw : 'morning'
  const isNote = String(formData.get('kind') ?? 'plan') === 'note'

  if (!title) return { ok: false, error: 'Type something first.' }
  if (!dateStr) return { ok: false, error: 'Missing date.' }

  // Place it at the end of the session: default hour + a minute per item already
  // bucketed there today (capped at :59 so it can't spill into the next session).
  const dayStart = new Date(`${dateStr}T00:00:00Z`)
  const dayEnd = new Date(`${dateStr}T23:59:59Z`)
  if (isNaN(dayStart.getTime())) return { ok: false, error: 'Invalid date.' }
  const sameDay = await prisma.booking.findMany({
    where: { tripId: trip.id, startAt: { gte: dayStart, lte: dayEnd } },
    select: { startAt: true },
  })
  const alreadyInSession = sameDay.filter(
    (b) => sessionForHour(b.startAt.getUTCHours()) === session,
  ).length
  const hour = SESSION_DEFAULT_HOUR[session]
  const minute = Math.min(alreadyInSession, 59)
  const startAt = new Date(
    `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`,
  )

  await prisma.booking.create({
    data: {
      tripId: trip.id,
      type: isNote ? 'note' : 'activity',
      title,
      startAt,
      status: 'planned',
    },
  })

  revalidatePath(`/trips/${tripSlug}/itinerary`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
  return { ok: true }
}

// ----- Retime: reorder / move an item within its day --------------------------------

export type RetimeResult = { ok: true } | { ok: false; error: string }

/**
 * Reorder/retime a single itinerary item without leaving the day view. Changing
 * the time both reorders within a session (items sort by time) and moves between
 * sessions (a time in another session's range). The calendar day is preserved —
 * only the time-of-day changes — and any end time shifts by the same delta so a
 * multi-hour activity keeps its duration.
 */
export async function retimeBooking(formData: FormData): Promise<RetimeResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  const id = String(formData.get('id') ?? '')
  const time = String(formData.get('time') ?? '').trim()            // HH:mm
  if (!tripSlug || !id) return { ok: false, error: 'Missing fields.' }
  const m = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return { ok: false, error: 'Invalid time.' }

  const { trip } = await requireTripAccess(tripSlug)
  const booking = await prisma.booking.findFirst({ where: { id, tripId: trip.id } })
  if (!booking) return { ok: false, error: 'Item not found.' }

  const hh = Math.min(23, parseInt(m[1], 10))
  const mm = Math.min(59, parseInt(m[2], 10))
  // Times are stored as UTC wall-clock, so set the time-of-day in UTC and keep
  // the same calendar day.
  const newStart = new Date(booking.startAt)
  newStart.setUTCHours(hh, mm, 0, 0)
  let newEnd: Date | null = booking.endAt
  if (booking.endAt) {
    const delta = newStart.getTime() - booking.startAt.getTime()
    newEnd = new Date(booking.endAt.getTime() + delta)
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { startAt: newStart, endAt: newEnd },
  })

  revalidatePath(`/trips/${tripSlug}/itinerary`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
  return { ok: true }
}

// ----- Manual payment + checklist add -----------------------------------------------

export type AddPaymentResult = { ok: true } | { ok: false; error: string }

export async function addPaymentManually(formData: FormData): Promise<AddPaymentResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  const { trip } = await requireTripAccess(tripSlug)

  const description = String(formData.get('description') ?? '').trim()
  const amountRaw = String(formData.get('amount') ?? '').trim()
  const currency = String(formData.get('currency') ?? trip.homeCurrency).trim().toUpperCase() || trip.homeCurrency
  const dueDateStr = String(formData.get('dueDate') ?? '')
  const autoPay = String(formData.get('autoPay') ?? '') === 'on'
  const paymentMethod = String(formData.get('paymentMethod') ?? '').trim() || null
  const paid = String(formData.get('paid') ?? '') === 'on'

  if (!description) return { ok: false, error: 'Description is required.' }
  const amount = parseFloat(amountRaw)
  if (!isFinite(amount) || amount <= 0) return { ok: false, error: 'Amount must be a positive number.' }
  if (!dueDateStr) return { ok: false, error: 'Due date is required.' }
  const dueDate = new Date(dueDateStr + 'T00:00:00Z')
  if (isNaN(dueDate.getTime())) return { ok: false, error: 'Invalid date.' }

  await prisma.payment.create({
    data: {
      tripId: trip.id,
      description, amount, currency, dueDate,
      autoPay, paymentMethod,
      paid, paidAt: paid ? new Date() : null,
    },
  })

  revalidatePath(`/trips/${tripSlug}/costs`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
  return { ok: true }
}

export type AddChecklistResult = { ok: true } | { ok: false; error: string }

export async function addChecklistItem(formData: FormData): Promise<AddChecklistResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  const section = String(formData.get('section') ?? '').trim()  // '3mo' | '1mo' | '1wk' | 'day_of' | 'packing'
  const category = String(formData.get('category') ?? '').trim() || null
  const text = String(formData.get('text') ?? '').trim()

  if (!tripSlug || !section || !text) return { ok: false, error: 'Missing required fields.' }
  const { trip } = await requireTripAccess(tripSlug)

  // Append at end of section/category
  const lastInSection = await prisma.checklistItem.findFirst({
    where: { tripId: trip.id, section, category: category ?? null },
    orderBy: { position: 'desc' },
  })

  await prisma.checklistItem.create({
    data: {
      tripId: trip.id,
      section, category, text,
      position: (lastInSection?.position ?? 0) + 1,
    },
  })

  revalidatePath(`/trips/${tripSlug}/checklist`)
  return { ok: true }
}

// ----- Checklist toggling -----------------------------------------------------------

export async function toggleChecklistItem(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const item = await prisma.checklistItem.findUnique({
    where: { id },
    include: { trip: { select: { slug: true } } },
  })
  if (!item) return
  // Gate on trip membership — without this anyone could toggle any item by id.
  await requireTripAccess(item.trip.slug)
  await prisma.checklistItem.update({
    where: { id },
    data: { done: !item.done, doneAt: !item.done ? new Date() : null },
  })
  revalidatePath(`/trips/[tripSlug]/checklist`, 'page')
}

// ----- Email ingestion --------------------------------------------------------------

export async function ingestPastedEmail(formData: FormData) {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  // Gate on trip membership — this creates emails/bookings, so it must not be
  // callable for a trip the user can't access. Redirects away if unauthorized.
  const { trip } = await requireTripAccess(tripSlug)

  const from = String(formData.get('from') ?? 'unknown@unknown')
  const subject = String(formData.get('subject') ?? '(no subject)')
  const text = String(formData.get('body') ?? '')

  // Lift uploaded files off the FormData and convert each to base64 so they
  // can ride through the parser → Claude pipeline alongside the email body.
  const rawAttachments = formData.getAll('attachments').filter((v): v is File => v instanceof File && v.size > 0)
  const attachments = await Promise.all(
    rawAttachments.map(async (f) => ({
      filename: f.name,
      mimeType: f.type || 'application/octet-stream',
      contentBase64: Buffer.from(await f.arrayBuffer()).toString('base64'),
    }))
  )

  if (!text.trim() && attachments.length === 0) {
    return { error: 'Add an email body or at least one attachment for the parser to read.' }
  }

  const incoming = await prisma.incomingEmail.create({
    data: {
      tripId: trip.id,
      fromAddress: from,
      toAddress: `inbox+${trip.inboxToken}@${process.env.NEXT_PUBLIC_INBOX_DOMAIN ?? 'voyage.local'}`,
      subject,
      textBody: text,
    },
  })

  if (attachments.length > 0) {
    const rows = await Promise.all(attachments.map(async (a) => ({
      emailId: incoming.id,
      filename: a.filename,
      mimeType: a.mimeType,
      storagePath: (await uploadAttachment({
        tripSlug: trip.slug,
        filename: a.filename,
        bytes: Buffer.from(a.contentBase64, 'base64'),
        mimeType: a.mimeType,
      })) ?? '',
      size: Math.floor(a.contentBase64.length * 0.75),
    })))
    await prisma.emailAttachment.createMany({ data: rows })
  }

  let parsed: ParserResult
  try {
    parsed = await parseEmail({ from, to: incoming.toAddress, subject, text, attachments })
  } catch (err) {
    await prisma.incomingEmail.update({
      where: { id: incoming.id },
      data: { errorMsg: String(err), processed: true },
    })
    return { error: 'Parser failed: ' + String(err) }
  }

  // Persist with duplicate detection (updates existing if matched)
  const ingestSummary = await persistParserResult(trip, parsed, incoming.id)

  await prisma.incomingEmail.update({
    where: { id: incoming.id },
    data: {
      processed: true,
      parsedSummary: parsed.summary,
      parsedJson: JSON.stringify(parsed),
    },
  })

  revalidatePath(`/trips/${tripSlug}`, 'layout')

  return {
    success: true,
    parserMode: parsed.mode,
    summary: parsed.summary,
    counts: {
      bookings: parsed.bookings.length,
      documents: parsed.documents.length,
      payments: parsed.payments.length,
    },
    ingest: ingestSummary,
  }
}

/**
 * Re-parse an existing email with one or more extra attachments uploaded from
 * the email detail page. The parser runs again over the stored body + the
 * uploaded files, and the dedupe in persistParserResult updates the existing
 * booking instead of creating a fresh one. Use case: the original forward
 * stripped the e-ticket PDF, so the booking lost everything not on the body.
 */
type ReparseResult = {
  success: boolean
  error?: string
  parserMode?: string
  summary?: string
  counts?: { bookings: number; documents: number; payments: number }
}

export async function reparseEmailWithFiles(formData: FormData): Promise<ReparseResult> {
  const emailId = String(formData.get('emailId') ?? '')
  if (!emailId) return { success: false, error: 'Missing email id.' }

  const email = await prisma.incomingEmail.findUnique({
    where: { id: emailId },
    include: { trip: true },
  })
  if (!email || !email.trip) return { success: false, error: 'Email or trip not found.' }

  // Auth — must have access to the trip this email belongs to before we upload
  // attachments, run the parser, or mutate any bookings/documents. Without this
  // a signed-out caller could target any email id and inject files / overwrite
  // another trip's data (IDOR).
  await requireTripAccess(email.trip.slug)

  const rawAttachments = formData.getAll('attachments').filter((v): v is File => v instanceof File && v.size > 0)
  if (rawAttachments.length === 0) {
    return { success: false, error: 'Add at least one file (PDF, image, .ics) before re-parsing.' }
  }
  const attachments = await Promise.all(
    rawAttachments.map(async (f) => ({
      filename: f.name,
      mimeType: f.type || 'application/octet-stream',
      contentBase64: Buffer.from(await f.arrayBuffer()).toString('base64'),
    }))
  )

  // Record the freshly uploaded attachments alongside whatever was already
  // attached, persisting the bytes to Blob so they're openable later.
  const attachmentRows = await Promise.all(attachments.map(async (a) => ({
    emailId: email.id,
    filename: a.filename,
    mimeType: a.mimeType,
    storagePath: (await uploadAttachment({
      tripSlug: email.trip!.slug,
      filename: a.filename,
      bytes: Buffer.from(a.contentBase64, 'base64'),
      mimeType: a.mimeType,
    })) ?? '',
    size: Math.floor(a.contentBase64.length * 0.75),
  })))
  await prisma.emailAttachment.createMany({ data: attachmentRows })

  let parsed: ParserResult
  try {
    parsed = await parseEmail({
      from: email.fromAddress,
      to: email.toAddress,
      subject: email.subject,
      text: email.textBody ?? '',
      html: email.htmlBody ?? undefined,
      attachments,
    })
  } catch (err) {
    await prisma.incomingEmail.update({
      where: { id: email.id },
      data: { errorMsg: String(err), processed: true },
    })
    return { success: false, error: 'Parser failed: ' + String(err) }
  }

  await persistParserResult(email.trip, parsed, email.id)

  await prisma.incomingEmail.update({
    where: { id: email.id },
    data: {
      processed: true,
      parsedSummary: parsed.summary,
      parsedJson: JSON.stringify(parsed),
      errorMsg: null,
    },
  })

  revalidatePath(`/trips/${email.trip.slug}`, 'layout')
  revalidatePath(`/trips/${email.trip.slug}/inbox/${email.id}`)

  return {
    success: true,
    parserMode: parsed.mode,
    summary: parsed.summary,
    counts: {
      bookings: parsed.bookings.length,
      documents: parsed.documents.length,
      payments: parsed.payments.length,
    },
  }
}

export async function deleteIncomingEmail(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!id) return

  const email = await prisma.incomingEmail.findUnique({
    where: { id },
    include: { trip: true },
  })
  if (!email) return
  // Auth check — must have access to the trip the email belongs to
  if (email.trip) await requireTripAccess(email.trip.slug)
  else await requireUser()  // unrouted emails — any signed-in user can clean up

  // Cascade: also remove any Booking and Document that were created from this email.
  // (Payments don't carry sourceEmailId yet, so they survive — they're more
  // calendar-style entries that often duplicate across confirmation + receipt.)
  // If the user manually edited a booking and wants to keep it after deleting the
  // source email, they should delete the email FIRST, then re-add the booking
  // manually — or simply edit the booking to detach it before deleting the email.
  await prisma.booking.deleteMany({ where: { sourceEmailId: id } })
  await prisma.document.deleteMany({ where: { sourceEmailId: id } })
  await prisma.incomingEmail.delete({ where: { id } })

  if (tripSlug) {
    revalidatePath(`/trips/${tripSlug}/inbox`)
    revalidatePath(`/trips/${tripSlug}`, 'layout')
  } else if (email.trip) {
    revalidatePath(`/trips/${email.trip.slug}/inbox`)
    revalidatePath(`/trips/${email.trip.slug}`, 'layout')
  }
}

/**
 * Bulk reset: wipe every IncomingEmail + their cascaded Booking/Document for
 * this trip. Manually-added bookings (without a sourceEmailId) survive.
 * Payments are left as-is since they're not directly linked to emails.
 */
export type ClearAllEmailsResult =
  | { ok: true; deletedEmails: number; deletedBookings: number; deletedDocuments: number }
  | { ok: false; error: string }

export async function clearAllEmails(formData: FormData): Promise<ClearAllEmailsResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  const { trip } = await requireTripAccess(tripSlug)

  // Delete all bookings + documents that came from any email on this trip
  const emails = await prisma.incomingEmail.findMany({
    where: { tripId: trip.id },
    select: { id: true },
  })
  const emailIds = emails.map((e) => e.id)
  if (emailIds.length === 0) return { ok: true, deletedEmails: 0, deletedBookings: 0, deletedDocuments: 0 }

  const deletedBookings = await prisma.booking.deleteMany({ where: { sourceEmailId: { in: emailIds } } })
  const deletedDocuments = await prisma.document.deleteMany({ where: { sourceEmailId: { in: emailIds } } })
  const deletedEmails = await prisma.incomingEmail.deleteMany({ where: { tripId: trip.id } })

  revalidatePath(`/trips/${tripSlug}/inbox`)
  revalidatePath(`/trips/${tripSlug}`, 'layout')
  return {
    ok: true,
    deletedEmails: deletedEmails.count,
    deletedBookings: deletedBookings.count,
    deletedDocuments: deletedDocuments.count,
  }
}

// ----- Trip editing -----------------------------------------------------------------

export type EditTripResult = { ok: true; slug: string } | { ok: false; error: string }

export async function editTrip(formData: FormData): Promise<EditTripResult> {
  const user = await requireUser()
  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, error: 'Missing trip id' }
  const existing = await prisma.trip.findUnique({
    where: { id },
    include: { memberships: { where: { userId: user.id } } },
  })
  if (!existing) return { ok: false, error: 'Trip not found' }
  if (existing.memberships.length === 0) return { ok: false, error: 'You do not have access to this trip.' }

  const name = String(formData.get('name') ?? '').trim()
  const tagline = String(formData.get('tagline') ?? '').trim() || null
  const destination = String(formData.get('destination') ?? '').trim()
  const startDateStr = String(formData.get('startDate') ?? '')
  const endDateStr = String(formData.get('endDate') ?? '')
  const homeCurrency = String(formData.get('homeCurrency') ?? 'AUD').trim().toUpperCase() || 'AUD'
  const travelerNames = String(formData.get('travelerNames') ?? '').trim() || null
  const departureCity = String(formData.get('departureCity') ?? '').trim() || null
  const themeOverride = String(formData.get('themeKey') ?? '').trim()
  const adultCount = Math.max(0, parseInt(String(formData.get('adultCount') ?? '1'), 10) || 1)
  const childCount = Math.max(0, parseInt(String(formData.get('childCount') ?? '0'), 10) || 0)
  const childrenAges = String(formData.get('childrenAges') ?? '').trim() || null
  const colorPalette = (String(formData.get('colorPalette') ?? 'pastel').trim() || 'pastel') as 'pastel' | 'jewel' | 'mono'

  if (!name) return { ok: false, error: 'Trip name is required.' }
  if (!destination) return { ok: false, error: 'Destination is required.' }
  if (!startDateStr || !endDateStr) return { ok: false, error: 'Dates required.' }
  const startDate = new Date(startDateStr + 'T00:00:00Z')
  const endDate = new Date(endDateStr + 'T00:00:00Z')
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return { ok: false, error: 'Invalid dates.' }
  if (endDate < startDate) return { ok: false, error: 'End date must be after start date.' }

  const themeKey: ThemeKey = (themeOverride as ThemeKey) || deriveThemeFromDestination(destination)
  // Recompute timezone + localCurrency if destination changed
  const profile = profileForDestination(destination)

  // If name changed materially, regenerate slug
  let slug = existing.slug
  if (name !== existing.name) {
    const baseSlug = slugify(name)
    if (baseSlug !== existing.slug) slug = await uniqueSlug(baseSlug)
  }

  await prisma.trip.update({
    where: { id },
    data: {
      name, tagline, destination, themeKey, startDate, endDate, homeCurrency,
      travelerNames, departureCity, slug,
      timezone: profile.timezone,
      localCurrency: profile.currency,
      adultCount, childCount, childrenAges,
      colorPalette,
    },
  })

  revalidatePath('/trips')
  revalidatePath(`/trips/${slug}`, 'layout')
  return { ok: true, slug }
}

// ----- Booking edit -----------------------------------------------------------------

export type EditBookingResult = { ok: true; tripSlug: string } | { ok: false; error: string }

export async function editBooking(formData: FormData): Promise<EditBookingResult> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, error: 'Missing booking id.' }

  const existing = await prisma.booking.findUnique({
    where: { id },
    include: { trip: true },
  })
  if (!existing) return { ok: false, error: 'Booking not found.' }
  await requireTripAccess(existing.trip.slug)

  const type = String(formData.get('type') ?? existing.type).trim()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { ok: false, error: 'Title is required.' }

  const vendor = String(formData.get('vendor') ?? '').trim() || null
  const dateStr = String(formData.get('date') ?? '')
  const timeStr = String(formData.get('time') ?? '09:00')
  const endDateStr = String(formData.get('endDate') ?? '')
  const endTimeStr = String(formData.get('endTime') ?? '')
  const location = String(formData.get('location') ?? '').trim() || null
  const address = String(formData.get('address') ?? '').trim() || null
  const confirmationCode = String(formData.get('confirmationCode') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null
  const costStr = String(formData.get('cost') ?? '').trim()
  const cost = costStr ? parseFloat(costStr) : null
  const currency = String(formData.get('currency') ?? existing.currency ?? '').trim().toUpperCase() || null
  const paid = String(formData.get('paid') ?? '') === 'on'
  const paymentMethod = String(formData.get('paymentMethod') ?? '').trim() || null
  const cancelDateStr = String(formData.get('cancelDate') ?? '')
  const cancelTimeStr = String(formData.get('cancelTime') ?? '23:59')
  const cancellationPolicy = String(formData.get('cancellationPolicy') ?? '').trim() || null

  // Hotel-specific metadata fields
  const checkIn = String(formData.get('checkIn') ?? '').trim()
  const checkOut = String(formData.get('checkOut') ?? '').trim()
  const breakfast = String(formData.get('breakfast') ?? '').trim()

  if (!dateStr) return { ok: false, error: 'Date is required.' }
  const startAt = new Date(`${dateStr}T${timeStr || '09:00'}:00Z`)
  if (isNaN(startAt.getTime())) return { ok: false, error: 'Invalid date/time.' }
  let endAt: Date | null = null
  if (endDateStr) {
    endAt = new Date(`${endDateStr}T${endTimeStr || '23:59'}:00Z`)
    if (isNaN(endAt.getTime())) return { ok: false, error: 'Invalid end date/time.' }
    if (endAt < startAt) return { ok: false, error: 'End must be after start.' }
  }
  let cancelByAt: Date | null = null
  if (cancelDateStr) {
    cancelByAt = new Date(`${cancelDateStr}T${cancelTimeStr || '23:59'}:00Z`)
    if (isNaN(cancelByAt.getTime())) return { ok: false, error: 'Invalid cancellation date.' }
  }

  // Merge metadata (keep prior keys; overwrite with new values when set)
  const existingMeta = (() => {
    try { return existing.metadata ? JSON.parse(existing.metadata) : {} } catch { return {} }
  })() as Record<string, unknown>
  const newMeta: Record<string, unknown> = { ...existingMeta }
  if (type === 'hotel') {
    if (checkIn) newMeta.checkIn = checkIn
    if (checkOut) newMeta.checkOut = checkOut
    if (breakfast) newMeta.breakfast = breakfast
  }

  await prisma.booking.update({
    where: { id },
    data: {
      type, title, vendor,
      startAt, endAt,
      location, address, confirmationCode, notes,
      cost, currency,
      paid, paidAt: paid ? (existing.paidAt ?? new Date()) : null,
      paymentMethod,
      cancelByAt, cancellationPolicy,
      metadata: Object.keys(newMeta).length > 0 ? JSON.stringify(newMeta) : null,
    },
  })

  revalidatePath(`/trips/${existing.trip.slug}`, 'layout')
  return { ok: true, tripSlug: existing.trip.slug }
}

// ----- Atlas: manually-added visited countries --------------------------------------

/**
 * Add a "I've been there" record for the Atlas. Upserts on (userId, isoNumeric)
 * so resubmitting with new fields updates an existing record rather than failing.
 */
export async function addVisitedCountry(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await requireUser()
  const isoNumeric = String(formData.get('isoNumeric') ?? '').trim()
  if (!isoNumeric) return { ok: false, error: 'Pick a country.' }

  const daysRaw = String(formData.get('daysApprox') ?? '').trim()
  const yearRaw = String(formData.get('yearVisited') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim() || null

  const daysApprox = daysRaw ? Math.max(1, parseInt(daysRaw, 10)) : null
  const yearVisited = yearRaw ? Math.max(1900, Math.min(2100, parseInt(yearRaw, 10))) : null

  if (daysRaw && Number.isNaN(daysApprox!)) return { ok: false, error: 'Days must be a number.' }
  if (yearRaw && Number.isNaN(yearVisited!)) return { ok: false, error: 'Year must be a number.' }

  await prisma.visitedCountry.upsert({
    where: { userId_isoNumeric: { userId: user.id, isoNumeric } },
    create: { userId: user.id, isoNumeric, daysApprox, yearVisited, note },
    update: { daysApprox, yearVisited, note },
  })

  revalidatePath('/atlas')
  return { ok: true }
}

export async function deleteVisitedCountry(formData: FormData) {
  const user = await requireUser()
  const isoNumeric = String(formData.get('isoNumeric') ?? '').trim()
  if (!isoNumeric) return

  await prisma.visitedCountry.deleteMany({
    where: { userId: user.id, isoNumeric },
  })

  revalidatePath('/atlas')
}

/**
 * Set (or clear) the user's country of residence. Submitting an empty
 * isoNumeric clears the field — useful for the "Not set" option in the
 * picker. The home country paints burgundy on the Atlas map and is split
 * out of the travel-destinations list + stats in loadAtlasForUser.
 */
export async function setHomeCountry(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await requireUser()
  const isoNumeric = String(formData.get('isoNumeric') ?? '').trim()

  await prisma.user.update({
    where: { id: user.id },
    data: { homeCountryIso: isoNumeric || null },
  })

  revalidatePath('/profile')
  revalidatePath('/atlas')
  revalidatePath('/atlas/map')
  return { ok: true }
}

/**
 * Set (or clear) the user's passport / nationality. Submitting an empty
 * isoNumeric clears it, falling back to the home country for visa rules.
 * Drives per-destination visa & entry requirements.
 */
export async function setPassport(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await requireUser()
  const isoNumeric = String(formData.get('isoNumeric') ?? '').trim()

  await prisma.user.update({
    where: { id: user.id },
    data: { nationalityIso: isoNumeric || null },
  })

  revalidatePath('/profile')
  return { ok: true }
}

// ----- Trip segments (multi-country legs) -------------------------------------------

export type AddSegmentResult = { ok: true } | { ok: false; error: string }

export async function addTripSegment(formData: FormData): Promise<AddSegmentResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '').trim()
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  const { trip } = await requireTripAccess(tripSlug)

  const isoNumeric = String(formData.get('isoNumeric') ?? '').trim()
  if (!isoNumeric) return { ok: false, error: 'Pick a country.' }
  const startStr = String(formData.get('startDate') ?? '')
  const endStr = String(formData.get('endDate') ?? '')
  if (!startStr || !endStr) return { ok: false, error: 'Add start and end dates.' }
  const startDate = new Date(startStr + 'T00:00:00Z')
  const endDate = new Date(endStr + 'T00:00:00Z')
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return { ok: false, error: 'Invalid dates.' }
  if (endDate < startDate) return { ok: false, error: 'End must be after start.' }

  const profile = profileForIsoNumeric(isoNumeric)
  const country = profile?.label ?? isoNumeric

  const count = await prisma.tripSegment.count({ where: { tripId: trip.id } })
  await prisma.tripSegment.create({
    data: { tripId: trip.id, country, isoNumeric, startDate, endDate, displayOrder: count },
  })

  revalidatePath(`/trips/${tripSlug}`, 'layout')
  return { ok: true }
}

export async function deleteTripSegment(formData: FormData) {
  const tripSlug = String(formData.get('tripSlug') ?? '').trim()
  const id = String(formData.get('id') ?? '').trim()
  if (!tripSlug || !id) return
  await requireTripAccess(tripSlug)
  await prisma.tripSegment.deleteMany({ where: { id, trip: { slug: tripSlug } } })
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}

// ----- Deletes ----------------------------------------------------------------------

export async function deleteTrip(formData: FormData) {
  const user = await requireUser()
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const membership = await prisma.membership.findFirst({ where: { tripId: id, userId: user.id } })
  if (!membership || membership.role !== 'owner') return  // only owners can delete
  await prisma.trip.delete({ where: { id } })
  revalidatePath('/trips')
  redirect('/trips')
}

export async function deleteBooking(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!id || !tripSlug) return
  await requireTripAccess(tripSlug)
  // Scope by trip too: access is checked on the submitted slug, so the delete
  // must be constrained to that trip or a member could delete another trip's
  // booking by id. deleteMany no-ops instead of throwing on a mismatch.
  await prisma.booking.deleteMany({ where: { id, trip: { slug: tripSlug } } })
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}

export async function deleteDocument(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!id || !tripSlug) return
  await requireTripAccess(tripSlug)
  await prisma.document.deleteMany({ where: { id, trip: { slug: tripSlug } } })
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}

export async function deletePayment(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!id || !tripSlug) return
  await requireTripAccess(tripSlug)
  await prisma.payment.deleteMany({ where: { id, trip: { slug: tripSlug } } })
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}

// ----- Sharing / invitations --------------------------------------------------------

export type InviteResult = { ok: true; emailSent: boolean } | { ok: false; error: string }

export async function inviteToTrip(formData: FormData): Promise<InviteResult> {
  const user = await requireUser()
  const tripSlug = String(formData.get('tripSlug') ?? '').trim()
  const inviteeEmail = String(formData.get('email') ?? '').trim().toLowerCase()

  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  if (!inviteeEmail || !inviteeEmail.includes('@')) return { ok: false, error: 'Enter a valid email address.' }

  const { trip, role } = await requireTripAccess(tripSlug)
  if (role !== 'owner') return { ok: false, error: 'Only the trip owner can invite people.' }

  // If invitee already has an account, just add them as a member directly
  const existingUser = await prisma.user.findUnique({ where: { email: inviteeEmail } })
  if (existingUser) {
    const already = await prisma.membership.findUnique({
      where: { tripId_userId: { tripId: trip.id, userId: existingUser.id } },
    })
    if (already) return { ok: false, error: 'That person is already on this trip.' }
    await prisma.membership.create({
      data: { tripId: trip.id, userId: existingUser.id, role: 'editor' },
    })
    revalidatePath(`/trips/${tripSlug}`, 'layout')
    return { ok: true, emailSent: false }
  }

  // Otherwise create an invitation token + email it
  const token = randomBytes(16).toString('base64url')
  await prisma.invitation.create({
    data: { tripId: trip.id, email: inviteeEmail, invitedBy: user.id, role: 'editor', token },
  })

  // Try to email it via Resend if configured
  let emailSent = false
  if (process.env.AUTH_RESEND_KEY) {
    try {
      const resend = new Resend(process.env.AUTH_RESEND_KEY)
      const appUrl = process.env.AUTH_URL ?? 'http://localhost:3000'
      const inviteUrl = `${appUrl}/invite/${token}`
      await resend.emails.send({
        from: process.env.AUTH_RESEND_FROM ?? 'Voyage <onboarding@resend.dev>',
        to: inviteeEmail,
        subject: `${user.name ?? user.email} invited you to "${trip.name}" on Voyage`,
        text: `${user.name ?? user.email} is sharing their Voyage trip "${trip.name}" with you.\n\nClick to accept: ${inviteUrl}\n\nThis invite expires in 14 days.`,
      })
      emailSent = true
    } catch (err) {
      console.error('[invite] Resend send failed:', err)
    }
  }

  revalidatePath(`/trips/${tripSlug}`, 'layout')
  return { ok: true, emailSent }
}

export async function acceptInvitation(token: string): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const user = await requireUser()
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { trip: true },
  })
  if (!invitation) return { ok: false, error: 'Invitation not found or already used.' }
  if (invitation.acceptedAt) return { ok: false, error: 'This invitation has already been used.' }
  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return { ok: false, error: `This invitation was sent to ${invitation.email}. You're signed in as ${user.email}.` }
  }

  // Add membership + mark invitation accepted
  await prisma.$transaction([
    prisma.membership.upsert({
      where: { tripId_userId: { tripId: invitation.tripId, userId: user.id } },
      create: { tripId: invitation.tripId, userId: user.id, role: invitation.role },
      update: {},
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ])

  revalidatePath('/trips')
  return { ok: true, slug: invitation.trip.slug }
}

export async function removeMember(formData: FormData) {
  const user = await requireUser()
  const tripSlug = String(formData.get('tripSlug') ?? '')
  const membershipId = String(formData.get('membershipId') ?? '')
  if (!tripSlug || !membershipId) return

  const { role } = await requireTripAccess(tripSlug)
  if (role !== 'owner') return

  const target = await prisma.membership.findUnique({ where: { id: membershipId } })
  if (!target) return
  if (target.role === 'owner') return  // can't remove the owner

  await prisma.membership.delete({ where: { id: membershipId } })
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}
