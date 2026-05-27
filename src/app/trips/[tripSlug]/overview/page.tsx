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
import { TripCountdownDisplay } from '@/components/TripCountdownDisplay'
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
  const packingPct = checklistTotal === 0
    ? 0
    : Math.round((checklistDone / checklistTotal) * 100)
  const inboxPreview = unreadEmails === 0
    ? 'Send confirmations here'
    : `${unreadEmails} new to process`
  const settingsPreview = memberCount === 1
    ? 'Just you · edit trip'
    : `${memberCount} members · sharing`

  return (
    <>
      {/* Hero — full-bleed gradient strip. The countdown numeral is the
          visual king on this page; the trip's identity (name, dates,
          departure city) collapses into a smaller right-hand column so
          the eye lands on the number first. */}
      <div className="relative overflow-hidden" style={{ background: theme.heroGradient }}>
        {theme.heroPattern === 'asanoha' && <div className="pattern-asanoha absolute inset-0 opacity-30" />}
        <div className="relative px-6 sm:px-10 pt-10 sm:pt-14 pb-12 sm:pb-16">
          {/* Scriptline header — kept from the previous hero */}
          <div className="flex items-center gap-3 mb-10 sm:mb-14">
            <span className="text-sakura text-[10px] sm:text-xs uppercase tracking-[0.25em]">
              {theme.motif && <span className="mr-2">{theme.motif}</span>}
              {theme.scriptLine ?? trip.destination}
            </span>
            <span className="w-8 h-px bg-sakura/50" />
          </div>

          {/* Countdown (left, huge) + trip identity (right, secondary). On
              mobile they stack — countdown on top so it still dominates. */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-8 sm:gap-12 lg:gap-16 items-end">
            <TripCountdownDisplay
              startISO={trip.startDate.toISOString()}
              endISO={trip.endDate.toISOString()}
            />

            <div className="text-paper-pure pb-1 sm:pb-6 min-w-0">
              <h1 className="h-display text-3xl sm:text-5xl lg:text-6xl leading-[1.05] break-words">
                {trip.name}.
              </h1>
              {trip.tagline && (
                <p className="font-display italic text-sakura-soft text-base sm:text-lg mt-3 max-w-lg">
                  {trip.tagline}
                </p>
              )}
              <div className="mt-5 sm:mt-7 text-paper-pure/75 text-xs sm:text-sm space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-paper-pure/55">
                    Departing
                  </span>
                  <span className="num-mono">{fmtDate(trip.startDate, 'd MMM yyyy')}</span>
                  {trip.departureCity && (
                    <>
                      <span className="text-paper-pure/35">·</span>
                      <span>From {trip.departureCity}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-paper-pure/55">
                    Returning
                  </span>
                  <span className="num-mono">{fmtDate(trip.endDate, 'd MMM yyyy')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* App-launcher tiles — the entire navigation surface for this trip. */}
      <TripFeatureTiles
        tripSlug={trip.slug}
        itineraryPreview={itineraryPreview}
        costsPreview={costsPreview}
        costsPct={paidPct}
        weatherPreview={weatherPreview}
        localPreview={localPreview}
        documentsPreview={documentsPreview}
        packingPreview={packingPreview}
        packingPct={packingPct}
        inboxPreview={inboxPreview}
        settingsPreview={settingsPreview}
      />
    </>
  )
}
