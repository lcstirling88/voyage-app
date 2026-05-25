/**
 * Email parser — turns a raw booking email into structured bookings, documents, and payments.
 *
 * Two modes:
 *   1. Real:  uses Claude with forced tool-use to extract structured data.
 *   2. Mock:  pattern-matches a small set of common booking shapes (hotel/flight/restaurant) so
 *             the UI can be developed end-to-end without an API key. Falls back to a generic
 *             single-booking parse if nothing matches.
 */

import { getAnthropic, PARSER_MODEL } from './anthropic'

export type ParsedBooking = {
  type: 'hotel' | 'flight' | 'activity' | 'restaurant' | 'transit' | 'car' | 'other'
  title: string
  vendor?: string
  startAt: string  // ISO
  endAt?: string   // ISO
  location?: string         // for cars: pickup location
  address?: string
  confirmationCode?: string
  notes?: string
  cost?: number
  currency?: string
  paid?: boolean
  metadata?: Record<string, string | number | boolean>  // for cars: dropoffLocation, vehicle, etc.
}

export type ParsedDocument = {
  category: 'passport' | 'visa' | 'insurance' | 'ticket' | 'voucher' | 'other'
  title: string
  notes?: string
}

export type ParsedPayment = {
  description: string
  amount: number
  currency: string
  dueDate: string  // ISO
  autoPay?: boolean
  paymentMethod?: string
}

export type ParserResult = {
  summary: string
  bookings: ParsedBooking[]
  documents: ParsedDocument[]
  payments: ParsedPayment[]
  mode: 'claude' | 'mock'
}

const TOOL = {
  name: 'save_parsed_email',
  description:
    "Save the structured bookings, documents and payments extracted from a travel email. Call this exactly once. Use ISO 8601 (YYYY-MM-DDTHH:mm:ss±HH:mm) for all datetimes. If a field is unknown, omit it — don't guess.",
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string' as const,
        description: 'One-sentence summary of what this email contains.',
      },
      bookings: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            type: { type: 'string' as const, enum: ['hotel', 'flight', 'activity', 'restaurant', 'transit', 'car', 'other'] },
            title: { type: 'string' as const, description: 'Short human-readable title' },
            vendor: { type: 'string' as const },
            startAt: { type: 'string' as const, description: 'ISO 8601 datetime — for hotels, check-in time' },
            endAt: { type: 'string' as const, description: 'ISO 8601 datetime — for hotels, check-out time' },
            location: { type: 'string' as const, description: 'City or area' },
            address: { type: 'string' as const },
            confirmationCode: { type: 'string' as const },
            notes: { type: 'string' as const },
            cost: { type: 'number' as const },
            currency: { type: 'string' as const, description: 'ISO 4217 code, e.g. JPY, AUD' },
            paid: { type: 'boolean' as const, description: 'true if already paid; false if pending' },
            metadata: {
              type: 'object' as const,
              description: 'Type-specific extras: checkIn/checkOut/breakfast/nights for hotels; seats/class/baggage for flights; etc.',
              additionalProperties: true,
            },
          },
          required: ['type', 'title', 'startAt'],
        },
      },
      documents: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            category: { type: 'string' as const, enum: ['passport', 'visa', 'insurance', 'ticket', 'voucher', 'other'] },
            title: { type: 'string' as const },
            notes: { type: 'string' as const },
          },
          required: ['category', 'title'],
        },
      },
      payments: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            description: { type: 'string' as const },
            amount: { type: 'number' as const },
            currency: { type: 'string' as const },
            dueDate: { type: 'string' as const, description: 'ISO date — for upcoming auto-charges' },
            autoPay: { type: 'boolean' as const },
            paymentMethod: { type: 'string' as const },
          },
          required: ['description', 'amount', 'currency', 'dueDate'],
        },
      },
    },
    required: ['summary', 'bookings', 'documents', 'payments'],
  },
}

export interface EmailInput {
  from: string
  to: string
  subject: string
  text: string
  html?: string
}

export async function parseEmail(email: EmailInput): Promise<ParserResult> {
  const anthropic = getAnthropic()
  if (anthropic) {
    try {
      return await parseWithClaude(email)
    } catch (err) {
      console.error('[email-parser] Claude failed, falling back to mock:', err)
      return parseWithMock(email)
    }
  }
  return parseWithMock(email)
}

async function parseWithClaude(email: EmailInput): Promise<ParserResult> {
  const anthropic = getAnthropic()!

  const systemPrompt = `You extract structured travel bookings from emails. You will be given a single email (subject, from, body). Call the \`save_parsed_email\` tool exactly once with everything you can extract.

Guidelines:
- One email can contain multiple bookings (e.g. a flight itinerary with outbound + return, or a hotel + airport transfer).
- Hotel emails: type "hotel", startAt = check-in datetime, endAt = check-out datetime, put breakfast/checkIn/checkOut/nights in metadata.
- Flight emails: type "flight", startAt = departure, endAt = arrival, put seats/class/baggage in metadata.
- Restaurant emails: type "restaurant", startAt = reservation time.
- Tour/activity emails: type "activity". If the activity spans multiple days (e.g. "4-day ski lessons", "3-day cooking course"), set endAt to the last day so it shows on each day of its span.
- Car rental emails: type "car", startAt = pickup datetime, endAt = return datetime, location = pickup location, put dropoffLocation/vehicle/insurance in metadata.
- If the email is a visa approval, insurance policy, or similar non-booking document, return it under documents instead of bookings.
- If the email mentions a future automatic charge (e.g. final balance auto-billed on a date), include it under payments.
- If you can't extract anything useful, return empty arrays but still write a summary.
- Be conservative — only include fields you're confident about. Don't fabricate confirmation codes or addresses.`

  const userContent = `Subject: ${email.subject}
From: ${email.from}
To: ${email.to}

--- BODY ---
${email.text || (email.html ? email.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '')}`

  const response = await anthropic.messages.create({
    model: PARSER_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL.name },
    messages: [{ role: 'user', content: userContent }],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not call the expected tool')
  }
  const input = toolUse.input as Omit<ParserResult, 'mode'>
  return { ...input, mode: 'claude' }
}

// ----- Mock parser ------------------------------------------------------------------

function parseWithMock(email: EmailInput): ParserResult {
  const subject = email.subject.toLowerCase()
  const body = email.text.toLowerCase()

  // Car rental shaped
  if (
    subject.includes('rental') || subject.includes('car hire') || subject.includes('booking') &&
    (body.includes('pick up') || body.includes('pickup') || body.includes('rental car') ||
     body.includes('hertz') || body.includes('avis') || body.includes('budget rent'))
  ) {
    if (body.includes('vehicle') || body.includes('rental') || body.includes('pickup') ||
        body.includes('drop off') || body.includes('drop-off') || body.includes('return location')) {
      const codeMatch = email.text.match(/(?:confirmation|booking|reservation)[^\d]{0,20}([A-Z0-9-]{6,})/i)
      const vehicleMatch = email.text.match(/(?:vehicle|car|model)[:\s]+([^\n]{3,40})/i)
      return {
        mode: 'mock',
        summary: 'Car rental booking.',
        bookings: [{
          type: 'car',
          title: email.subject,
          vendor: email.from.split('@')[1]?.split('.')[0] ?? undefined,
          startAt: extractDateOrNext(email.text, 30) + 'T10:00:00Z',
          endAt: extractDateOrNext(email.text, 33) + 'T10:00:00Z',
          confirmationCode: codeMatch?.[1],
          metadata: vehicleMatch ? { vehicle: vehicleMatch[1].trim() } : {},
        }],
        documents: [{ category: 'voucher', title: 'Car rental booking', notes: codeMatch?.[1] }],
        payments: [],
      }
    }
  }

  // Hotel-shaped
  if (
    subject.includes('booking') || subject.includes('reservation') || subject.includes('confirmation') ||
    body.includes('check-in') || body.includes('check in')
  ) {
    if (body.includes('hotel') || body.includes('ryokan') || body.includes('nights') || subject.includes('hotel')) {
      const titleMatch = email.subject.match(/(?:booking|reservation|confirmation)[\s\S]*?[:—-]\s*(.+)/i)
      const codeMatch = email.text.match(/(?:confirmation|booking|reference)[^\d]{0,20}([A-Z0-9-]{6,})/i)
      const nightsMatch = email.text.match(/(\d+)\s+night/i)
      const checkInMatch = email.text.match(/check[ -]?in[^:]*:\s*([\d:apm /-]+)/i)
      const checkOutMatch = email.text.match(/check[ -]?out[^:]*:\s*([\d:apm /-]+)/i)

      return {
        mode: 'mock',
        summary: `Hotel booking confirmation${titleMatch ? ` for ${titleMatch[1].trim()}` : ''}.`,
        bookings: [{
          type: 'hotel',
          title: titleMatch?.[1]?.trim() ?? email.subject.replace(/booking confirmation/i, '').trim(),
          vendor: email.from.split('@')[1]?.split('.')[0] ?? undefined,
          startAt: extractDateOrNext(email.text, 30) + 'T15:00:00Z',
          endAt: extractDateOrNext(email.text, 32) + 'T11:00:00Z',
          confirmationCode: codeMatch?.[1],
          metadata: {
            ...(checkInMatch ? { checkIn: checkInMatch[1].trim() } : { checkIn: '15:00' }),
            ...(checkOutMatch ? { checkOut: checkOutMatch[1].trim() } : { checkOut: '11:00' }),
            ...(nightsMatch ? { nights: Number(nightsMatch[1]) } : {}),
            breakfast: body.includes('breakfast') ? 'Included' : 'Not included',
          },
        }],
        documents: [{
          category: 'voucher',
          title: `${titleMatch?.[1]?.trim() ?? 'Hotel'} booking`,
          notes: codeMatch?.[1],
        }],
        payments: [],
      }
    }
  }

  // Flight-shaped
  if (
    subject.includes('flight') || subject.includes('itinerary') || subject.includes('booking') ||
    /\b[A-Z]{2}\d{2,4}\b/.test(email.subject) // QF25, AA101
  ) {
    const flightMatch = email.subject.match(/\b([A-Z]{2}\d{2,4})\b/) ||
      email.text.match(/\b([A-Z]{2}\d{2,4})\b/)
    return {
      mode: 'mock',
      summary: `Flight ${flightMatch?.[1] ?? ''} confirmation.`,
      bookings: [{
        type: 'flight',
        title: `Flight ${flightMatch?.[1] ?? ''}`,
        vendor: email.from.split('@')[1]?.split('.')[0] ?? undefined,
        startAt: extractDateOrNext(email.text, 30) + 'T09:00:00Z',
      }],
      documents: [{ category: 'ticket', title: `Flight ${flightMatch?.[1] ?? ''}` }],
      payments: [],
    }
  }

  // Restaurant
  if (subject.includes('reservation') || body.includes('table for') || body.includes('pax')) {
    return {
      mode: 'mock',
      summary: 'Restaurant reservation.',
      bookings: [{
        type: 'restaurant',
        title: email.subject,
        startAt: extractDateOrNext(email.text, 30) + 'T19:30:00Z',
      }],
      documents: [],
      payments: [],
    }
  }

  // Fallback: just record it as a generic booking
  return {
    mode: 'mock',
    summary: `Couldn't classify — filed as generic booking. Add an Anthropic API key in .env.local for real parsing.`,
    bookings: [{
      type: 'other',
      title: email.subject,
      startAt: extractDateOrNext(email.text, 30) + 'T12:00:00Z',
      notes: 'Filed by mock parser — set ANTHROPIC_API_KEY for real parsing.',
    }],
    documents: [],
    payments: [],
  }
}

function extractDateOrNext(text: string, daysAhead: number): string {
  // Try common date patterns first
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const usDate = text.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/) // "October 15, 2026"
  if (usDate) {
    try {
      const d = new Date(`${usDate[1]} ${usDate[2]}, ${usDate[3]}`)
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    } catch { /* ignore */ }
  }
  const d = new Date(Date.now() + daysAhead * 86400000)
  return d.toISOString().slice(0, 10)
}
