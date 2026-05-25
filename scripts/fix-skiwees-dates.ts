/**
 * One-off: set the Cardrona Skiwees 4-Day Programme to its correct schedule.
 * Drop-off 08:30, daily end 15:45, span Jun 22 → Jun 25 (4 days).
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const skiwees = await prisma.booking.findFirst({
    where: { title: { contains: 'Skiwees', mode: 'insensitive' } },
  })
  if (!skiwees) {
    console.log('No Skiwees booking found.')
    return
  }

  console.log(`Found: ${skiwees.title}`)
  console.log(`  Before:`)
  console.log(`    startAt: ${skiwees.startAt.toISOString()}`)
  console.log(`    endAt:   ${skiwees.endAt?.toISOString() ?? '(null)'}`)

  const newStart = new Date('2026-06-22T08:30:00.000Z')
  const newEnd = new Date('2026-06-25T15:45:00.000Z')

  await prisma.booking.update({
    where: { id: skiwees.id },
    data: { startAt: newStart, endAt: newEnd },
  })

  console.log(`  After:`)
  console.log(`    startAt: ${newStart.toISOString()}  (8:30 AM, Mon Jun 22)`)
  console.log(`    endAt:   ${newEnd.toISOString()}  (3:45 PM, Thu Jun 25)`)
  console.log(`    span:    4 days (Day 1 of 4 → Day 4 of 4)`)
  console.log(`    sessions: morning + afternoon each day`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
