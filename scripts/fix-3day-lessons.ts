/**
 * One-off: fix the Cardrona 3-Day Group Ski Lessons (Cameron & Lauren) schedule.
 * Email said "10:30am–3:45pm with a 45-min lunch break", span Jun 22 → Jun 24 (3 days).
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Title contains "3-Day Group Ski Lessons" — be specific so we don't catch the Skiwees one
  const booking = await prisma.booking.findFirst({
    where: { title: { contains: '3-Day Group Ski Lessons', mode: 'insensitive' } },
  })
  if (!booking) {
    console.log('No 3-Day Group Ski Lessons booking found.')
    return
  }

  console.log(`Found: ${booking.title}`)
  console.log(`  Before:`)
  console.log(`    startAt: ${booking.startAt.toISOString()}`)
  console.log(`    endAt:   ${booking.endAt?.toISOString() ?? '(null)'}`)

  const newStart = new Date('2026-06-22T10:30:00.000Z')
  const newEnd   = new Date('2026-06-24T15:45:00.000Z')

  await prisma.booking.update({
    where: { id: booking.id },
    data: { startAt: newStart, endAt: newEnd },
  })

  console.log(`  After:`)
  console.log(`    startAt: ${newStart.toISOString()}  (10:30 AM, Mon Jun 22)`)
  console.log(`    endAt:   ${newEnd.toISOString()}  (3:45 PM, Wed Jun 24)`)
  console.log(`    span:    3 days (Day 1 → Day 3)`)
  console.log(`    sessions: morning + afternoon each day`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
