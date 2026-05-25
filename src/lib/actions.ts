'use server'

import { randomBytes } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { prisma } from './db'
import { parseEmail, type ParserResult } from './email-parser'
import { deriveThemeFromDestination, type ThemeKey } from './theme'
import { requireUser, requireTripAccess } from './session'

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
        inboxToken,
        travelerNames,
        departureCity,
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

  for (const b of parsed.bookings) {
    await prisma.booking.create({
      data: {
        tripId: trip.id,
        type: b.type,
        title: b.title,
        vendor: b.vendor,
        startAt: new Date(b.startAt),
        endAt: b.endAt ? new Date(b.endAt) : undefined,
        location: b.location,
        address: b.address,
        confirmationCode: b.confirmationCode,
        notes: b.notes,
        cost: b.cost,
        currency: b.currency ?? trip.homeCurrency,
        paid: b.paid ?? false,
        metadata: b.metadata ? JSON.stringify(b.metadata) : undefined,
        sourceEmailId: incoming.id,
      },
    })
  }

  for (const d of parsed.documents) {
    await prisma.document.create({
      data: {
        tripId: trip.id,
        category: d.category,
        title: d.title,
        notes: d.notes,
        sourceEmailId: incoming.id,
      },
    })
  }

  for (const p of parsed.payments) {
    await prisma.payment.create({
      data: {
        tripId: trip.id,
        description: p.description,
        amount: p.amount,
        currency: p.currency,
        dueDate: new Date(p.dueDate),
        autoPay: p.autoPay ?? false,
        paymentMethod: p.paymentMethod,
      },
    })
  }

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

  if (!name) return { ok: false, error: 'Trip name is required.' }
  if (!destination) return { ok: false, error: 'Destination is required.' }
  if (!startDateStr || !endDateStr) return { ok: false, error: 'Dates required.' }
  const startDate = new Date(startDateStr + 'T00:00:00Z')
  const endDate = new Date(endDateStr + 'T00:00:00Z')
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return { ok: false, error: 'Invalid dates.' }
  if (endDate < startDate) return { ok: false, error: 'End date must be after start date.' }

  const themeKey: ThemeKey = (themeOverride as ThemeKey) || deriveThemeFromDestination(destination)

  // If name changed materially, regenerate slug
  let slug = existing.slug
  if (name !== existing.name) {
    const baseSlug = slugify(name)
    if (baseSlug !== existing.slug) slug = await uniqueSlug(baseSlug)
  }

  await prisma.trip.update({
    where: { id },
    data: { name, tagline, destination, themeKey, startDate, endDate, homeCurrency, travelerNames, departureCity, slug },
  })

  revalidatePath('/trips')
  revalidatePath(`/trips/${slug}`, 'layout')
  return { ok: true, slug }
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
