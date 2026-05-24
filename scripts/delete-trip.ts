/**
 * Delete a trip by slug. Usage: npx tsx scripts/delete-trip.ts <slug>
 * Cascading deletes remove all bookings, documents, payments, checklist items, emails.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const slug = process.argv[2]
if (!slug) { console.error('Usage: npx tsx scripts/delete-trip.ts <slug>'); process.exit(1) }

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
})
const prisma = new PrismaClient({ adapter })

;(async () => {
  const trip = await prisma.trip.findUnique({ where: { slug } })
  if (!trip) { console.log(`No trip with slug "${slug}".`); process.exit(0) }
  await prisma.trip.delete({ where: { id: trip.id } })
  console.log(`Deleted trip "${trip.name}" (slug ${slug}).`)
  await prisma.$disconnect()
})()
