import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Wallet, ArrowRight } from 'lucide-react'
import { prisma } from '@/lib/db'
import { fmtDate, fmtMoney, fmtTime, fmtDateInput, safeJson } from '@/lib/format'
import { isCommittedStatus } from '@/lib/budget'
import { currencySymbol } from '@/lib/destinations'
import { CancellationCalendarClient, type CancelEvent } from '@/components/CancellationCalendarClient'
import { CancellationTermsEditor } from '@/components/CancellationTermsEditor'

/** Compact money for the tiny calendar cells: "$4.5k" for big sums, "$450" otherwise. */
function compactMoney(amount: number, currency: string): string {
  const sym = currencySymbol(currency)
  return amount >= 1000 ? `${sym}${(amount / 1000).toFixed(1)}k` : `${sym}${Math.round(amount)}`
}

type CancelState = 'open' | 'soon' | 'closed' | 'none'

export default async function CancellationsPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { bookings: true },
  })
  if (!trip) notFound()

  // ---- State model ----------------------------------------------------------
  // Each committed booking has a free-cancel deadline (cancelByAt) and a refund
  // position. State is derived from the deadline relative to now:
  //   open   — window comfortably open (> 7 days out)
  //   soon   — shuts within a week (decide now if you're cancelling)
  //   closed — the free-cancel deadline has passed
  //   none   — no deadline recorded yet (terms not set)
  const isoDay = (d: Date) => d.toISOString().slice(0, 10)
  const now = new Date()
  const todayISO = isoDay(now)
  const [ty, tm] = todayISO.split('-').map(Number)
  const SOON_MS = 7 * 86400000

  const stateFor = (cancelByAt: Date | null): CancelState => {
    if (!cancelByAt) return 'none'
    const diff = cancelByAt.getTime() - now.getTime()
    if (diff < 0) return 'closed'
    return diff <= SOON_MS ? 'soon' : 'open'
  }

  // Terms apply to real, committed bookings — not loose notes or unaccepted AI
  // ideas. Soonest deadline first; rows with no deadline yet trail at the end.
  const relevant = trip.bookings
    .filter((b) => b.type !== 'note' && isCommittedStatus(b.status))
    .sort((a, b) => {
      const at = a.cancelByAt?.getTime() ?? Number.POSITIVE_INFINITY
      const bt = b.cancelByAt?.getTime() ?? Number.POSITIVE_INFINITY
      if (at !== bt) return at - bt
      return a.startAt.getTime() - b.startAt.getTime()
    })

  type Terms = {
    b: (typeof relevant)[number]
    state: CancelState
    nonRefundable: boolean
    refundAmount: number | null
    refundCurrency: string
    policy: string
    refundLabel: string
    deadlineLabel: string | null
  }
  const terms: Terms[] = relevant.map((b) => {
    const meta = safeJson<Record<string, unknown>>(b.metadata) ?? {}
    const refundAmount = typeof meta.refundAmount === 'number' ? meta.refundAmount : null
    // Non-refundable if explicitly flagged, or the policy text says so and no
    // partial-refund figure has been entered to override it.
    const policyNonRefundable = !!b.cancellationPolicy && /non[- ]?refundable/i.test(b.cancellationPolicy)
    const nonRefundable = meta.nonRefundable === true || (policyNonRefundable && refundAmount == null)
    const refundCurrency = typeof meta.refundCurrency === 'string' && meta.refundCurrency
      ? meta.refundCurrency
      : (b.currency ?? trip.homeCurrency)
    const state = stateFor(b.cancelByAt)
    const refundLabel = nonRefundable
      ? 'Non-refundable'
      : refundAmount != null
        ? `${fmtMoney(refundAmount, refundCurrency)} back`
        : b.cancelByAt
          ? 'Full refund'
          : 'Terms not set'
    const deadlineLabel = b.cancelByAt
      ? `${fmtDate(b.cancelByAt, 'd MMM yyyy')} · ${fmtTime(b.cancelByAt)}`
      : null
    return {
      b, state, nonRefundable, refundAmount, refundCurrency,
      policy: b.cancellationPolicy ?? '', refundLabel, deadlineLabel,
    }
  })

  // Calendar plots only bookings that actually have a deadline to land on.
  const calEvents: CancelEvent[] = terms
    .filter((t) => t.b.cancelByAt)
    .map((t) => {
      const cb = t.b.cancelByAt as Date
      const compactRefund = t.nonRefundable
        ? '—'
        : t.refundAmount != null
          ? compactMoney(t.refundAmount, t.refundCurrency)
          : 'Free'
      return {
        id: t.b.id,
        label: t.b.title,
        dateISO: isoDay(cb),
        dateLabel: fmtDate(cb, 'd MMM'),
        state: t.state as 'open' | 'soon' | 'closed',
        refundLabel: t.refundLabel,
        compactRefund,
        detail: t.policy || (t.nonRefundable ? 'Non-refundable' : 'Free cancellation until this date'),
      }
    })

  const contextLabelFor = (b: (typeof relevant)[number]): string => {
    const verb = b.type === 'hotel' ? 'Check-in'
      : b.type === 'flight' ? 'Departs'
      : b.type === 'car' ? 'Pickup'
      : b.type === 'restaurant' ? 'Booked for'
      : 'Starts'
    return `${verb} ${fmtDate(b.startAt, 'd MMM')}`
  }

  const openCount = terms.filter((t) => t.state === 'open' || t.state === 'soon').length
  const soonCount = terms.filter((t) => t.state === 'soon').length
  const nonRefundableCount = terms.filter((t) => t.nonRefundable).length
  const noTermsCount = terms.filter((t) => t.state === 'none').length

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Cancellations &amp; refunds</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Know your exits.</h1>
        <p className="text-sm text-ink-muted mt-3 max-w-2xl">
          The last day you can cancel each booking for free, pulled from your confirmation emails.
          Amend anything that&apos;s wrong — or add terms we couldn&apos;t find — on the list below.
        </p>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl space-y-8 sm:space-y-12">
        {terms.length === 0 ? (
          <div className="border border-line rounded-xl bg-paper-pure p-10 text-center">
            <p className="text-ink-muted text-sm italic">
              No bookings yet. Forward your booking confirmations to the trip inbox and their
              cancellation terms will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            {/* Summary + calendar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="lg:col-span-1 border border-line rounded-xl bg-paper-pure p-5 sm:p-6 flex flex-col">
                <h3 className="font-display text-2xl mb-6">Refund status</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-sage shrink-0" />
                    <span className="flex-1">Free-cancel windows open</span>
                    <span className="num-mono">{openCount}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-gold shrink-0" />
                    <span className="flex-1">Closing within 7 days</span>
                    <span className="num-mono">{soonCount}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-rust shrink-0" />
                    <span className="flex-1">Non-refundable</span>
                    <span className="num-mono">{nonRefundableCount}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-ink-muted/30 shrink-0" />
                    <span className="flex-1">Terms not set yet</span>
                    <span className="num-mono">{noTermsCount}</span>
                  </div>
                </div>

                {soonCount > 0 && (
                  <div className="mt-6 rounded-lg bg-gold-soft border border-gold/40 p-3 text-xs text-ink">
                    {soonCount === 1 ? 'A free-cancellation deadline is' : `${soonCount} free-cancellation deadlines are`} within the next week. Decide before {soonCount === 1 ? 'it closes' : 'they close'}.
                  </div>
                )}

                <Link
                  href={`/trips/${trip.slug}/costs`}
                  className="mt-auto pt-6 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition"
                >
                  <Wallet className="w-3.5 h-3.5" /> See the payment calendar
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="lg:col-span-2 border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
                <CancellationCalendarClient
                  events={calEvents}
                  todayISO={todayISO}
                  initialYear={ty}
                  initialMonth={tm - 1}
                />
              </div>
            </div>

            {/* All terms — editable */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-3">
                <h3 className="font-display text-xl sm:text-2xl">All cancellation terms</h3>
                <span className="text-[11px] text-ink-muted text-right">Read from your emails · amend or add your own</span>
              </div>
              <div className="space-y-2">
                {terms.map((t) => (
                  <CancellationTermsEditor
                    key={t.b.id}
                    bookingId={t.b.id}
                    tripSlug={trip.slug}
                    title={t.b.title}
                    bookingType={t.b.type}
                    contextLabel={contextLabelFor(t.b)}
                    homeCurrency={trip.homeCurrency}
                    state={t.state}
                    deadlineLabel={t.deadlineLabel}
                    refundLabel={t.refundLabel}
                    cancelDateValue={t.b.cancelByAt ? fmtDateInput(t.b.cancelByAt) : ''}
                    cancelTimeValue={t.b.cancelByAt ? fmtTime(t.b.cancelByAt) : ''}
                    policyValue={t.policy}
                    refundAmountValue={t.refundAmount != null ? String(t.refundAmount) : ''}
                    refundCurrencyValue={t.refundCurrency}
                    nonRefundableValue={t.nonRefundable}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
