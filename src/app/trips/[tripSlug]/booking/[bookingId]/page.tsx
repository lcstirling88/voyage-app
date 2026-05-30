import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ExternalLink, Paperclip, FileText } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { BookingEditFormClient } from '@/components/BookingEditFormClient'
import { safeJson, fmtDateInput, fmtTime } from '@/lib/format'

const TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel', flight: 'Flight', activity: 'Activity',
  restaurant: 'Restaurant', transit: 'Transit', car: 'Car hire', other: 'Other',
}

export default async function BookingPage({ params }: { params: Promise<{ tripSlug: string; bookingId: string }> }) {
  const { tripSlug, bookingId } = await params
  await requireTripAccess(tripSlug)

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      trip: true,
      sourceEmail: {
        include: {
          // Only attachments with a real stored file behind them (non-empty
          // storagePath) are downloadable via the /api/attachments proxy.
          attachments: {
            where: { storagePath: { not: '' } },
            select: { id: true, filename: true, mimeType: true, size: true },
            orderBy: { filename: 'asc' },
          },
        },
      },
    },
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
        {/* Documents attached to the booking's source email — the actual
            e-ticket / voucher PDFs, downloadable via the authenticated proxy.
            Shown above the edit form so they're visible without scrolling. */}
        {booking.sourceEmail && booking.sourceEmail.attachments.length > 0 && (
          <section className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6 mb-8">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted flex items-center gap-2 mb-3">
              <Paperclip className="w-3 h-3" />
              <span>Documents · {booking.sourceEmail.attachments.length}</span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {booking.sourceEmail.attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={`/api/attachments/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 -mx-2 px-2 py-1.5 rounded hover:bg-line-soft/40 transition"
                  >
                    <FileText className="w-4 h-4 shrink-0 text-sage" />
                    <span className="flex-1 min-w-0 truncate group-hover:text-sage">{a.filename}</span>
                    <span className="text-[10px] num-mono text-ink-muted shrink-0 hidden sm:inline">{a.mimeType}</span>
                    <span className="text-[10px] num-mono text-ink-muted shrink-0">{(a.size / 1024).toFixed(0)}KB</span>
                    <ExternalLink className="w-3.5 h-3.5 text-ink-muted/60 group-hover:text-sage shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <BookingEditFormClient
          initial={{
            id: booking.id,
            tripSlug: booking.trip.slug,
            type: booking.type,
            title: booking.title,
            vendor: booking.vendor,
            date: fmtDateInput(booking.startAt),
            time: fmtTime(booking.startAt),
            endDate: booking.endAt ? fmtDateInput(booking.endAt) : '',
            endTime: booking.endAt ? fmtTime(booking.endAt) : '',
            location: booking.location,
            address: booking.address,
            confirmationCode: booking.confirmationCode,
            notes: booking.notes,
            cost: booking.cost != null ? String(booking.cost) : '',
            currency: booking.currency ?? booking.trip.homeCurrency,
            paid: booking.paid,
            paymentMethod: booking.paymentMethod,
            cancelDate: booking.cancelByAt ? fmtDateInput(booking.cancelByAt) : '',
            cancelTime: booking.cancelByAt ? fmtTime(booking.cancelByAt) : '',
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
