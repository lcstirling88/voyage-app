/**
 * Persist a ParserResult to the database with duplicate detection.
 *
 * Used by both the inbound webhook (/api/email/inbound) and the paste-email
 * server action (ingestPastedEmail in actions.ts). Keeps the dedup logic in
 * one place so forwarded duplicates don't show up twice.
 *
 * Matching rules:
 *   - Booking: confirmationCode (strongest) OR same trip+type+vendor+same startAt date
 *   - Document: same trip + category + title
 *   - Payment: same trip + description + same dueDate
 *
 * On match: update the existing record with any non-empty fields from the new parse
 * and re-link to the new source email.
 */

import { startOfDay, endOfDay } from 'date-fns'
import { prisma } from './db'
import type { Booking, Trip } from '@prisma/client'
import type { ParsedBooking, ParserResult } from './email-parser'

/**
 * Parse a Claude-emitted datetime preserving its wall-clock components verbatim,
 * regardless of any timezone offset.
 *
 * Why: Postgres `timestamp(3)` (Prisma `DateTime` by default) strips timezone
 * on insert and stores the UTC instant. So for NZ-local "2026-06-18T08:00:00+12:00"
 * the stored value would become Jun 17 20:00 UTC — wrong calendar day for a
 * traveller who thinks of it as "Jun 18 morning".
 *
 * By stripping the offset first ("2026-06-18T08:00:00") and treating those wall
 * clock components as if they were UTC, the stored value becomes Jun 18 08:00 —
 * and reading it back with .getUTCHours() / startOfDay() yields the right day
 * and time-of-day the traveller expects to see in the app.
 */
function parseLocalDateTime(iso: string): Date {
  if (!iso) return new Date(NaN)
  const stripped = iso.replace(/Z$/i, '').replace(/[+-]\d{2}:?\d{2}$/, '')
  // Append Z so JS interprets the bare wall-clock as UTC, preserving the digits.
  return new Date(stripped + 'Z')
}

export type IngestSummary = {
  bookingsCreated: number
  bookingsUpdated: number
  documentsCreated: number
  documentsUpdated: number
  paymentsCreated: number
  paymentsSkipped: number
}

function bookingDayBounds(b: ParsedBooking): { startDay: Date; endDay: Date } {
  const start = parseLocalDateTime(b.startAt)
  return { startDay: startOfDay(start), endDay: endOfDay(start) }
}

/**
 * Strip room/suite descriptors and traveller names that come after an en/em-dash,
 * so two near-duplicate forwards with slightly different Claude output can still match.
 *   "Quest Cathedral – Two-Bedroom Apartment"  →  "quest cathedral"
 *   "Quest Cathedral"                          →  "quest cathedral"
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+[–—]\s+.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function findDuplicateBooking(tripId: string, b: ParsedBooking): Promise<Booking | null> {
  // 1. Strongest match: same confirmation code AND same type AND same "core title"
  //    (room/suite descriptors after the en-dash are ignored). This catches the
  //    "same hotel forwarded twice with slightly different parsing" case while
  //    still keeping the 3 items of a multi-line order distinct.
  if (b.confirmationCode) {
    const candidates = await prisma.booking.findMany({
      where: { tripId, confirmationCode: b.confirmationCode, type: b.type },
    })
    const target = normalizeTitle(b.title)
    const m = candidates.find((c) => normalizeTitle(c.title) === target)
    if (m) return m
  }
  // 2. Same type + vendor + same title + same startAt calendar day.
  //    (Title check stops Booking.com confirmations on the same day for different
  //    hotels from merging.)
  if (b.vendor) {
    const { startDay, endDay } = bookingDayBounds(b)
    const m = await prisma.booking.findFirst({
      where: {
        tripId,
        type: b.type,
        vendor: b.vendor,
        title: b.title,
        startAt: { gte: startDay, lte: endDay },
      },
    })
    if (m) return m
  }
  // 3. Same type + same title + same startAt day (loose — covers cases where
  //    confirmation code differs between a confirmation email and its later receipt
  //    but the activity itself is the same).
  const { startDay, endDay } = bookingDayBounds(b)
  const m = await prisma.booking.findFirst({
    where: {
      tripId,
      type: b.type,
      title: b.title,
      startAt: { gte: startDay, lte: endDay },
    },
  })
  return m
}

/** Build a partial update record where empty values from the new parse don't clobber existing data. */
function preserveNonEmpty<T extends Record<string, unknown>>(incoming: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out as Partial<T>
}

export async function persistParserResult(
  trip: Trip,
  parsed: ParserResult,
  incomingEmailId: string,
): Promise<IngestSummary> {
  const summary: IngestSummary = {
    bookingsCreated: 0, bookingsUpdated: 0,
    documentsCreated: 0, documentsUpdated: 0,
    paymentsCreated: 0, paymentsSkipped: 0,
  }

  // ----- Bookings -----
  for (const b of parsed.bookings) {
    const existing = await findDuplicateBooking(trip.id, b)
    const data = {
      type: b.type,
      title: b.title,
      vendor: b.vendor ?? null,
      startAt: parseLocalDateTime(b.startAt),
      endAt: b.endAt ? parseLocalDateTime(b.endAt) : null,
      location: b.location ?? null,
      address: b.address ?? null,
      confirmationCode: b.confirmationCode ?? null,
      notes: b.notes ?? null,
      cost: b.cost ?? null,
      currency: b.currency ?? trip.homeCurrency,
      paid: b.paid ?? false,
      cancelByAt: b.cancelByAt ? parseLocalDateTime(b.cancelByAt) : null,
      cancellationPolicy: b.cancellationPolicy ?? null,
      metadata: b.metadata ? JSON.stringify(b.metadata) : null,
      sourceEmailId: incomingEmailId,
    }
    if (existing) {
      // Update non-empty fields only — preserve any data we already have
      const update = preserveNonEmpty({
        ...data,
        // Keep sourceEmailId fresh so the latest email becomes the source-of-truth link
        sourceEmailId: incomingEmailId,
      })
      await prisma.booking.update({ where: { id: existing.id }, data: update })
      summary.bookingsUpdated++
    } else {
      await prisma.booking.create({ data: { tripId: trip.id, ...data } })
      summary.bookingsCreated++
    }
  }

  // ----- Documents -----
  for (const d of parsed.documents) {
    const existing = await prisma.document.findFirst({
      where: { tripId: trip.id, category: d.category, title: d.title },
    })
    if (existing) {
      await prisma.document.update({
        where: { id: existing.id },
        data: {
          notes: d.notes ?? existing.notes,
          sourceEmailId: incomingEmailId,
        },
      })
      summary.documentsUpdated++
    } else {
      await prisma.document.create({
        data: {
          tripId: trip.id, category: d.category, title: d.title,
          notes: d.notes ?? null, sourceEmailId: incomingEmailId,
        },
      })
      summary.documentsCreated++
    }
  }

  // ----- Payments -----
  for (const p of parsed.payments) {
    const due = parseLocalDateTime(p.dueDate)
    const existing = await prisma.payment.findFirst({
      where: { tripId: trip.id, description: p.description, dueDate: due },
    })
    if (existing) {
      summary.paymentsSkipped++
      continue
    }
    await prisma.payment.create({
      data: {
        tripId: trip.id,
        description: p.description, amount: p.amount, currency: p.currency,
        dueDate: due, autoPay: p.autoPay ?? false, paymentMethod: p.paymentMethod,
      },
    })
    summary.paymentsCreated++
  }

  return summary
}
