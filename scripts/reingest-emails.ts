/**
 * Re-ingest all processed IncomingEmails for the NZ trip from their stored
 * parsedJson. Useful after fixing a dedup bug to restore bookings that got
 * over-eagerly merged.
 *
 * Doesn't re-call Claude — just replays the persistParserResult against the
 * data Claude already extracted. Cheap and idempotent.
 *
 * Wipes existing Bookings/Documents/Payments first so we start clean.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { persistParserResult } from '../src/lib/ingest'
import type { ParserResult } from '../src/lib/email-parser'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const trip = await prisma.trip.findFirst({
    where: { destination: { contains: 'New Zealand', mode: 'insensitive' } },
    include: { emails: { where: { processed: true, parsedJson: { not: null } }, orderBy: { receivedAt: 'asc' } } },
  })
  if (!trip) { console.log('No NZ trip found.'); return }

  console.log(`Wiping ${await prisma.booking.count({ where: { tripId: trip.id } })} bookings, ` +
              `${await prisma.document.count({ where: { tripId: trip.id } })} documents, ` +
              `${await prisma.payment.count({ where: { tripId: trip.id } })} payments…`)
  await prisma.booking.deleteMany({ where: { tripId: trip.id } })
  await prisma.document.deleteMany({ where: { tripId: trip.id } })
  await prisma.payment.deleteMany({ where: { tripId: trip.id } })

  console.log(`Re-ingesting ${trip.emails.length} emails in chronological order…\n`)

  const totals = {
    bookingsCreated: 0, bookingsUpdated: 0,
    documentsCreated: 0, documentsUpdated: 0,
    paymentsCreated: 0, paymentsSkipped: 0,
  }

  for (const email of trip.emails) {
    if (!email.parsedJson) continue
    let parsed: ParserResult
    try {
      parsed = JSON.parse(email.parsedJson) as ParserResult
    } catch (err) {
      console.log(`  ⚠  Skipping ${email.subject} — parsedJson invalid (${err})`)
      continue
    }

    const summary = await persistParserResult(trip, parsed, email.id)
    console.log(`  ${email.subject.slice(0, 70).padEnd(72)} +${summary.bookingsCreated}b ~${summary.bookingsUpdated}u +${summary.documentsCreated}d +${summary.paymentsCreated}p`)
    totals.bookingsCreated += summary.bookingsCreated
    totals.bookingsUpdated += summary.bookingsUpdated
    totals.documentsCreated += summary.documentsCreated
    totals.documentsUpdated += summary.documentsUpdated
    totals.paymentsCreated += summary.paymentsCreated
    totals.paymentsSkipped += summary.paymentsSkipped
  }

  console.log('\n=========================================')
  console.log(`Result: ${totals.bookingsCreated} bookings created, ${totals.bookingsUpdated} updated`)
  console.log(`        ${totals.documentsCreated} docs created, ${totals.documentsUpdated} updated`)
  console.log(`        ${totals.paymentsCreated} payments created, ${totals.paymentsSkipped} skipped`)

  const final = {
    bookings: await prisma.booking.count({ where: { tripId: trip.id } }),
    documents: await prisma.document.count({ where: { tripId: trip.id } }),
    payments: await prisma.payment.count({ where: { tripId: trip.id } }),
  }
  console.log(`Final state: ${final.bookings} bookings, ${final.documents} docs, ${final.payments} payments`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
