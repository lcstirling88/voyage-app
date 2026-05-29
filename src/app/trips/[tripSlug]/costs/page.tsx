import { notFound } from 'next/navigation'
import { Check, Clock, AlertCircle, Zap } from 'lucide-react'
import { prisma } from '@/lib/db'
import { fmtDate, fmtMoney } from '@/lib/format'
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, differenceInDays } from 'date-fns'
import { InlineDeleteButton } from '@/components/InlineDeleteButton'
import { AddPaymentFormClient } from '@/components/AddPaymentFormClient'
import { computePlanBudget, bookingPartyCost, isCommittedStatus } from '@/lib/budget'
import { currencySymbol } from '@/lib/destinations'

/** Compact money for the tiny calendar cells: "$4.5k" for big sums, "$450" otherwise. */
function compactMoney(amount: number, currency: string): string {
  const sym = currencySymbol(currency)
  return amount >= 1000 ? `${sym}${(amount / 1000).toFixed(1)}k` : `${sym}${Math.round(amount)}`
}

export default async function CostsPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { bookings: true, payments: { orderBy: { dueDate: 'asc' } } },
  })
  if (!trip) notFound()

  const pax = Math.max(1, trip.adultCount + trip.childCount)
  // Committed = real bookings + kept plans. Unkept AI ideas are excluded, and
  // per-person estimate rows are scaled to party totals so the headline figure
  // isn't a mix of per-person and whole-party numbers.
  const committedBookings = trip.bookings.filter((b) => isCommittedStatus(b.status) && b.cost != null)
  const totalBudget = committedBookings.reduce((s, b) => s + bookingPartyCost(b, pax, trip.homeCurrency), 0)
  const paid = committedBookings.filter((b) => b.paid).reduce((s, b) => s + bookingPartyCost(b, pax, trip.homeCurrency), 0)
  const upcoming = totalBudget - paid
  const paidPct = totalBudget ? (paid / totalBudget) * 100 : 0
  const days = Math.max(1, differenceInDays(trip.endDate, trip.startDate) + 1)
  const perDay = totalBudget / days

  // Food estimate (daily allowance for days without a logged meal).
  const planBudget = computePlanBudget(trip.bookings, {
    homeCurrency: trip.homeCurrency,
    partySize: pax,
    tripStart: trip.startDate,
    tripEnd: trip.endDate,
  })

  // Category breakdown (committed only, party totals)
  const byCat: Record<string, number> = {}
  for (const b of committedBookings) {
    const key = b.type === 'hotel' ? 'Lodging'
      : b.type === 'flight' ? 'Flights'
      : b.type === 'restaurant' ? 'Food & dining'
      : b.type === 'activity' ? 'Activities'
      : 'Transit & misc'
    byCat[key] = (byCat[key] ?? 0) + bookingPartyCost(b, pax, trip.homeCurrency)
  }
  const catColors: Record<string, string> = {
    'Lodging': 'bg-sage',
    'Flights': 'bg-gold',
    'Food & dining': 'bg-sakura',
    'Activities': 'bg-wine',
    'Transit & misc': 'bg-sage-dark',
  }
  // Donut conic-gradient cumulative stops. With no bookings, fall back to a single neutral wedge.
  const segVars: Record<string, string> = {}
  if (totalBudget > 0) {
    let cum = 0
    for (const key of Object.keys(catColors)) {
      cum += ((byCat[key] ?? 0) / totalBudget) * 100
      segVars[`--seg${Object.keys(catColors).indexOf(key) + 1}`] = `${cum}%`
    }
  } else {
    segVars['--seg1'] = '100%'
    segVars['--seg2'] = '100%'
    segVars['--seg3'] = '100%'
    segVars['--seg4'] = '100%'
  }

  // Calendar for the month of the next payment (or trip month)
  const monthDate = trip.payments.find((p) => !p.paid)?.dueDate ?? trip.startDate
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const firstDow = getDay(monthStart) // 0=Sun
  const leadingBlanks = (firstDow + 6) % 7 // make Monday = 0

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Costs & payments</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Where the money&apos;s going.</h1>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl space-y-8 sm:space-y-12">
        {/* Summary row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="border border-line rounded-xl bg-paper-pure p-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Total trip cost</div>
            <div className="font-display text-3xl sm:text-4xl md:text-5xl mt-2">{fmtMoney(totalBudget, trip.homeCurrency)} <span className="text-sm text-ink-muted num-mono">{trip.homeCurrency}</span></div>
            <div className="h-1 bg-line-soft rounded-full mt-5 overflow-hidden">
              <div className="h-full bg-sage" style={{ width: `${paidPct}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-2">
              <span className="text-sage">{fmtMoney(paid, trip.homeCurrency)} paid</span>
              <span className="text-ink-muted">{fmtMoney(upcoming, trip.homeCurrency)} to go</span>
            </div>
          </div>
          <div className="border border-line rounded-xl bg-paper-pure p-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Cost per day</div>
            <div className="font-display text-3xl sm:text-4xl md:text-5xl mt-2">{fmtMoney(Math.round(perDay), trip.homeCurrency)}</div>
            <div className="text-xs text-ink-muted mt-2">across {Math.round(days)} days, {pax} travellers</div>
            <div className="mt-5 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-ink-muted">Per person / day</span><span className="num-mono">{fmtMoney(Math.round(perDay / pax), trip.homeCurrency)}</span></div>
            </div>
          </div>
          <div className="border border-line rounded-xl bg-paper-pure p-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Food estimate</div>
            <div className="font-display text-3xl sm:text-4xl md:text-5xl mt-2">{fmtMoney(planBudget.foodPerPersonPerDay, trip.homeCurrency)} <span className="text-sm text-ink-muted">/ person / day</span></div>
            <div className="text-xs text-ink-muted mt-2">
              {planBudget.foodEstimateDays === 0
                ? 'every day has a booked meal'
                : `${planBudget.foodEstimateDays} ${planBudget.foodEstimateDays === 1 ? 'day' : 'days'} without a booked meal`}
            </div>
            <div className="mt-5 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-ink-muted">Est. food total</span><span className="num-mono">{fmtMoney(planBudget.food, trip.homeCurrency)}</span></div>
              <div className="text-ink-muted/70 text-[11px]">Drops as you log real meals.</div>
            </div>
          </div>
        </div>

        {/* Breakdown + calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-1 border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
            <h3 className="font-display text-2xl mb-6">Where it goes</h3>
            <div className="flex flex-col items-center">
              <div className="donut" style={segVars as React.CSSProperties}>
                <div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Total</div>
                    <div className="font-display text-2xl">{fmtMoney(totalBudget, trip.homeCurrency)}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 mt-6 w-full text-xs">
                {totalBudget === 0 ? (
                  <div className="text-ink-muted text-center py-2 italic">
                    Forward a booking to see the breakdown.
                  </div>
                ) : Object.entries(byCat).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-sm ${catColors[key]}`} />
                    <span className="flex-1">{key}</span>
                    <span className="num-mono">{Math.round((val / totalBudget) * 100)}% · {fmtMoney(val, trip.homeCurrency)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="font-display text-2xl">Payment calendar</h3>
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sage" />Paid</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gold" />Auto</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rust" />Action</span>
              </div>
            </div>
            <p className="text-xs text-ink-muted mb-5">{fmtDate(monthStart, 'MMMM yyyy')}</p>
            <div className="grid grid-cols-7 gap-1 text-xs text-ink-muted mb-2">
              {['M','T','W','T','F','S','S'].map((d, i) => <div key={i} className="text-center">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} className="aspect-square rounded-md border border-line/40 bg-paper/30" />
              ))}
              {monthDays.map((d) => {
                const due = trip.payments.find((p) => isSameDay(p.dueDate, d))
                const cls = due
                  ? due.autoPay ? 'border-2 border-gold bg-gold-soft' : 'border-2 border-rust bg-sakura-soft'
                  : 'border border-line/40'
                return (
                  <div key={d.toISOString()} className={`aspect-square rounded-md p-1.5 text-xs relative ${cls}`}>
                    {d.getDate()}
                    {due && (
                      <span className={`absolute bottom-1 right-1 num-mono text-[9px] ${due.autoPay ? 'text-gold' : 'text-rust'}`}>
                        {compactMoney(due.amount, due.currency)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-6 space-y-2">
              <div className="text-xs text-ink-muted">Upcoming</div>
              {trip.payments.filter((p) => !p.paid).map((p) => (
                <div key={p.id} className="flex items-center gap-3 text-sm p-2 hover:bg-line-soft rounded">
                  <span className={`w-2 h-2 rounded-full ${p.autoPay ? 'bg-gold' : 'bg-rust'}`} />
                  <span className="flex-1">{p.description}</span>
                  <span className="text-ink-muted text-xs">{fmtDate(p.dueDate)}</span>
                  <span className="num-mono">{fmtMoney(p.amount, p.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Manual payment add */}
        <div>
          <AddPaymentFormClient tripSlug={trip.slug} homeCurrency={trip.homeCurrency} localCurrency={trip.localCurrency} />
        </div>

        {/* Transactions table */}
        <div className="border border-line rounded-xl bg-paper-pure overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-line flex items-center justify-between">
            <h3 className="font-display text-xl sm:text-2xl">All transactions</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              <tr className="border-b border-line">
                <th className="text-left px-6 py-3 font-medium">Date</th>
                <th className="text-left px-6 py-3 font-medium">Item</th>
                <th className="text-left px-6 py-3 font-medium">Category</th>
                <th className="text-right px-6 py-3 font-medium">Amount ({trip.homeCurrency})</th>
                <th className="text-right px-6 py-3 font-medium pr-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {committedBookings.length === 0 && trip.payments.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-ink-muted text-sm italic">
                  No transactions yet. Forward booking emails to your trip inbox and they&apos;ll appear here.
                </td></tr>
              )}
              {committedBookings.slice().sort((a, b) => (a.paidAt?.getTime() ?? a.startAt.getTime()) - (b.paidAt?.getTime() ?? b.startAt.getTime())).map((b) => (
                <tr key={b.id} className="hover:bg-line-soft/40">
                  <td className="px-6 py-3 num-mono text-ink-muted">{b.paidAt ? fmtDate(b.paidAt) : 'TBC'}</td>
                  <td className="px-6 py-3">{b.title}</td>
                  <td className="px-6 py-3 text-ink-muted">{b.type}</td>
                  <td className="px-6 py-3 text-right num-mono">
                    {b.status !== 'booked' && <span className="text-ink-muted/60 text-[10px] mr-1">est.</span>}
                    {fmtMoney(bookingPartyCost(b, pax), b.status === 'booked' ? (b.currency ?? trip.homeCurrency) : trip.homeCurrency)}
                  </td>
                  <td className="px-6 py-3 text-right pr-6">
                    <div className="inline-flex items-center gap-2">
                      {b.paid ? (
                        <span className="pill pill-paid"><Check className="w-3 h-3" />Paid</span>
                      ) : b.paymentMethod === 'Pay at venue' ? (
                        <span className="pill pill-upcoming"><Clock className="w-3 h-3" />At venue</span>
                      ) : (
                        <span className="pill pill-upcoming"><Clock className="w-3 h-3" />Pending</span>
                      )}
                      <InlineDeleteButton kind="booking" id={b.id} tripSlug={trip.slug} />
                    </div>
                  </td>
                </tr>
              ))}
              {trip.payments.map((p) => (
                <tr key={p.id} className={`hover:bg-line-soft/40 ${p.autoPay ? 'bg-gold-soft/20' : 'bg-sakura-soft/20'}`}>
                  <td className="px-6 py-3 num-mono text-ink-muted">{fmtDate(p.dueDate)}</td>
                  <td className="px-6 py-3 font-medium">{p.description}</td>
                  <td className="px-6 py-3 text-ink-muted">Scheduled</td>
                  <td className="px-6 py-3 text-right num-mono">{fmtMoney(p.amount, p.currency)}</td>
                  <td className="px-6 py-3 text-right pr-6">
                    <div className="inline-flex items-center gap-2">
                      {p.paid ? (
                        <span className="pill pill-paid"><Check className="w-3 h-3" />Paid</span>
                      ) : p.autoPay ? (
                        <span className="pill pill-auto"><Zap className="w-3 h-3" />Auto · {p.paymentMethod}</span>
                      ) : (
                        <span className="pill pill-overdue"><AlertCircle className="w-3 h-3" />Action needed</span>
                      )}
                      <InlineDeleteButton kind="payment" id={p.id} tripSlug={trip.slug} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  )
}
