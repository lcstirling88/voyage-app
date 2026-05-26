/**
 * Compare what Claude extracted from each email vs what's in the DB.
 * Diagnose the missing-bookings issue.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const emails = await prisma.incomingEmail.findMany({
    where: { processed: true, tripId: { not: null } },
    orderBy: { receivedAt: 'asc' },
  })

  console.log(`Processed emails: ${emails.length}\n`)

  let totalParsedBookings = 0
  let totalParsedDocs = 0
  let totalParsedPayments = 0

  for (const e of emails) {
    const parsed = e.parsedJson ? JSON.parse(e.parsedJson) : null
    if (!parsed) { console.log(`(no parsedJson) ${e.subject}\n`); continue }

    const bookings = parsed.bookings ?? []
    const docs = parsed.documents ?? []
    const pays = parsed.payments ?? []
    totalParsedBookings += bookings.length
    totalParsedDocs += docs.length
    totalParsedPayments += pays.length

    console.log(`📧 ${e.subject}`)
    console.log(`   Bookings parsed: ${bookings.length}`)
    for (const b of bookings) {
      console.log(`     - [${b.type}] ${b.title}`)
      console.log(`       startAt: ${b.startAt}   endAt: ${b.endAt ?? '(none)'}`)
      console.log(`       confirmationCode: ${b.confirmationCode ?? '(none)'}`)
    }
    if (docs.length) console.log(`   Documents: ${docs.length}`)
    if (pays.length) console.log(`   Payments: ${pays.length}`)
    console.log()
  }

  // Now count what's actually in the DB
  const actualBookings = await prisma.booking.count()
  const actualDocs = await prisma.document.count()
  const actualPays = await prisma.payment.count()

  console.log('=========================================')
  console.log(`Parsed from emails:  ${totalParsedBookings} bookings, ${totalParsedDocs} docs, ${totalParsedPayments} payments`)
  console.log(`Actually in DB:      ${actualBookings} bookings, ${actualDocs} docs, ${actualPays} payments`)
  console.log(`Lost:                ${totalParsedBookings - actualBookings} bookings, ${totalParsedDocs - actualDocs} docs, ${totalParsedPayments - actualPays} payments`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
