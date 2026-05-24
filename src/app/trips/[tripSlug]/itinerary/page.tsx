import { notFound } from 'next/navigation'
import { Check, Clock, PlusCircle, Utensils, PlaneLanding } from 'lucide-react'
import { prisma } from '@/lib/db'
import { fmtDate, fmtTime, safeJson, fmtMoneyFull } from '@/lib/format'
import { format, startOfDay, eachDayOfInterval } from 'date-fns'
import { InlineDeleteButton } from '@/components/InlineDeleteButton'

function imgForBooking(type: string, title: string) {
  if (type === 'hotel') {
    if (title.toLowerCase().includes('hoshinoya') || title.toLowerCase().includes('ryokan')) return 'img-kyoto-ryokan'
    if (title.toLowerCase().includes('hakone') || title.toLowerCase().includes('gora')) return 'img-hakone'
    if (title.toLowerCase().includes('niwa') || title.toLowerCase().includes('ginza')) return 'img-ginza'
    return 'img-tokyo-hotel'
  }
  if (type === 'restaurant') return 'img-restaurant'
  if (type === 'flight') return 'img-flight'
  if (type === 'transit') return 'img-transit'
  // activities — pick by keywords
  const t = title.toLowerCase()
  if (t.includes('tsukiji')) return 'img-tsukiji'
  if (t.includes('teamlab')) return 'img-teamlab'
  if (t.includes('shibuya')) return 'img-shibuya'
  if (t.includes('meiji')) return 'img-meiji'
  if (t.includes('fushimi')) return 'img-fushimi'
  if (t.includes('arashiyama') || t.includes('bamboo')) return 'img-arashiyama'
  if (t.includes('nara')) return 'img-nara'
  return 'img-activity'
}

export default async function ItineraryPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { bookings: { orderBy: { startAt: 'asc' } } },
  })
  if (!trip) notFound()

  // Group bookings by day
  const days = eachDayOfInterval({ start: startOfDay(trip.startDate), end: startOfDay(trip.endDate) })
  const dayMap = new Map<string, typeof trip.bookings>()
  for (const d of days) dayMap.set(format(d, 'yyyy-MM-dd'), [])
  for (const b of trip.bookings) {
    const key = format(startOfDay(b.startAt), 'yyyy-MM-dd')
    if (!dayMap.has(key)) dayMap.set(key, [])
    dayMap.get(key)!.push(b)
  }

  return (
    <>
      <div className="hero-light border-b border-line px-10 py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">The plan</div>
        <h1 className="h-display text-6xl mt-2">Day by day</h1>
        <p className="text-ink-muted mt-3 max-w-xl">
          Ten days, four cities, sleep-walk through bamboo groves. Each item shows its booking ref, voucher and notes.
        </p>
      </div>

      <div className="px-10 py-10 max-w-5xl space-y-12">
        {days.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd')
          const todays = dayMap.get(key) ?? []
          const hotelToday = todays.find((b) => b.type === 'hotel')
          const otherBookings = todays.filter((b) => b.type !== 'hotel')

          return (
            <div key={key} className="tline pl-10">
              <div className="tline-dot" />
              <div className="flex items-baseline gap-4 mb-1">
                <span className="font-display text-4xl">Day {String(idx + 1).padStart(2, '0')}</span>
                <span className="text-ink-muted text-sm">{format(day, 'EEEE, MMM d')}</span>
              </div>

              {hotelToday && (() => {
                const meta = safeJson<Record<string, string>>(hotelToday.metadata)
                return (
                  <div className="border border-line rounded-xl bg-paper-pure overflow-hidden mb-4 mt-4">
                    <div className="flex">
                      <div className={`w-40 ${imgForBooking(hotelToday.type, hotelToday.title)} shrink-0 relative`}>
                        <div className="absolute bottom-2 left-2 text-paper-pure text-[10px] uppercase tracking-[0.18em] bg-ink/40 backdrop-blur px-2 py-1 rounded">Tonight</div>
                      </div>
                      <div className="p-5 flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Hotel · {meta?.nights ?? '?'} {Number(meta?.nights) === 1 ? 'night' : 'nights'}</div>
                            <h3 className="font-display text-2xl mt-1">{hotelToday.title}</h3>
                            {hotelToday.address && <p className="text-sm text-ink-muted mt-1">{hotelToday.address}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {hotelToday.paid ? (
                              <span className="pill pill-paid"><Check className="w-3 h-3" /> Paid</span>
                            ) : (
                              <span className="pill pill-upcoming"><Clock className="w-3 h-3" /> Pending</span>
                            )}
                            <InlineDeleteButton kind="booking" id={hotelToday.id} tripSlug={trip.slug} />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-4 text-xs">
                          <div><div className="text-ink-muted">Check-in</div><div className="font-medium mt-0.5">{meta?.checkIn ?? '—'}</div></div>
                          <div><div className="text-ink-muted">Check-out</div><div className="font-medium mt-0.5">{meta?.checkOut ?? '—'}</div></div>
                          <div><div className="text-ink-muted">Breakfast</div><div className="font-medium mt-0.5 text-sage">{meta?.breakfast ?? '—'}</div></div>
                          <div><div className="text-ink-muted">Confirmation</div><div className="font-medium mt-0.5 num-mono">{hotelToday.confirmationCode ?? '—'}</div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="space-y-3">
                {otherBookings.map((b) => (
                  <div key={b.id} className="border border-line rounded-lg p-4 bg-paper-pure flex items-center gap-4">
                    <div className="w-12 text-center">
                      <div className="num-mono text-xs text-ink-muted">{fmtTime(b.startAt)}</div>
                    </div>
                    <div className="w-px h-12 bg-line" />
                    <div className={`w-12 h-12 rounded-md ${imgForBooking(b.type, b.title)} shrink-0 grid place-items-center`}>
                      {b.type === 'restaurant' && <Utensils className="w-5 h-5 text-paper-pure" />}
                      {b.type === 'flight' && <PlaneLanding className="w-5 h-5 text-paper-pure" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{b.title}</div>
                      {b.notes && <div className="text-xs text-ink-muted truncate">{b.notes}</div>}
                      {b.confirmationCode && (
                        <div className="text-xs num-mono text-ink-muted mt-0.5">{b.confirmationCode}{b.cost ? ` · ${fmtMoneyFull(b.cost, b.currency ?? trip.homeCurrency)}` : ''}</div>
                      )}
                    </div>
                    {b.paid ? (
                      <span className="pill pill-paid"><Check className="w-3 h-3" /> Paid</span>
                    ) : b.paymentMethod === 'Pay at venue' ? (
                      <span className="pill pill-upcoming"><Clock className="w-3 h-3" /> At venue</span>
                    ) : b.cost ? (
                      <span className="pill pill-upcoming"><Clock className="w-3 h-3" /> Pending</span>
                    ) : null}
                    <InlineDeleteButton kind="booking" id={b.id} tripSlug={trip.slug} />
                  </div>
                ))}

                {otherBookings.length === 0 && !hotelToday && (
                  <div className="border border-dashed border-line rounded-lg p-4 bg-paper/40 flex items-center gap-4 text-ink-muted">
                    <PlusCircle className="w-5 h-5" />
                    <div className="flex-1 text-sm">Nothing planned. <a href={`/trips/${trip.slug}/assistant`} className="ulink text-sage font-medium">Ask Voyage to suggest something</a></div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
