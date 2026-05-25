import { notFound } from 'next/navigation'
import { Check, Clock, Utensils, PlaneLanding, Car, BedDouble, LogOut, MapPin, Plane, Train } from 'lucide-react'
import { format, startOfDay, eachDayOfInterval, differenceInDays, addDays } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { fmtTime, safeJson, fmtMoneyFull } from '@/lib/format'
import { InlineDeleteButton } from '@/components/InlineDeleteButton'
import { AddSessionItemClient } from '@/components/AddSessionItemClient'
import { planForDay, SESSIONS, SESSION_LABEL, type DayPlan, type Session } from '@/lib/itinerary'
import type { Booking } from '@prisma/client'

function imgForBooking(type: string, title: string) {
  if (type === 'hotel') {
    const t = title.toLowerCase()
    if (t.includes('hoshinoya') || t.includes('ryokan')) return 'img-kyoto-ryokan'
    if (t.includes('hakone') || t.includes('gora'))     return 'img-hakone'
    if (t.includes('niwa') || t.includes('ginza'))      return 'img-ginza'
    return 'img-tokyo-hotel'
  }
  if (type === 'restaurant') return 'img-restaurant'
  if (type === 'flight')     return 'img-flight'
  if (type === 'transit')    return 'img-transit'
  if (type === 'car')        return 'img-transit'
  const t = title.toLowerCase()
  if (t.includes('tsukiji'))    return 'img-tsukiji'
  if (t.includes('teamlab'))    return 'img-teamlab'
  if (t.includes('shibuya'))    return 'img-shibuya'
  if (t.includes('meiji'))      return 'img-meiji'
  if (t.includes('fushimi'))    return 'img-fushimi'
  if (t.includes('arashiyama') || t.includes('bamboo')) return 'img-arashiyama'
  if (t.includes('nara'))       return 'img-nara'
  return 'img-activity'
}

function iconForType(type: string) {
  if (type === 'restaurant') return <Utensils className="w-4 h-4 text-paper-pure" />
  if (type === 'flight')     return <Plane className="w-4 h-4 text-paper-pure" />
  if (type === 'transit')    return <Train className="w-4 h-4 text-paper-pure" />
  if (type === 'car')        return <Car className="w-4 h-4 text-paper-pure" />
  return null
}

export default async function ItineraryPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  await requireTripAccess(tripSlug)
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { bookings: { orderBy: { startAt: 'asc' } } },
  })
  if (!trip) notFound()

  const days = eachDayOfInterval({ start: startOfDay(trip.startDate), end: startOfDay(trip.endDate) })

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">The plan</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Day by day</h1>
        <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base">
          Three sessions a day. Tap an empty slot to add manually or ask the AI for ideas.
          Forward booking emails to fill more in automatically.
        </p>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-5xl space-y-10 sm:space-y-12">
        {days.map((day, idx) => {
          const plan = planForDay(day, trip.bookings)
          const dayKey = format(day, 'yyyy-MM-dd')
          return (
            <DayBlock
              key={dayKey}
              day={day}
              dayKey={dayKey}
              idx={idx}
              plan={plan}
              tripSlug={trip.slug}
              homeCurrency={trip.homeCurrency}
              currentDate={day}
            />
          )
        })}
      </div>
    </>
  )
}

// ============================================================================
// Day block — hotel context, car bar, three session blocks
// ============================================================================

function DayBlock({
  day, dayKey, idx, plan, tripSlug, homeCurrency, currentDate,
}: {
  day: Date
  dayKey: string
  idx: number
  plan: DayPlan
  tripSlug: string
  homeCurrency: string
  currentDate: Date
}) {
  return (
    <div className="tline pl-8 sm:pl-10">
      <div className="tline-dot" />
      <div className="flex flex-wrap items-baseline gap-2 sm:gap-4 mb-4">
        <span className="font-display text-3xl sm:text-4xl">Day {String(idx + 1).padStart(2, '0')}</span>
        <span className="text-ink-muted text-xs sm:text-sm">{format(day, 'EEEE, MMM d')}</span>
      </div>

      {/* Hotel bar — check-out info first (morning event), then sleeping-tonight */}
      {plan.checkingOutToday && (
        <HotelCheckoutRow booking={plan.checkingOutToday} tripSlug={tripSlug} />
      )}
      {plan.sleepingTonight && (
        <HotelStayRow booking={plan.sleepingTonight} tripSlug={tripSlug} day={day} />
      )}

      {/* Car pickup/return */}
      {plan.carPickup && <CarRow booking={plan.carPickup} kind="pickup" tripSlug={tripSlug} homeCurrency={homeCurrency} />}
      {plan.carReturn && <CarRow booking={plan.carReturn} kind="return" tripSlug={tripSlug} homeCurrency={homeCurrency} />}

      {/* Three session blocks */}
      <div className="mt-4 space-y-5">
        {SESSIONS.map((session) => (
          <SessionBlock
            key={session}
            session={session}
            items={plan.sessions[session]}
            tripSlug={tripSlug}
            dayKey={dayKey}
            homeCurrency={homeCurrency}
            currentDate={currentDate}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Hotel rows
// ============================================================================

function HotelCheckinFull({ booking, tripSlug }: { booking: Booking; tripSlug: string }) {
  const meta = safeJson<Record<string, string>>(booking.metadata) ?? {}
  return (
    <div className="border border-line rounded-xl bg-paper-pure overflow-hidden mb-3">
      <div className="flex flex-col sm:flex-row">
        <div className={`h-24 sm:h-auto sm:w-40 ${imgForBooking(booking.type, booking.title)} shrink-0 relative`}>
          <div className="absolute bottom-2 left-2 text-paper-pure text-[10px] uppercase tracking-[0.18em] bg-ink/40 backdrop-blur px-2 py-1 rounded">Check in</div>
        </div>
        <div className="p-4 sm:p-5 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                Hotel · {meta.nights ?? '?'} {Number(meta.nights) === 1 ? 'night' : 'nights'}
              </div>
              <h3 className="font-display text-xl sm:text-2xl mt-1">{booking.title}</h3>
              {booking.address && <p className="text-xs sm:text-sm text-ink-muted mt-1">{booking.address}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {booking.paid ? (
                <span className="pill pill-paid"><Check className="w-3 h-3" /> Paid</span>
              ) : (
                <span className="pill pill-upcoming"><Clock className="w-3 h-3" /> Pending</span>
              )}
              <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4 text-xs">
            <div><div className="text-ink-muted">Check-in</div><div className="font-medium mt-0.5">{meta.checkIn ?? '—'}</div></div>
            <div><div className="text-ink-muted">Check-out</div><div className="font-medium mt-0.5">{meta.checkOut ?? '—'}</div></div>
            <div><div className="text-ink-muted">Breakfast</div><div className="font-medium mt-0.5 text-sage truncate">{meta.breakfast ?? '—'}</div></div>
            <div><div className="text-ink-muted">Confirmation</div><div className="font-medium mt-0.5 num-mono truncate">{booking.confirmationCode ?? '—'}</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HotelStayRow({ booking, tripSlug, day }: { booking: Booking; tripSlug: string; day: Date }) {
  // First night = check-in day → full card; later nights → compact
  const isFirstNight = startOfDay(booking.startAt).getTime() === startOfDay(day).getTime()
  if (isFirstNight) return <HotelCheckinFull booking={booking} tripSlug={tripSlug} />

  const totalNights = booking.endAt
    ? differenceInDays(startOfDay(booking.endAt), startOfDay(booking.startAt))
    : 1
  const nightNumber = differenceInDays(startOfDay(day), startOfDay(booking.startAt)) + 1

  return (
    <div className="border border-line rounded-lg bg-paper-pure px-4 py-2.5 mb-2 flex items-center gap-3 text-sm">
      <BedDouble className="w-4 h-4 text-ink-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-ink-muted">Staying at</span>{' '}
        <span className="font-medium">{booking.title}</span>
        {totalNights > 1 && (
          <span className="text-ink-muted text-xs ml-2 num-mono">(night {nightNumber} of {totalNights})</span>
        )}
      </div>
    </div>
  )
}

function HotelCheckoutRow({ booking, tripSlug }: { booking: Booking; tripSlug: string }) {
  const meta = safeJson<Record<string, string>>(booking.metadata) ?? {}
  return (
    <div className="border border-line rounded-lg bg-paper-pure px-4 py-2.5 mb-2 flex items-center gap-3 text-sm">
      <LogOut className="w-4 h-4 text-rust shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-ink-muted">Check out</span>{' '}
        {meta.checkOut && <span className="num-mono">{meta.checkOut}</span>}{' '}
        <span className="text-ink-muted">from</span>{' '}
        <span className="font-medium">{booking.title}</span>
      </div>
      <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
    </div>
  )
}

// ============================================================================
// Car rental row
// ============================================================================

function CarRow({
  booking, kind, tripSlug, homeCurrency,
}: {
  booking: Booking
  kind: 'pickup' | 'return'
  tripSlug: string
  homeCurrency: string
}) {
  const meta = safeJson<Record<string, string>>(booking.metadata) ?? {}
  const verb = kind === 'pickup' ? 'Pick up' : 'Return'
  const time = kind === 'pickup' ? booking.startAt : (booking.endAt ?? booking.startAt)
  return (
    <div className="border border-line rounded-lg bg-paper-pure px-4 py-3 mb-2 flex items-start sm:items-center gap-3 text-sm">
      <Car className="w-4 h-4 text-ink-muted shrink-0 mt-0.5 sm:mt-0" />
      <div className="flex-1 min-w-0">
        <div>
          <span className="text-ink-muted">{verb} rental car</span>{' '}
          <span className="num-mono text-xs">{fmtTime(time)}</span>{' '}
          <span className="text-ink-muted">·</span>{' '}
          <span className="font-medium">{booking.title}</span>
        </div>
        {booking.location && <div className="text-xs text-ink-muted mt-0.5">{booking.location}</div>}
        {meta.confirmationCode && <div className="text-xs text-ink-muted num-mono mt-0.5">{meta.confirmationCode}</div>}
      </div>
      <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
    </div>
  )
}

// ============================================================================
// Session block (morning/afternoon/night)
// ============================================================================

function SessionBlock({
  session, items, tripSlug, dayKey, homeCurrency, currentDate,
}: {
  session: Session
  items: Array<{ booking: Booking; position: ReturnType<typeof planForDay>['sessions']['morning'][number]['position'] }>
  tripSlug: string
  dayKey: string
  homeCurrency: string
  currentDate: Date
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] uppercase tracking-[0.22em] text-ink-muted font-medium">
          {SESSION_LABEL[session]}
        </span>
        <span className="flex-1 h-px bg-line-soft" />
      </div>

      {items.length === 0 ? (
        <AddSessionItemClient tripSlug={tripSlug} day={dayKey} session={session} />
      ) : (
        <div className="space-y-2">
          {items.map(({ booking, position }) => (
            <BookingRow key={booking.id} booking={booking} position={position} tripSlug={tripSlug} homeCurrency={homeCurrency} currentDate={currentDate} />
          ))}
          {/* Allow adding more even when session has items */}
          <AddSessionItemClient tripSlug={tripSlug} day={dayKey} session={session} />
        </div>
      )}
    </div>
  )
}

function BookingRow({
  booking, position, tripSlug, homeCurrency, currentDate,
}: {
  booking: Booking
  position: 'before' | 'first' | 'middle' | 'last' | 'single' | 'after'
  tripSlug: string
  homeCurrency: string
  currentDate: Date
}) {
  const icon = iconForType(booking.type)
  // For multi-day activities, show "Day N of M"
  let spanLabel: string | null = null
  if (booking.endAt && position !== 'single') {
    const total = differenceInDays(startOfDay(booking.endAt), startOfDay(booking.startAt)) + 1
    if (total > 1) {
      const dayNum = differenceInDays(startOfDay(currentDate), startOfDay(booking.startAt)) + 1
      spanLabel = `Day ${dayNum} of ${total}`
    }
  }

  return (
    <div className="border border-line rounded-lg p-3 sm:p-4 bg-paper-pure flex items-center gap-3 sm:gap-4">
      <div className="w-10 sm:w-12 text-center shrink-0">
        <div className="num-mono text-xs text-ink-muted">{fmtTime(booking.startAt)}</div>
      </div>
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-md ${imgForBooking(booking.type, booking.title)} shrink-0 grid place-items-center`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-sm sm:text-base">{booking.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {booking.notes && <div className="text-xs text-ink-muted truncate">{booking.notes}</div>}
          {spanLabel && <span className="pill pill-info text-[9px]">{spanLabel}</span>}
        </div>
        {booking.confirmationCode && (
          <div className="text-xs num-mono text-ink-muted mt-0.5 truncate">
            {booking.confirmationCode}
            {booking.cost ? ` · ${fmtMoneyFull(booking.cost, booking.currency ?? homeCurrency)}` : ''}
          </div>
        )}
      </div>
      {booking.paid ? (
        <span className="pill pill-paid shrink-0"><Check className="w-3 h-3" /> Paid</span>
      ) : booking.paymentMethod === 'Pay at venue' ? (
        <span className="pill pill-upcoming shrink-0"><Clock className="w-3 h-3" /> At venue</span>
      ) : booking.cost ? (
        <span className="pill pill-upcoming shrink-0"><Clock className="w-3 h-3" /> Pending</span>
      ) : null}
      <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
    </div>
  )
}
