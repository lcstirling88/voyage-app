import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Sparkles, TrendingDown, AlertCircle, ZapIcon, Check, Clock } from 'lucide-react'
import { prisma } from '@/lib/db'
import { fmtDate, fmtMoney, safeJson } from '@/lib/format'
import { getTheme } from '@/lib/theme'
import { CountdownClient } from '@/components/CountdownClient'

export default async function OverviewPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: {
      cities: { orderBy: { displayOrder: 'asc' } },
      bookings: { orderBy: { startAt: 'asc' } },
      payments: { orderBy: { dueDate: 'asc' } },
      _count: { select: { bookings: true, documents: true } },
    },
  })
  if (!trip) notFound()

  const theme = getTheme(trip.themeKey)
  const totalBudget = trip.bookings.reduce((sum, b) => sum + (b.cost ?? 0), 0)
  const paidSoFar = trip.bookings.filter((b) => b.paid).reduce((s, b) => s + (b.cost ?? 0), 0)
  const paidPct = totalBudget ? Math.round((paidSoFar / totalBudget) * 100) : 0
  const nextPayment = trip.payments.find((p) => !p.paid)
  const hotelCount = trip.bookings.filter((b) => b.type === 'hotel').length
  const activityCount = trip.bookings.filter((b) => b.type === 'activity').length
  const mealCount = trip.bookings.filter((b) => b.type === 'restaurant').length

  // "Up next" - next 3 bookings starting from now
  const now = new Date()
  const upcoming = [...trip.bookings.filter((b) => b.startAt > now)].slice(0, 3)

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: theme.heroGradient }}>
        {theme.heroPattern === 'asanoha' && <div className="pattern-asanoha absolute inset-0 opacity-30" />}
        <div className="relative px-10 pt-14 pb-20 max-w-6xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sakura text-xs uppercase tracking-[0.25em]">
              {theme.motif && <span className="mr-2">{theme.motif}</span>}
              {theme.scriptLine ?? trip.destination}
            </span>
            <span className="w-8 h-px bg-sakura/50" />
            <span className="text-paper-pure/70 text-xs uppercase tracking-[0.2em]">Trip 01</span>
          </div>
          <h1 className="h-display text-paper-pure text-7xl md:text-8xl max-w-3xl whitespace-pre-line">
            {trip.name.replace(' & ', ' &\n')}.
          </h1>
          {trip.tagline && (
            <p className="font-display italic text-sakura-soft text-xl mt-6 max-w-xl">{trip.tagline}</p>
          )}
          <div className="mt-10 flex flex-wrap gap-8 text-paper-pure">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-paper-pure/60">Departing</div>
              <div className="font-display text-2xl mt-1">{fmtDate(trip.startDate, 'MMM d, yyyy')}</div>
              <div className="text-xs text-paper-pure/70 mt-0.5">From {trip.departureCity ?? '—'}</div>
            </div>
            <div className="border-l border-paper-pure/20 pl-8">
              <div className="text-[10px] uppercase tracking-[0.2em] text-paper-pure/60">Returning</div>
              <div className="font-display text-2xl mt-1">{fmtDate(trip.endDate, 'MMM d, yyyy')}</div>
              <div className="text-xs text-paper-pure/70 mt-0.5">{trip.travelerNames}</div>
            </div>
            <div className="border-l border-paper-pure/20 pl-8">
              <div className="text-[10px] uppercase tracking-[0.2em] text-paper-pure/60">Countdown</div>
              <div className="font-display text-2xl mt-1 num-mono">
                <CountdownClient to={trip.startDate.toISOString()} /> days
              </div>
              <div className="text-xs text-paper-pure/70 mt-0.5">{paidPct}% paid</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 border-b border-line bg-paper-pure">
        <div className="px-8 py-6 border-r border-line">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Total budget</div>
          <div className="font-display text-3xl mt-1">
            {fmtMoney(totalBudget, trip.homeCurrency)} <span className="text-sm text-ink-muted num-mono">{trip.homeCurrency}</span>
          </div>
          <div className="text-xs text-sage mt-1 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> tracking on budget
          </div>
        </div>
        <div className="px-8 py-6 border-r border-line">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Paid so far</div>
          <div className="font-display text-3xl mt-1">{fmtMoney(paidSoFar, trip.homeCurrency)}</div>
          <div className="text-xs text-ink-muted mt-1">{paidPct}% · {trip.bookings.filter((b) => b.paid).length} transactions</div>
        </div>
        <div className="px-8 py-6 border-r border-line">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Next payment</div>
          <div className="font-display text-3xl mt-1">
            {nextPayment ? fmtMoney(nextPayment.amount, nextPayment.currency) : '—'}
          </div>
          <div className="text-xs text-rust mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {nextPayment ? `${nextPayment.description} · ${fmtDate(nextPayment.dueDate)}` : 'No payments due'}
          </div>
        </div>
        <div className="px-8 py-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Bookings</div>
          <div className="font-display text-3xl mt-1">{trip._count.bookings}</div>
          <div className="text-xs text-ink-muted mt-1">{hotelCount} hotels · {activityCount} activities · {mealCount} meals</div>
        </div>
      </div>

      {/* Up next + Cities */}
      <div className="px-10 py-12 grid grid-cols-3 gap-10 max-w-7xl">
        <div className="col-span-2">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-display text-3xl">Up next</h2>
            <Link href={`/trips/${trip.slug}/itinerary`} className="text-xs text-ink-muted ulink">
              View full itinerary →
            </Link>
          </div>

          {upcoming.length === 0 && (
            <article className="border-2 border-dashed border-line rounded-xl bg-paper/40 p-8 mb-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-sage mb-2">Empty trip — let&apos;s fix that</div>
              <h3 className="font-display text-2xl">Forward your first booking.</h3>
              <p className="text-sm text-ink-muted mt-2 max-w-md">
                Send any flight confirmation, hotel booking, or restaurant reservation to this trip&apos;s unique address. The parser will read it and slot it into your itinerary.
              </p>
              <Link href={`/trips/${trip.slug}/inbox`} className="mt-4 inline-flex items-center gap-2 btn-ink">
                Open inbox →
              </Link>
            </article>
          )}

          {upcoming.map((b) => {
            const meta = safeJson<Record<string, string>>(b.metadata)
            const imgClass =
              b.type === 'hotel' ? 'img-tokyo-hotel'
              : b.type === 'activity' ? 'img-activity'
              : b.type === 'restaurant' ? 'img-restaurant'
              : b.type === 'flight' ? 'img-flight'
              : 'img-transit'
            return (
              <article key={b.id} className="border border-line rounded-xl bg-paper-pure overflow-hidden hover:shadow-soft transition mb-4">
                <div className="flex">
                  <div className={`w-32 ${imgClass} shrink-0`} />
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                          {fmtDate(b.startAt, 'MMM d')} · {b.type}
                        </div>
                        <h3 className="font-display text-xl mt-1">{b.title}</h3>
                        <p className="text-sm text-ink-muted mt-1">
                          {b.location ?? b.vendor ?? ''}
                          {b.confirmationCode && <span className="num-mono ml-2">{b.confirmationCode}</span>}
                          {meta?.checkIn && <span className="ml-2">Check-in {meta.checkIn}</span>}
                        </p>
                      </div>
                      {b.paid ? (
                        <span className="pill pill-paid"><Check className="w-3 h-3" /> Paid</span>
                      ) : (
                        <span className="pill pill-upcoming"><Clock className="w-3 h-3" /> Pending</span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl mb-4">Cities</h2>
            <div className="space-y-3">
              {trip.cities.length === 0 ? (
                <div className="border border-dashed border-line rounded-lg p-4 bg-paper/40 text-xs text-ink-muted italic">
                  No cities yet. They&apos;ll be added automatically as bookings come in.
                </div>
              ) : trip.cities.map((c, i) => (
                <div key={c.id} className="border border-line rounded-lg p-4 bg-paper-pure">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-display text-lg">{c.name}{trip.cities.filter((x) => x.name === c.name).length > 1 ? ` (#${i + 1})` : ''}</div>
                      <div className="text-xs text-ink-muted">{fmtDate(c.arriveOn)} – {fmtDate(c.leaveOn)}</div>
                    </div>
                    {c.lat != null && (
                      <div className="text-right num-mono text-xs text-ink-muted">
                        {c.lat.toFixed(2)}°N<br />{c.lng?.toFixed(2)}°E
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            href={`/trips/${trip.slug}/assistant`}
            className="block border border-line rounded-xl bg-sage text-paper-pure p-5 relative overflow-hidden hover:shadow-lift transition"
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-sakura/20" />
            <Sparkles className="w-5 h-5 text-sakura mb-3" />
            <h3 className="font-display text-xl">Ask Voyage</h3>
            <p className="text-sm text-paper-pure/80 mt-1">I spotted gaps in your itinerary. Let me suggest restaurants for the empty Kyoto evening.</p>
            <span className="mt-4 inline-block px-3 py-1.5 text-xs rounded-md bg-paper-pure text-ink">Open assistant</span>
          </Link>
        </div>
      </div>
    </>
  )
}
