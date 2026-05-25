import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { requireTripAccess } from '@/lib/session'
import { AddBookingPageClient } from '@/components/AddBookingPageClient'
import { SESSION_LABEL, type Session } from '@/lib/itinerary'

export default async function AddBookingPage({
  params, searchParams,
}: {
  params: Promise<{ tripSlug: string }>
  searchParams: Promise<{ date?: string; session?: string }>
}) {
  const { tripSlug } = await params
  const { date, session } = await searchParams
  const { trip } = await requireTripAccess(tripSlug)

  const safeDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : format(trip.startDate, 'yyyy-MM-dd')
  const dayDate = parseISO(safeDate)
  const dayNum = differenceInDays(dayDate, trip.startDate) + 1

  const sessionKey: Session | '' =
    session === 'morning' || session === 'afternoon' || session === 'night' ? session : ''

  return (
    <>
      <div className="hero-light border-b border-line">
        <div className="px-6 sm:px-10 py-8 sm:py-10 max-w-5xl">
          <Link
            href={`/trips/${tripSlug}/itinerary`}
            className="text-xs text-ink-muted inline-flex items-center gap-1 ulink mb-6"
          >
            <ChevronLeft className="w-3 h-3" /> Back to itinerary
          </Link>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Add to Day {String(dayNum).padStart(2, '0')}{sessionKey ? ` · ${SESSION_LABEL[sessionKey]}` : ''}
          </div>
          <h1 className="h-display text-4xl sm:text-6xl mt-2">{format(dayDate, 'EEEE, MMM d')}.</h1>
          <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base">
            Either type it in manually, or ask the AI for ideas — it knows your trip context.
          </p>
        </div>
      </div>

      <div className="px-4 sm:px-10 py-8 sm:py-12 max-w-5xl">
        <AddBookingPageClient tripSlug={tripSlug} date={safeDate} session={sessionKey} />
      </div>
    </>
  )
}
