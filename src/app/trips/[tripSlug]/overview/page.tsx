/**
 * Trip Overview — the "home screen" of a trip.
 *
 * Just two bands now: a full-bleed hero strip (trip name, dates, countdown)
 * and an 8-tile app launcher that fans out to each feature page. Everything
 * else (stats strip, up-next, cities, Ask Itinera CTA) has been retired —
 * those details live inside their respective tiles when you tap through.
 */

import { notFound } from 'next/navigation'
import { differenceInDays } from 'date-fns'
import { prisma } from '@/lib/db'
import { fmtDate, fmtMoney } from '@/lib/format'
import { getTheme } from '@/lib/theme'
import { CountdownClient } from '@/components/CountdownClient'
import { TripFeatureTiles } from '@/components/TripFeatureTiles'

export default async function OverviewPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: {
      cities: { select: { id: true } },
      bookings: { select: { cost: true, paid: true } },
      checklistItems: { select: { done: true } },
      _count: { select: { bookings: true, documents: true, emails: { where: { processed: false } } } },
    },
  })
  if (!trip) notFound()

  const theme = getTheme(trip.themeKey)
  const totalBudget = trip.bookings.reduce((sum, b) => sum + (b.cost ?? 0), 0)
  const paidSoFar = trip.bookings.filter((b) => b.paid).reduce((s, b) => s + (b.cost ?? 0), 0)
  const paidPct = totalBudget ? Math.round((paidSoFar / totalBudget) * 100) : 0

  // Member count for the Settings tile preview ("you + 2 others" style).
  const memberCount = await prisma.membership.count({ where: { tripId: trip.id } })

  // Live preview strings for the feature tiles below the hero.
  const tripDays = Math.max(1, differenceInDays(trip.endDate, trip.startDate) + 1)
  const checklistTotal = trip.checklistItems.length
  const checklistDone = trip.checklistItems.filter((i) => i.done).length
  const unreadEmails = trip._count.emails

  const itineraryPreview = trip._count.bookings === 0
    ? 'Nothing booked yet'
    : `${trip._count.bookings} ${trip._count.bookings === 1 ? 'booking' : 'bookings'}${trip.cities.length > 0 ? ` · ${trip.cities.length} ${trip.cities.length === 1 ? 'city' : 'cities'}` : ''}`
  const costsPreview = totalBudget === 0
    ? 'Add a cost to track'
    : `${paidPct}% paid · ${fmtMoney(paidSoFar, trip.homeCurrency)}`
  const weatherPreview = `${tripDays}-day forecast`
  const localPreview = trip.localInfoJson
    ? 'Tipping · plugs · phrases'
    : 'Generate local guide'
  const documentsPreview = trip._count.documents === 0
    ? 'No documents yet'
    : `${trip._count.documents} ${trip._count.documents === 1 ? 'document' : 'documents'}`
  const packingPreview = checklistTotal === 0
    ? 'Build your packing list'
    : `${checklistDone} / ${checklistTotal} done`
  const inboxPreview = unreadEmails === 0
    ? 'Send confirmations here'
    : `${unreadEmails} new to process`
  const settingsPreview = memberCount === 1
    ? 'Just you · edit trip'
    : `${memberCount} members · sharing`

  return (
    <>
      {/* Hero — full-bleed gradient strip. With the sidebar removed, this
          spans the whole viewport width edge-to-edge. */}
      <div className="relative overflow-hidden" style={{ background: theme.heroGradient }}>
        {theme.heroPattern === 'asanoha' && <div className="pattern-asanoha absolute inset-0 opacity-30" />}
        <div className="relative px-6 sm:px-10 pt-8 sm:pt-14 pb-12 sm:pb-20">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <span className="text-sakura text-[10px] sm:text-xs uppercase tracking-[0.25em]">
              {theme.motif && <span className="mr-2">{theme.motif}</span>}
              {theme.scriptLine ?? trip.destination}
            </span>
            <span className="w-8 h-px bg-sakura/50" />
          </div>
          <h1 className="h-display text-paper-pure text-5xl sm:text-7xl md:text-8xl max-w-4xl">
            {trip.name}.
          </h1>
          {trip.tagline && (
            <p className="font-display italic text-sakura-soft text-base sm:text-xl mt-4 sm:mt-6 max-w-xl">{trip.tagline}</p>
          )}
          <div className="mt-8 sm:mt-10 grid grid-cols-2 sm:flex sm:flex-wrap gap-6 sm:gap-8 text-paper-pure">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-paper-pure/60">Departing</div>
              <div className="font-display text-xl sm:text-2xl mt-1">{fmtDate(trip.startDate, 'MMM d, yyyy')}</div>
              <div className="text-xs text-paper-pure/70 mt-0.5">From {trip.departureCity ?? '—'}</div>
            </div>
            <div className="sm:border-l sm:border-paper-pure/20 sm:pl-8">
              <div className="text-[10px] uppercase tracking-[0.2em] text-paper-pure/60">Returning</div>
              <div className="font-display text-xl sm:text-2xl mt-1">{fmtDate(trip.endDate, 'MMM d, yyyy')}</div>
              <div className="text-xs text-paper-pure/70 mt-0.5 truncate max-w-[180px]">{trip.travelerNames}</div>
            </div>
            <div className="sm:border-l sm:border-paper-pure/20 sm:pl-8">
              <div className="text-[10px] uppercase tracking-[0.2em] text-paper-pure/60">Countdown</div>
              <div className="font-display text-xl sm:text-2xl mt-1 num-mono">
                <CountdownClient to={trip.startDate.toISOString()} /> days
              </div>
              <div className="text-xs text-paper-pure/70 mt-0.5">{paidPct}% paid</div>
            </div>
          </div>
        </div>
      </div>

      {/* App-launcher tiles — the entire navigation surface for this trip. */}
      <TripFeatureTiles
        tripSlug={trip.slug}
        itineraryPreview={itineraryPreview}
        costsPreview={costsPreview}
        weatherPreview={weatherPreview}
        localPreview={localPreview}
        documentsPreview={documentsPreview}
        packingPreview={packingPreview}
        inboxPreview={inboxPreview}
        settingsPreview={settingsPreview}
      />
    </>
  )
}
