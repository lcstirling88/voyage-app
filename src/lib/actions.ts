'use server'

import { randomBytes } from 'crypto'
import { format } from 'date-fns'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { prisma } from './db'
import { parseEmail, type ParserResult } from './email-parser'
import { persistParserResult } from './ingest'
import { deriveThemeFromDestination, type ThemeKey } from './theme'
import { requireUser, requireTripAccess } from './session'
import { getAnthropic, PARSER_MODEL } from './anthropic'
import { profileForDestination } from './destinations'

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
        memberships: {
          create: { userId: user.id, role: 'owner' },
        },
      },
    })

    if (cityNames.length > 0) {
      await tx.city.createMany({
        data: cityNames.map((cityName, i) => ({
          tripId: trip.id,
          name: cityName,
          country: destination,
          arriveOn: startDate,
          leaveOn: endDate,
          displayOrder: i + 1,
        })),
      })
    }

    await tx.checklistItem.createMany({
      data: STARTER_CHECKLIST.map((c) => ({ tripId: trip.id, ...c })),
    })
  })

  revalidatePath('/trips')
  redirect(`/trips/${slug}/inbox`)
}

// ----- AI Local Info generation -----------------------------------------------------

export type GenerateLocalInfoResult = { ok: true } | { ok: false; error: string }

export async function generateLocalInfo(formData: FormData): Promise<GenerateLocalInfoResult> {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!tripSlug) return { ok: false, error: 'Missing trip.' }
  const anthropic = getAnthropic()
  if (!anthropic) return { ok: false, error: 'AI not configured. Add ANTHROPIC_API_KEY.' }

  const { trip } = await requireTripAccess(tripSlug)

  try {
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
          `Generate local info for a traveler going to: ${trip.destination}\n` +
          `Home country (for currency / embassy references): ${trip.homeCurrency} (Australia by default)\n` +
          `Trip dates: ${trip.startDate.toISOString().slice(0,10)} to ${trip.endDate.toISOString().slice(0,10)}\n` +
          `Travellers: ${trip.adultCount} adult(s), ${trip.childCount} child(ren)${trip.childrenAges ? ` aged ${trip.childrenAges}` : ''}\n` +
          `Please tailor where relevant (e.g. family-friendly notes if children, embassy of home country, etc.).`,
      }],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return { ok: false, error: 'AI did not return local info.' }
    }
    const input = toolUse.input as Record<string, unknown>

    const localInfo = {
      generatedAt: new Date().toISOString(),
      destination: trip.destination,
      ...input,
    }

    await prisma.trip.update({
      where: { id: trip.id },
      data: { localInfoJson: JSON.stringify(localInfo) },
    })

    revalidatePath(`/trips/${tripSlug}/local`)
    return { ok: true }
  } catch (err) {
    console.error('[generateLocalInfo]', err)
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
                  estimatedCost: { type: 'number' as const, description: 'Per person, in local currency' },
                  estimatedCurrency: { type: 'string' as const, description: 'ISO 4217 e.g. NZD, AUD' },
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
  const item = await prisma.checklistItem.findUnique({ where: { id } })
  if (!item) return
  await prisma.checklistItem.update({
    where: { id },
    data: { done: !item.done, doneAt: !item.done ? new Date() : null },
  })
  revalidatePath(`/trips/[tripSlug]/checklist`, 'page')
}

// ----- Email ingestion --------------------------------------------------------------

export async function ingestPastedEmail(formData: FormData) {
  const tripSlug = String(formData.get('tripSlug') ?? '')
  const trip = await prisma.trip.findUnique({ where: { slug: tripSlug } })
  if (!trip) return { error: 'Trip not found' }

  const from = String(formData.get('from') ?? 'unknown@unknown')
  const subject = String(formData.get('subject') ?? '(no subject)')
  const text = String(formData.get('body') ?? '')
  if (!text.trim()) return { error: 'Email body is empty' }

  const incoming = await prisma.incomingEmail.create({
    data: {
      tripId: trip.id,
      fromAddress: from,
      toAddress: `inbox+${trip.inboxToken}@${process.env.NEXT_PUBLIC_INBOX_DOMAIN ?? 'voyage.local'}`,
      subject,
      textBody: text,
    },
  })

  let parsed: ParserResult
  try {
    parsed = await parseEmail({ from, to: incoming.toAddress, subject, text })
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

export async function deleteIncomingEmail(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const email = await prisma.incomingEmail.findUnique({ where: { id } })
  if (!email) return
  await prisma.booking.updateMany({ where: { sourceEmailId: id }, data: { sourceEmailId: null } })
  await prisma.document.updateMany({ where: { sourceEmailId: id }, data: { sourceEmailId: null } })
  await prisma.incomingEmail.delete({ where: { id } })
  if (email.tripId) revalidatePath(`/trips/[tripSlug]/inbox`, 'page')
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
  await prisma.booking.delete({ where: { id } })
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}

export async function deleteDocument(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!id || !tripSlug) return
  await requireTripAccess(tripSlug)
  await prisma.document.delete({ where: { id } })
  revalidatePath(`/trips/${tripSlug}`, 'layout')
}

export async function deletePayment(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const tripSlug = String(formData.get('tripSlug') ?? '')
  if (!id || !tripSlug) return
  await requireTripAccess(tripSlug)
  await prisma.payment.delete({ where: { id } })
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
