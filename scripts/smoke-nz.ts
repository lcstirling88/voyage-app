/**
 * Smoke test: create the NZ trip the way the form does, then POST a sample booking
 * email to /api/email/inbound and confirm it lands in the right trip.
 */
import 'dotenv/config'
import { randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
})
const prisma = new PrismaClient({ adapter })

const slugify = (s: string) =>
  s.toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'trip'

async function uniqueSlug(base: string) {
  let slug = base, n = 2
  while (await prisma.trip.findUnique({ where: { slug } })) slug = `${base}-${n++}`
  return slug
}

async function uniqueToken() {
  for (let i = 0; i < 8; i++) {
    const t = randomBytes(6).toString('base64url').toLowerCase()
    if (!(await prisma.trip.findUnique({ where: { inboxToken: t } }))) return t
  }
  throw new Error('Could not generate token')
}

async function main() {
  console.log('-- 1. Create the NZ trip --')

  // Wipe any existing NZ trip from prior runs
  const existing = await prisma.trip.findUnique({ where: { slug: 'south-island-roadtrip' } })
  if (existing) {
    await prisma.trip.delete({ where: { id: existing.id } })
    console.log('   (removed previous NZ trip)')
  }

  const slug = await uniqueSlug(slugify('South Island Roadtrip'))
  const inboxToken = await uniqueToken()

  const trip = await prisma.$transaction(async (tx) => {
    const t = await tx.trip.create({
      data: {
        slug,
        name: 'South Island Roadtrip',
        tagline: 'Queenstown → Mt Cook → Tekapo → Christchurch · ten lakes and a rental hatchback.',
        destination: 'New Zealand',
        themeKey: 'new-zealand',
        startDate: new Date('2026-12-26T00:00:00Z'),
        endDate: new Date('2027-01-05T00:00:00Z'),
        homeCurrency: 'AUD',
        inboxToken,
        travelerNames: 'Liam Christiansen, +1',
        departureCity: 'Sydney',
      },
    })

    await tx.city.createMany({
      data: [
        { tripId: t.id, name: 'Queenstown',   country: 'New Zealand', arriveOn: new Date('2026-12-26'), leaveOn: new Date('2026-12-30'), displayOrder: 1 },
        { tripId: t.id, name: 'Wanaka',       country: 'New Zealand', arriveOn: new Date('2026-12-30'), leaveOn: new Date('2027-01-01'), displayOrder: 2 },
        { tripId: t.id, name: 'Mount Cook',   country: 'New Zealand', arriveOn: new Date('2027-01-01'), leaveOn: new Date('2027-01-03'), displayOrder: 3 },
        { tripId: t.id, name: 'Christchurch', country: 'New Zealand', arriveOn: new Date('2027-01-03'), leaveOn: new Date('2027-01-05'), displayOrder: 4 },
      ],
    })

    const checklist = [
      { section: '3mo',    text: 'Book flights',                            position: 1 },
      { section: '3mo',    text: 'Book accommodation',                      position: 2 },
      { section: '3mo',    text: 'Check visa / entry requirements',         position: 3 },
      { section: '3mo',    text: 'Book signature restaurants / experiences',position: 4 },
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
    ]
    await tx.checklistItem.createMany({
      data: checklist.map((c) => ({ tripId: t.id, ...c })),
    })

    return t
  })

  console.log(`   slug:        ${trip.slug}`)
  console.log(`   inboxToken:  ${trip.inboxToken}`)
  console.log(`   address:     inbox+${trip.inboxToken}@${process.env.NEXT_PUBLIC_INBOX_DOMAIN ?? 'voyage.local'}`)
  console.log(`   url:         http://localhost:3000/trips/${trip.slug}/inbox`)

  console.log('\n-- 2. POST a Queenstown lodge confirmation to /api/email/inbound --')

  const payload = {
    From: 'reservations@matakauri.co.nz',
    To: `inbox+${trip.inboxToken}@voyage.local`,
    Subject: 'Booking confirmation — Matakauri Lodge — 4 nights',
    TextBody: `Kia ora Liam,

We're delighted to confirm your reservation at Matakauri Lodge.

Check-in:   Saturday, December 26, 2026 at 3:00 PM
Check-out:  Wednesday, December 30, 2026 at 11:00 AM
Nights:     4
Suite:      Owner's Cottage
Guests:     2 adults
Breakfast:  Included in Tara restaurant
Dinner:     Pre-paid 4-course tasting menu nightly

Confirmation number: MTK-7HQ-2026-LC
Total: NZD 12,400 (deposit NZD 3,100 charged; balance auto-billed Dec 1)

Address: 569 Glenorchy Queenstown Road, Closeburn 9371
`,
  }

  const res = await fetch('http://localhost:3000/api/email/inbound', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  console.log('   webhook response:', JSON.stringify(json, null, 2))

  console.log('\n-- 3. Verify the booking landed in the right trip --')
  const reloaded = await prisma.trip.findUnique({
    where: { slug: trip.slug },
    include: {
      bookings: { orderBy: { startAt: 'asc' } },
      documents: true,
      emails: { include: { bookings: true, documents: true } },
    },
  })
  console.log(`   bookings:          ${reloaded?.bookings.length}`)
  for (const b of reloaded?.bookings ?? []) {
    console.log(`     · ${b.type.padEnd(10)} ${b.title}  [${b.confirmationCode ?? '—'}]`)
  }
  console.log(`   documents:         ${reloaded?.documents.length}`)
  for (const d of reloaded?.documents ?? []) {
    console.log(`     · ${d.category.padEnd(10)} ${d.title}`)
  }
  console.log(`   emails received:   ${reloaded?.emails.length}`)
  for (const e of reloaded?.emails ?? []) {
    console.log(`     · ${e.subject} (parsed: ${e.parsedSummary ?? '—'})`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
