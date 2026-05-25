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

export type IngestSummary = {
  bookingsCreated: number
  bookingsUpdated: number
  documentsCreated: number
  documentsUpdated: number
  paymentsCreated: number
  paymentsSkipped: number
}

async function findDuplicateBooking(tripId: string, b: ParsedBooking): Promise<Booking | null> {
  // 1. Strongest match: exact confirmation code
  if (b.confirmationCode) {
    const m = await prisma.booking.findFirst({
      where: { tripId, confirmationCode: b.confirmationCode },
    })
    if (m) return m
  }
  // 2. Same type + vendor + same startAt calendar day
  if (b.vendor) {
    const startDay = startOfDay(new Date(b.startAt))
    const endDay = endOfDay(new Date(b.startAt))
    const m = await prisma.booking.findFirst({
      where: {
        tripId,
        type: b.type,
        vendor: b.vendor,
        startAt: { gte: startDay, lte: endDay },
      },
    })
    if (m) return m
  }
  // 3. (Loose) Same type + title + same startAt day
  const startDay = startOfDay(new Date(b.startAt))
  const endDay = endOfDay(new Date(b.startAt))
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
      startAt: new Date(b.startAt),
      endAt: b.endAt ? new Date(b.endAt) : null,
      location: b.location ?? null,
      address: b.address ?? null,
      confirmationCode: b.confirmationCode ?? null,
      notes: b.notes ?? null,
      cost: b.cost ?? null,
      currency: b.currency ?? trip.homeCurrency,
      paid: b.paid ?? false,
      cancelByAt: b.cancelByAt ? new Date(b.cancelByAt) : null,
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
    const due = new Date(p.dueDate)
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
