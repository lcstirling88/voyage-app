import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { BookingEditFormClient } from '@/components/BookingEditFormClient'
import { safeJson } from '@/lib/format'

const TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel', flight: 'Flight', activity: 'Activity',
  restaurant: 'Restaurant', transit: 'Transit', car: 'Car hire', other: 'Other',
}

export default async function BookingPage({ params }: { params: Promise<{ tripSlug: string; bookingId: string }> }) {
  const { tripSlug, bookingId } = await params
  await requireTripAccess(tripSlug)

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { trip: true, sourceEmail: true },
  })
  if (!booking || booking.trip.slug !== tripSlug) notFound()

  const meta = (safeJson<Record<string, string>>(booking.metadata) ?? {}) as Record<string, string>

  return (
    <>
      <div className="hero-light border-b border-line">
        <div className="px-6 sm:px-10 py-8 sm:py-10 max-w-4xl">
          <Link
            href={`/trips/${tripSlug}/itinerary`}
            className="text-xs text-ink-muted inline-flex items-center gap-1 ulink mb-6"
          >
            <ChevronLeft className="w-3 h-3" /> Back to itinerary
          </Link>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            {TYPE_LABELS[booking.type] ?? booking.type}
            {booking.vendor && <span> · {booking.vendor}</span>}
          </div>
          <h1 className="h-display text-3xl sm:text-5xl mt-2">{booking.title}</h1>
          {booking.sourceEmail && (
            <p className="text-xs text-ink-muted mt-3">
              Parsed from email: <span className="num-mono">{booking.sourceEmail.subject}</span>
              <span className="ml-1">(from {booking.sourceEmail.fromAddress})</span>
            </p>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-10 py-8 sm:py-12 max-w-4xl">
        <BookingEditFormClient
          initial={{
            id: booking.id,
            tripSlug: booking.trip.slug,
            type: booking.type,
            title: booking.title,
            vendor: booking.vendor,
            date: format(booking.startAt, 'yyyy-MM-dd'),
            time: format(booking.startAt, 'HH:mm'),
            endDate: booking.endAt ? format(booking.endAt, 'yyyy-MM-dd') : '',
            endTime: booking.endAt ? format(booking.endAt, 'HH:mm') : '',
            location: booking.location,
            address: booking.address,
            confirmationCode: booking.confirmationCode,
            notes: booking.notes,
            cost: booking.cost != null ? String(booking.cost) : '',
            currency: booking.currency ?? booking.trip.homeCurrency,
            paid: booking.paid,
            paymentMethod: booking.paymentMethod,
            cancelDate: booking.cancelByAt ? format(booking.cancelByAt, 'yyyy-MM-dd') : '',
            cancelTime: booking.cancelByAt ? format(booking.cancelByAt, 'HH:mm') : '',
            cancellationPolicy: booking.cancellationPolicy,
            checkIn: meta.checkIn ?? '',
            checkOut: meta.checkOut ?? '',
            breakfast: meta.breakfast ?? '',
          }}
        />
      </div>
    </>
  )
}
