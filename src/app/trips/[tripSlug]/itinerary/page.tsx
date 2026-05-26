import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, Clock, Utensils, Plane, Train, Car, BedDouble, LogOut, Plus, AlertTriangle } from 'lucide-react'
import { format, startOfDay, eachDayOfInterval, differenceInDays } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { fmtTime, safeJson, fmtMoneyFull } from '@/lib/format'
import { InlineDeleteButton } from '@/components/InlineDeleteButton'
import {
  planForDay, SESSIONS, SESSION_LABEL, formatTime,
  hotelOrderForTrip, sleepingTonightFor, getPalette, colorForHotel,
  cleanHotelName, cityForBooking,
  type DayPlan, type Session, type SessionItem, type ParsedTime, type PaletteSpec,
} from '@/lib/itinerary'
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

  // Stable per-trip hotel colour assignment
  const hotelOrder = hotelOrderForTrip(trip.bookings)
  const palette = getPalette(trip.colorPalette)

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">The plan</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Day by day</h1>
        <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base">
          Three sessions a day. Tap the <span className="num-mono">+</span> next to any day to add manually or ask the AI.
          Forward booking emails to fill more in automatically.
        </p>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-5xl space-y-10 sm:space-y-12">
        {days.map((day, idx) => {
          const plan = planForDay(day, trip.bookings)
          const dateKey = format(day, 'yyyy-MM-dd')
          const sleepingTonight = sleepingTonightFor(day, trip.bookings)
          const hotelColor = sleepingTonight
            ? colorForHotel(sleepingTonight.id, hotelOrder, palette)
            : null
          return (
            <DayBlock
              key={dateKey}
              day={day}
              dateKey={dateKey}
              idx={idx}
              plan={plan}
              tripSlug={trip.slug}
              homeCurrency={trip.homeCurrency}
              sleepingTonight={sleepingTonight}
              hotelColor={hotelColor}
              paletteTextColor={palette.textOnColor}
            />
          )
        })}
      </div>
    </>
  )
}

// ============================================================================
// Day block — header with single "+" + three session blocks
// ============================================================================

function DayBlock({
  day, dateKey, idx, plan, tripSlug, homeCurrency, sleepingTonight, hotelColor, paletteTextColor,
}: {
  day: Date
  dateKey: string
  idx: number
  plan: DayPlan
  tripSlug: string
  homeCurrency: string
  sleepingTonight: import('@prisma/client').Booking | null
  hotelColor: string | null
  paletteTextColor: string
}) {
  return (
    <div className="tline pl-8 sm:pl-10">
      <div className="tline-dot" />
      <div className="flex items-center gap-3 mb-2">
        <span className="font-display text-3xl sm:text-4xl">Day {String(idx + 1).padStart(2, '0')}</span>
        <span className="text-ink-muted text-xs sm:text-sm flex-1 truncate">{format(day, 'EEEE, MMM d')}</span>
        <Link
          href={`/trips/${tripSlug}/itinerary/add?date=${dateKey}`}
          aria-label="Add to this day"
          title="Add manually or ask AI"
          className="w-8 h-8 rounded-full border border-line bg-paper-pure hover:bg-ink hover:text-paper-pure hover:border-ink text-ink-muted grid place-items-center transition shrink-0"
        >
          <Plus className="w-4 h-4" />
        </Link>
      </div>

      {/* Accommodation colour bar — at-a-glance "where am I sleeping tonight" */}
      {sleepingTonight && hotelColor && (
        <div
          className="rounded-md px-3 py-1.5 mb-5 text-[10px] uppercase tracking-[0.2em] flex items-center gap-2"
          style={{ background: hotelColor, color: paletteTextColor }}
        >
          <BedDouble className="w-3 h-3" />
          <span className="truncate font-medium">
            {(() => {
              const city = cityForBooking(sleepingTonight)
              const name = cleanHotelName(sleepingTonight.title)
              return city ? `${city} — ${name}` : name
            })()}
          </span>
        </div>
      )}
      {!sleepingTonight && (
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted/50 mb-5 italic">
          No accommodation tonight
        </div>
      )}

      <div className="space-y-6">
        {SESSIONS.map((session) => (
          <SessionBlock
            key={session}
            session={session}
            items={plan.sessions[session]}
            tripSlug={tripSlug}
            currentDate={day}
            dateKey={dateKey}
            homeCurrency={homeCurrency}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Session block
// ============================================================================

function SessionBlock({
  session, items, tripSlug, currentDate, dateKey, homeCurrency,
}: {
  session: Session
  items: SessionItem[]
  tripSlug: string
  currentDate: Date
  dateKey: string
  homeCurrency: string
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
        <Link
          href={`/trips/${tripSlug}/itinerary/add?date=${dateKey}&session=${session}`}
          className="text-xs text-ink-muted/60 italic hover:text-ink-muted transition px-1"
        >
          Nothing planned · tap <span className="num-mono">+</span> above to add
        </Link>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <ItemRow
              key={item.kind === 'booking' ? item.booking.id + ':' + i : item.kind + ':' + item.booking.id + ':' + i}
              item={item}
              tripSlug={tripSlug}
              currentDate={currentDate}
              homeCurrency={homeCurrency}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Item row (dispatcher) — different render per item kind
// ============================================================================

function ItemRow({
  item, tripSlug, currentDate, homeCurrency,
}: {
  item: SessionItem
  tripSlug: string
  currentDate: Date
  homeCurrency: string
}) {
  switch (item.kind) {
    case 'hotel-checkin':
      return <HotelCheckinCard booking={item.booking} time={item.time} tripSlug={tripSlug} />
    case 'hotel-checkout':
      return <HotelCheckoutRow booking={item.booking} time={item.time} tripSlug={tripSlug} />
    case 'staying-tonight':
      return <StayingTonightRow booking={item.booking} />
    case 'car-pickup':
      return <CarRow booking={item.booking} kind="pickup" time={item.time} tripSlug={tripSlug} />
    case 'car-return':
      return <CarRow booking={item.booking} kind="return" time={item.time} tripSlug={tripSlug} />
    case 'booking':
      return <BookingRow booking={item.booking} position={item.position} tripSlug={tripSlug} homeCurrency={homeCurrency} currentDate={currentDate} />
  }
}

// ============================================================================
// Hotel rows
// ============================================================================

function HotelCheckinCard({ booking, time, tripSlug }: { booking: Booking; time: ParsedTime | null; tripSlug: string }) {
  const meta = safeJson<Record<string, string>>(booking.metadata) ?? {}
  // Always derive nights from the actual span — meta.nights from Claude can be wrong
  const nights = booking.endAt
    ? Math.max(1, differenceInDays(startOfDay(booking.endAt), startOfDay(booking.startAt)))
    : 1
  return (
    <div className="border border-line rounded-xl bg-paper-pure overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className={`h-24 sm:h-auto sm:w-40 ${imgForBooking(booking.type, booking.title)} shrink-0 relative`}>
          <div className="absolute bottom-2 left-2 text-paper-pure text-[10px] uppercase tracking-[0.18em] bg-ink/40 backdrop-blur px-2 py-1 rounded">
            Check in{time ? ` · ${time.display}` : ''}
          </div>
        </div>
        <div className="p-4 sm:p-5 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                Hotel · {nights} {nights === 1 ? 'night' : 'nights'}
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
            <div><div className="text-ink-muted">Check-in</div><div className="font-medium mt-0.5">{formatTime(meta.checkIn, '—')}</div></div>
            <div><div className="text-ink-muted">Check-out</div><div className="font-medium mt-0.5">{formatTime(meta.checkOut, '—')}</div></div>
            <div><div className="text-ink-muted">Breakfast</div><div className="font-medium mt-0.5 text-sage truncate">{meta.breakfast ?? '—'}</div></div>
            <div><div className="text-ink-muted">Confirmation</div><div className="font-medium mt-0.5 num-mono truncate">{booking.confirmationCode ?? '—'}</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HotelCheckoutRow({ booking, time, tripSlug }: { booking: Booking; time: ParsedTime | null; tripSlug: string }) {
  return (
    <div className="border border-line rounded-lg bg-paper-pure px-4 py-2.5 flex items-center gap-3 text-sm">
      <LogOut className="w-4 h-4 text-rust shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-ink-muted">Check out</span>{' '}
        {time && <span className="num-mono">{time.display}</span>}{' '}
        <span className="text-ink-muted">from</span>{' '}
        <span className="font-medium">{booking.title}</span>
      </div>
      <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
    </div>
  )
}

function StayingTonightRow({ booking }: { booking: Booking }) {
  return (
    <div className="border border-line/60 rounded-lg bg-paper/40 px-4 py-2.5 flex items-center gap-3 text-sm">
      <BedDouble className="w-4 h-4 text-ink-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-ink-muted">Staying tonight at</span>{' '}
        <span className="font-medium">{booking.title}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Car rental row
// ============================================================================

function CarRow({
  booking, kind, time, tripSlug,
}: {
  booking: Booking
  kind: 'pickup' | 'return'
  time: ParsedTime
  tripSlug: string
}) {
  const meta = safeJson<Record<string, string>>(booking.metadata) ?? {}
  const verb = kind === 'pickup' ? 'Pick up' : 'Return'
  const location = kind === 'pickup' ? booking.location : (meta.dropoffLocation ?? booking.location)
  return (
    <div className="border border-line rounded-lg bg-paper-pure px-4 py-3 flex items-start sm:items-center gap-3 text-sm">
      <div className="w-10 sm:w-12 text-center shrink-0">
        <div className="num-mono text-xs text-ink-muted">{time.display}</div>
      </div>
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-md ${imgForBooking('car', booking.title)} shrink-0 grid place-items-center`}>
        <Car className="w-4 h-4 text-paper-pure" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm sm:text-base truncate">{verb} · {booking.title}</div>
        {location && <div className="text-xs text-ink-muted truncate">{location}</div>}
        {booking.confirmationCode && (
          <div className="text-xs num-mono text-ink-muted mt-0.5 truncate">{booking.confirmationCode}</div>
        )}
      </div>
      <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
    </div>
  )
}

// ============================================================================
// Regular booking row (activity, restaurant, flight, transit, other)
// ============================================================================

function BookingRow({
  booking, position, tripSlug, homeCurrency, currentDate,
}: {
  booking: Booking
  position: 'before' | 'first' | 'middle' | 'last' | 'single' | 'after'
  tripSlug: string
  homeCurrency: string
  currentDate: Date
}) {
  let spanLabel: string | null = null
  if (booking.endAt && position !== 'single') {
    const total = differenceInDays(startOfDay(booking.endAt), startOfDay(booking.startAt)) + 1
    if (total > 1) {
      const dayNum = differenceInDays(startOfDay(currentDate), startOfDay(booking.startAt)) + 1
      spanLabel = `Day ${dayNum} of ${total}`
    }
  }

  // Show a cancellation-deadline pill if cancelByAt is in the next 14 days and we haven't passed it
  let cancelPill: { text: string; tone: 'warning' | 'overdue' } | null = null
  if (booking.cancelByAt) {
    const daysToCancel = differenceInDays(startOfDay(booking.cancelByAt), startOfDay(new Date()))
    if (daysToCancel < 0) {
      // Past the deadline — show muted "non-refundable now" only if still upcoming activity
      if (booking.startAt > new Date()) cancelPill = { text: 'No refund', tone: 'overdue' }
    } else if (daysToCancel <= 14) {
      cancelPill = { text: `Cancel by ${format(booking.cancelByAt, 'MMM d')}`, tone: 'warning' }
    }
  }

  return (
    <div className="border border-line rounded-lg p-3 sm:p-4 bg-paper-pure flex items-center gap-3 sm:gap-4 hover:border-sage transition">
      <Link
        href={`/trips/${tripSlug}/booking/${booking.id}`}
        className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0"
      >
        <div className="w-10 sm:w-12 text-center shrink-0">
          <div className="num-mono text-xs text-ink-muted">{fmtTime(booking.startAt)}</div>
        </div>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-md ${imgForBooking(booking.type, booking.title)} shrink-0 grid place-items-center`}>
          {iconForType(booking.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate text-sm sm:text-base">{booking.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {booking.notes && <div className="text-xs text-ink-muted truncate">{booking.notes}</div>}
            {spanLabel && <span className="pill pill-info text-[9px]">{spanLabel}</span>}
            {cancelPill && (
              <span className={`pill text-[9px] ${cancelPill.tone === 'warning' ? 'pill-upcoming' : 'pill-overdue'}`}>
                <AlertTriangle className="w-3 h-3" /> {cancelPill.text}
              </span>
            )}
          </div>
          {booking.confirmationCode && (
            <div className="text-xs num-mono text-ink-muted mt-0.5 truncate">
              {booking.confirmationCode}
              {booking.cost ? ` · ${fmtMoneyFull(booking.cost, booking.currency ?? homeCurrency)}` : ''}
            </div>
          )}
        </div>
      </Link>
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
