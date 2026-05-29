import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Check, Clock, Utensils, Plane, Train, Car, BedDouble, LogOut, Plus, AlertTriangle, ArrowRight,
  Mountain, Telescope, Footprints, Sailboat, Wine, Bike, Camera, Landmark,
  Fish, Flag, Sparkles, Coffee, Music, Waves, Tent, TreePine, Heart, MapPin, StickyNote,
  type LucideIcon,
} from 'lucide-react'
import { format, startOfDay, eachDayOfInterval, differenceInDays } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { fmtTime, safeJson, fmtMoneyFull } from '@/lib/format'
import { InlineDeleteButton } from '@/components/InlineDeleteButton'
import { ConfirmSuggestionButton } from '@/components/ConfirmSuggestionButton'
import { SwapSuggestionButton } from '@/components/SwapSuggestionButton'
import { RegenerateDayButton } from '@/components/RegenerateDayButton'
import { BookItButton } from '@/components/BookItButton'
import { MarkBookedButton } from '@/components/MarkBookedButton'
import { clearTripSuggestions } from '@/lib/actions'
import { bookingLinkFor } from '@/lib/affiliates'
import {
  planForDay, SESSIONS, SESSION_LABEL, formatTime,
  hotelOrderForTrip, sleepingTonightFor, getPalette, colorForHotel, colorForCity,
  cleanHotelName, cityForBooking, cityOrderForTrip,
  type DayPlan, type Session, type SessionItem, type ParsedTime, type PaletteSpec,
} from '@/lib/itinerary'
import { mapRowsToSkeleton, cityForDate, citiesInOrder } from '@/lib/skeleton'
import { computePlanBudget } from '@/lib/budget'
import { PlanBudgetBar } from '@/components/PlanBudgetBar'
import { profileForDestination } from '@/lib/destinations'
import { TripCalendarStrip } from '@/components/TripCalendarStrip'
import { EmptyTripDoors } from '@/components/EmptyTripDoors'
import { QuickAddRow } from '@/components/QuickAddRow'
import { RetimeButton } from '@/components/RetimeButton'
import { ScrollToToday } from '@/components/ScrollToToday'
import type { Booking } from '@prisma/client'

/** A booking's start time as a 24h HH:mm string (times are stored UTC wall-clock). */
function hhmmOf(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Item types that can be freely retimed/reordered inline (not transport facts). */
const RETIMEABLE_TYPES = new Set(['activity', 'restaurant', 'note', 'other'])

/** True if a booking is an unconfirmed AI suggestion (dashed placeholder). */
function isSuggestedBooking(b: Booking): boolean {
  return b.status === 'idea'
}

/** True while a kept item is on its way to being booked (planned or out-to-book). */
function isPlanningBooking(b: Booking): boolean {
  return b.status === 'planned' || b.status === 'to_book'
}

/**
 * Pick a contextual lucide icon for the small uppercase header line of an
 * activity card. Type wins for the obvious cases (hotel, flight, etc.);
 * for generic 'activity' bookings we sniff the title for keywords so that
 * a ski lesson gets a Mountain, stargazing gets a Telescope, etc.
 */
function iconForBooking(type: string, title: string): LucideIcon {
  if (type === 'hotel')      return BedDouble
  if (type === 'restaurant') return Utensils
  if (type === 'flight')     return Plane
  if (type === 'transit')    return Train
  if (type === 'car')        return Car

  const t = title.toLowerCase()
  if (/\b(ski|skiing|snowboard|snowboarding|snow|cardrona|skiwees|coronet|treble cone|remarkables|nzski)\b/.test(t)) return Mountain
  if (/\b(stargaz|star gaz|astronomy|dark sky|observat|planetarium|nebula)\b/.test(t)) return Telescope
  if (/\b(hike|hiking|trail|trek|track|walk)\b/.test(t)) return Footprints
  if (/\b(cruise|boat|ferry|sail|kayak|jet ?boat|paddle)\b/.test(t)) return Sailboat
  if (/\b(wine|vineyard|winer|cellar door|tasting)\b/.test(t)) return Wine
  if (/\b(bike|cycling|cycle|mountain bike|e-?bike)\b/.test(t)) return Bike
  if (/\b(museum|gallery|exhibit|heritage|historic|cathedral)\b/.test(t)) return Landmark
  if (/\b(fish|angling)\b/.test(t)) return Fish
  if (/\b(golf|tee time)\b/.test(t)) return Flag
  if (/\b(coffee|cafe|café|brew)\b/.test(t)) return Coffee
  if (/\b(concert|gig|music|orchestra|opera|theatre|theater)\b/.test(t)) return Music
  if (/\b(beach|surf|swim|snorkel|dive|lagoon)\b/.test(t)) return Waves
  if (/\b(camp|glamping|hut)\b/.test(t)) return Tent
  if (/\b(park|forest|garden|botanic|nature|reserve|conservation)\b/.test(t)) return TreePine
  if (/\b(photo|scenic|lookout|viewpoint|tour|sightsee)\b/.test(t)) return Camera
  if (/\b(spa|massage|hot pool|onsen|wellness|thermal)\b/.test(t)) return Heart

  return Sparkles
}

/** Human-friendly uppercase label for the header line ("ACTIVITY", "RESTAURANT", …). */
function typeLabelFor(type: string): string {
  if (type === 'activity')   return 'Activity'
  if (type === 'restaurant') return 'Restaurant'
  if (type === 'flight')     return 'Flight'
  if (type === 'transit')    return 'Transit'
  if (type === 'car')        return 'Car'
  if (type === 'hotel')      return 'Hotel'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export default async function ItineraryPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  await requireTripAccess(tripSlug)
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { bookings: { orderBy: { startAt: 'asc' } }, cities: true },
  })
  if (!trip) notFound()

  const days = eachDayOfInterval({ start: startOfDay(trip.startDate), end: startOfDay(trip.endDate) })

  // The route "skeleton" (cities + nights) is the planning backbone — it lets a
  // trip carry a where-am-I-based timeline BEFORE any booking exists.
  const skeleton = mapRowsToSkeleton(trip.cities, trip.startDate, trip.endDate)
  const hasRoute = skeleton.scheduled
  const hasBookings = trip.bookings.length > 0
  // The blank page: nothing booked AND no route drafted yet → show the doors.
  const isEmpty = !hasBookings && !hasRoute

  // Stable per-trip hotel colour assignment
  const hotelOrder = hotelOrderForTrip(trip.bookings)
  const palette = getPalette(trip.colorPalette)

  // The budget loop: experiences + dining spend by commitment level vs the
  // traveller's stated budget. Drives the bar above the day-by-day blocks.
  const planBudget = computePlanBudget(trip.bookings, {
    homeCurrency: trip.homeCurrency,
    partySize: Math.max(1, trip.adultCount + trip.childCount),
    tripStart: trip.startDate,
    tripEnd: trip.endDate,
  })

  // For the overview calendar: each night's city is where they SLEEP (hotel) if
  // booked, otherwise where the route has them BASED (skeleton). City order is
  // hotel cities first (chronological) then any route-only cities, so colours
  // stay stable as bookings get added.
  const cityOrder = cityOrderForTrip(trip.bookings)
  for (const c of hasRoute ? citiesInOrder(skeleton.stops) : []) {
    if (!cityOrder.includes(c)) cityOrder.push(c)
  }
  const daysByDate = new Map<string, { city: string | null }>()
  for (const day of days) {
    const sleeping = sleepingTonightFor(day, trip.bookings)
    const hotelCity = sleeping ? cityForBooking(sleeping) : null
    const plannedCity = hasRoute ? cityForDate(skeleton.stops, day, trip.endDate) : null
    daysByDate.set(format(day, 'yyyy-MM-dd'), { city: hotelCity ?? plannedCity })
  }

  // Highlights today's cell in the calendar strip + day block. Only has a
  // visible effect once today falls inside the trip's date range.
  const today = new Date()
  const todayKey = format(today, 'yyyy-MM-dd')
  const todayInTrip = days.some((d) => format(d, 'yyyy-MM-dd') === todayKey)

  // Iconic destination photo + country label for the hero. Falls back to the
  // existing gradient header for destinations we don't have a curated image for.
  const destProfile = profileForDestination(trip.destination)
  const heroImage = destProfile.heroImage

  return (
    <>
      {heroImage ? (
        <div className="relative h-[26vh] min-h-[180px] sm:h-[38vh] sm:min-h-[280px] lg:min-h-[340px] bg-ink overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- external CDN image, next/image needs domain config */}
          <img
            src={heroImage.src}
            alt={heroImage.alt}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: heroImage.objectPosition ?? 'center' }}
          />
          {/* Subtle bottom gradient — kept just dark enough that the photo credit
              chip in the corner stays readable over any background. */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/30" />

          {/* Top-left chip: country name + trip date range */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-8">
            <div className="inline-block bg-ink/40 backdrop-blur-md px-3 py-1.5 rounded-md text-paper-pure">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.24em] font-medium">
                {destProfile.label}
              </div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] opacity-85 mt-0.5">
                {format(trip.startDate, 'd MMM')} — {format(trip.endDate, 'd MMM yyyy')}
              </div>
            </div>
          </div>

          {/* Discreet photo credit, bottom-right */}
          {heroImage.credit && (
            <div className="absolute bottom-3 right-3 text-paper-pure/50 text-[9px] uppercase tracking-[0.2em]">
              Photo · {heroImage.credit}
            </div>
          )}
        </div>
      ) : (
        <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">The plan{destProfile.label && destProfile.label !== 'Unknown' ? ` · ${destProfile.label}` : ''}</div>
          <h1 className="h-display text-4xl sm:text-6xl mt-2">Day by day</h1>
          <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base">
            Three sessions a day. Tap the <span className="num-mono">+</span> next to any day to add manually or ask the AI.
            Forward booking emails to fill more in automatically.
          </p>
        </div>
      )}

      {isEmpty ? (
        <EmptyTripDoors tripSlug={trip.slug} destination={trip.destination} />
      ) : (
        <>
          <TripCalendarStrip
            startDate={trip.startDate}
            endDate={trip.endDate}
            daysByDate={daysByDate}
            cityOrder={cityOrder}
            palette={palette}
            tripSlug={trip.slug}
            today={today}
          />

          {/* Plan-with-AI CTA — between the calendar and the day-by-day blocks.
              Points at the route step until a route exists, then straight at
              the fill-the-days step. */}
          <div className="px-4 sm:px-10 pt-6 sm:pt-8 max-w-5xl">
            <Link
              href={hasRoute ? `/trips/${trip.slug}/plan/days` : `/trips/${trip.slug}/plan`}
              className="group flex items-center gap-3 rounded-2xl border border-dashed border-sage/50 bg-sage-soft/30 px-5 py-4 hover:bg-sage-soft/50 hover:border-sage transition"
            >
              <Sparkles className="w-5 h-5 text-sage shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-display text-base sm:text-lg leading-tight">
                  {hasRoute ? 'Fill your days with ideas' : 'Let Itinera plan the rest'}
                </div>
                <div className="text-xs text-ink-muted mt-0.5">
                  {hasRoute
                    ? 'Your route’s set — tick what you’re into and we’ll suggest things to do that flow.'
                    : 'Map your route, then tick what you’re into — we’ll fill your days with ideas.'}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-ink transition shrink-0" />
            </Link>
            {trip.bookings.some(isSuggestedBooking) && (
              <form action={clearTripSuggestions} className="mt-2 text-right">
                <input type="hidden" name="tripSlug" value={trip.slug} />
                <button type="submit" className="text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-rust ulink">
                  Clear all suggestions
                </button>
              </form>
            )}
            {planBudget.itemCount > 0 && (
              <div className="mt-4">
                <PlanBudgetBar data={planBudget} />
              </div>
            )}
          </div>

          {todayInTrip && <ScrollToToday targetId={`day-${todayKey}`} />}

          <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-5xl space-y-10 sm:space-y-12">
            {days.map((day, idx) => {
              const plan = planForDay(day, trip.bookings)
              const dateKey = format(day, 'yyyy-MM-dd')
              const sleepingTonight = sleepingTonightFor(day, trip.bookings)
              const hotelColor = sleepingTonight
                ? colorForHotel(sleepingTonight.id, hotelOrder, palette)
                : null
              // No hotel for tonight, but the route has them based somewhere →
              // show a "planned" hint instead of a blank "no accommodation".
              const plannedCity = !sleepingTonight && hasRoute
                ? cityForDate(skeleton.stops, day, trip.endDate)
                : null
              const plannedColor = plannedCity ? colorForCity(plannedCity, cityOrder, palette) : null
              return (
                <DayBlock
                  key={dateKey}
                  day={day}
                  dateKey={dateKey}
                  idx={idx}
                  isToday={dateKey === todayKey}
                  plan={plan}
                  tripSlug={trip.slug}
                  homeCurrency={trip.homeCurrency}
                  sleepingTonight={sleepingTonight}
                  hotelColor={hotelColor}
                  plannedCity={plannedCity}
                  plannedColor={plannedColor}
                  paletteTextColor={palette.textOnColor}
                />
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

// ============================================================================
// Day block — header with single "+" + three session blocks
// ============================================================================

function DayBlock({
  day, dateKey, idx, isToday, plan, tripSlug, homeCurrency, sleepingTonight, hotelColor, plannedCity, plannedColor, paletteTextColor,
}: {
  day: Date
  dateKey: string
  idx: number
  isToday: boolean
  plan: DayPlan
  tripSlug: string
  homeCurrency: string
  sleepingTonight: import('@prisma/client').Booking | null
  hotelColor: string | null
  plannedCity: string | null
  plannedColor: string | null
  paletteTextColor: string
}) {
  // Show "Reimagine day" only when this day actually renders AI suggestions.
  const dayHasSuggestions = SESSIONS.some((s) =>
    plan.sessions[s].some((it) => it.kind === 'booking' && isSuggestedBooking(it.booking)),
  )
  return (
    <div id={`day-${dateKey}`} className="tline pl-8 sm:pl-10 scroll-mt-24 sm:scroll-mt-20">
      <div className="tline-dot" style={isToday ? { boxShadow: '0 0 0 4px var(--color-sage-soft)' } : undefined} />
      <div className="flex items-center gap-3 mb-2">
        <span className="font-display text-3xl sm:text-4xl">
          {format(day, 'MMM d')} <span className="text-ink-muted">({format(day, 'EEE')})</span>
        </span>
        {isToday && <span className="pill pill-info shrink-0">Today</span>}
        <span className="flex-1" />
        {dayHasSuggestions && <RegenerateDayButton tripSlug={tripSlug} date={dateKey} />}
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
      {!sleepingTonight && plannedCity && (
        <div
          className="rounded-md px-3 py-1.5 mb-5 text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 border border-dashed bg-paper-pure/40"
          style={{ borderColor: plannedColor ?? undefined, color: plannedColor ?? undefined }}
        >
          <MapPin className="w-3 h-3" />
          <span className="truncate font-medium">Based in {plannedCity} · planned</span>
        </div>
      )}
      {!sleepingTonight && !plannedCity && (
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
        <QuickAddRow tripSlug={tripSlug} date={dateKey} session={session} />
      </div>
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
      if (item.booking.type === 'note') {
        return <NoteRow booking={item.booking} tripSlug={tripSlug} />
      }
      if (item.booking.type === 'restaurant') {
        return <RestaurantRow booking={item.booking} tripSlug={tripSlug} homeCurrency={homeCurrency} />
      }
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
    <div className="border border-line rounded-xl bg-paper-pure p-3 sm:p-4">
      {/* Header line: tag on left, pills/delete on right — only this row reserves space for the controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted flex items-center gap-2 min-w-0">
          <BedDouble className="w-3 h-3 shrink-0" />
          <span className="truncate">
            Check in{time ? ` · ${time.display}` : ''} · {nights} {nights === 1 ? 'night' : 'nights'}
          </span>
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

      {/* Hotel name — runs full card width */}
      <h3 className="font-display text-lg sm:text-xl mt-1.5 leading-tight">{booking.title}</h3>

      {/* Address — runs full card width */}
      {booking.address && <p className="text-xs text-ink-muted mt-1">{booking.address}</p>}

      {/* Detail row — full card width, check-out lives on the check-out card */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-3 text-xs">
        <div>
          <div className="text-ink-muted">Check-in</div>
          <div className="font-medium mt-0.5">{formatTime(meta.checkIn, '—')}</div>
        </div>
        <div>
          <div className="text-ink-muted">Breakfast</div>
          <div className="font-medium mt-0.5 text-sage truncate">{meta.breakfast ?? '—'}</div>
        </div>
        <div>
          <div className="text-ink-muted">Confirmation</div>
          <div className="font-medium mt-0.5 num-mono truncate">{booking.confirmationCode ?? '—'}</div>
        </div>
      </div>
    </div>
  )
}

function HotelCheckoutRow({ booking, time, tripSlug }: { booking: Booking; time: ParsedTime | null; tripSlug: string }) {
  const meta = safeJson<Record<string, string>>(booking.metadata) ?? {}
  // Prefer the parsed time-of-day from the booking; fall back to whatever metadata says.
  const metaCheckout = meta.checkOut ? formatTime(meta.checkOut, '') : ''
  const checkoutTime = time?.display || metaCheckout
  return (
    <div className="border border-line rounded-xl bg-paper-pure p-3 sm:p-4">
      {/* Header line: LogOut icon + check out · time on left, delete on right —
          icon inherits the muted heading colour so it reads as part of the label,
          matching the BedDouble icon on the check-in card. */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted flex items-center gap-2 min-w-0">
          <LogOut className="w-3 h-3 shrink-0" />
          <span className="truncate">Check out{checkoutTime ? ` · ${checkoutTime}` : ''}</span>
        </div>
        <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
      </div>

      {/* Hotel title — full card width. Address omitted: it's already on the
          check-in card for the same booking, so repeating it here just adds
          noise to the check-out row. */}
      <h3 className="font-medium text-sm sm:text-base mt-1.5 leading-tight">{booking.title}</h3>
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
// Note row — a loose, non-booking jotting (type 'note'). No time, no cost, no
// book-it lifecycle: just a line you can retime into another session or bin.
// ============================================================================

function NoteRow({ booking, tripSlug }: { booking: Booking; tripSlug: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-paper/40 p-3 sm:p-4 flex items-start gap-3">
      <StickyNote className="w-4 h-4 text-ink-muted/70 shrink-0 mt-0.5" />
      <p className="flex-1 min-w-0 text-sm leading-snug">{booking.title}</p>
      <div className="flex items-center gap-1 shrink-0">
        <RetimeButton id={booking.id} tripSlug={tripSlug} currentTime={hhmmOf(booking.startAt)} />
        <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
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
    <div className="border border-line rounded-xl bg-paper-pure p-3 sm:p-4">
      {/* Header line: car icon + verb + time on left, delete on right */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted flex items-center gap-2 min-w-0">
          <Car className="w-3 h-3 shrink-0" />
          <span className="truncate">{verb} · {time.display}</span>
        </div>
        <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
      </div>

      {/* Title — full card width */}
      <h3 className="font-medium text-sm sm:text-base mt-1.5 leading-tight">{booking.title}</h3>

      {/* Location — full card width */}
      {location && <p className="text-xs text-ink-muted mt-1">{location}</p>}

      {/* Confirmation */}
      {booking.confirmationCode && (
        <div className="text-xs num-mono text-ink-muted mt-2">{booking.confirmationCode}</div>
      )}
    </div>
  )
}

// ============================================================================
// Restaurant row — slim card showing just name, time, who it's booked under,
// and address. The full card is a link to the booking detail page for any
// extra info the restaurant supplied (notes, dress code, allergens, etc.).
// ============================================================================

function RestaurantRow({ booking, tripSlug, homeCurrency }: { booking: Booking; tripSlug: string; homeCurrency: string }) {
  const meta = safeJson<Record<string, string | number>>(booking.metadata) ?? {}
  // The parser is asked to put the reservation holder's name in metadata.bookedUnder;
  // older parses might have it under different keys, so check a few common shapes.
  const bookedUnderRaw = (meta.bookedUnder ?? meta.guestName ?? meta.reservationName ?? meta.partyName) as string | undefined
  const bookedUnder = typeof bookedUnderRaw === 'string' && bookedUnderRaw.trim() ? bookedUnderRaw.trim() : null
  const partySizeRaw = meta.partySize ?? meta.pax ?? meta.guests
  const partySize = typeof partySizeRaw === 'number' || (typeof partySizeRaw === 'string' && partySizeRaw.trim())
    ? String(partySizeRaw)
    : null
  const timeLabel = fmtTime(booking.startAt)
  const isIdea = isSuggestedBooking(booking)
  const isPlanning = isPlanningBooking(booking)
  // For a kept restaurant, "Reserve" deep-links out to find & book the table.
  const link = isPlanning ? bookingLinkFor(booking) : null

  const cardTone = isIdea
    ? 'border-dashed border-sage/50 bg-sage-soft/40'
    : isPlanning
      ? 'border-sage/40 bg-sage-soft/20 hover:border-sage'
      : 'border-line bg-paper-pure hover:border-sage'

  return (
    <div className={`rounded-xl p-3 sm:p-4 border transition ${cardTone}`}>
      {/* Header line: Utensils icon + Restaurant · time on left, controls on right */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted flex items-center gap-2 min-w-0">
          <Utensils className="w-3 h-3 shrink-0" />
          <span className="truncate">
            Restaurant{timeLabel ? ` · ${timeLabel}` : ''}{partySize ? ` · table for ${partySize}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isIdea && (
            <span className="pill" style={{ background: 'var(--color-sage-soft)', color: 'var(--color-sage-dark)' }}><Sparkles className="w-3 h-3" /> Suggested</span>
          )}
          {isPlanning && (
            booking.status === 'planned'
              ? <span className="pill pill-info"><Check className="w-3 h-3" /> Planned</span>
              : <span className="pill pill-upcoming"><Clock className="w-3 h-3" /> Booking…</span>
          )}
          {isIdea && <SwapSuggestionButton id={booking.id} tripSlug={tripSlug} />}
          {isIdea && <ConfirmSuggestionButton id={booking.id} tripSlug={tripSlug} />}
          {isPlanning && link && <BookItButton id={booking.id} tripSlug={tripSlug} url={link.url} label={link.label} />}
          {isPlanning && <MarkBookedButton id={booking.id} tripSlug={tripSlug} />}
          {!isIdea && <RetimeButton id={booking.id} tripSlug={tripSlug} currentTime={hhmmOf(booking.startAt)} />}
          <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
        </div>
      </div>

      {/* Linked body — restaurant name, who it's booked under, address */}
      <Link href={`/trips/${tripSlug}/booking/${booking.id}`} className="block">
        <h3 className="font-medium text-sm sm:text-base mt-1.5 leading-tight">{booking.title}</h3>
        {(isIdea || isPlanning) && booking.notes && <p className="text-xs text-ink-muted italic mt-1">{booking.notes}</p>}
        {bookedUnder && <p className="text-xs text-ink-muted mt-1">Booked under {bookedUnder}</p>}
        {booking.address && <p className="text-xs text-ink-muted mt-1">{booking.address}</p>}
      </Link>
    </div>
  )
}

// ============================================================================
// Regular booking row (activity, flight, transit, other — restaurants are
// handled by RestaurantRow above)
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

  const Icon = iconForBooking(booking.type, booking.title)
  const typeLabel = typeLabelFor(booking.type)
  const timeLabel = fmtTime(booking.startAt)
  const isIdea = isSuggestedBooking(booking)
  const isPlanning = isPlanningBooking(booking)
  // The "Book it" deep-link (Booking.com / GetYourGuide / Maps / Flights),
  // built only for kept-but-unbooked items — this is the monetisable moment.
  const link = isPlanning ? bookingLinkFor(booking) : null

  const cardTone = isIdea
    ? 'border-dashed border-sage/50 bg-sage-soft/40'
    : isPlanning
      ? 'border-sage/40 bg-sage-soft/20 hover:border-sage'
      : 'border-line bg-paper-pure hover:border-sage'

  return (
    <div className={`rounded-xl p-3 sm:p-4 border transition ${cardTone}`}>
      {/* Header line: contextual icon + type · time on left, status pill + controls on right */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted flex items-center gap-2 min-w-0">
          <Icon className="w-3 h-3 shrink-0" />
          <span className="truncate">{typeLabel}{timeLabel ? ` · ${timeLabel}` : ''}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isIdea ? (
            <span className="pill" style={{ background: 'var(--color-sage-soft)', color: 'var(--color-sage-dark)' }}><Sparkles className="w-3 h-3" /> Suggested</span>
          ) : isPlanning ? (
            booking.status === 'planned'
              ? <span className="pill pill-info"><Check className="w-3 h-3" /> Planned</span>
              : <span className="pill pill-upcoming"><Clock className="w-3 h-3" /> Booking…</span>
          ) : booking.paid ? (
            <span className="pill pill-paid"><Check className="w-3 h-3" /> Paid</span>
          ) : booking.paymentMethod === 'Pay at venue' ? (
            <span className="pill pill-upcoming"><Clock className="w-3 h-3" /> At venue</span>
          ) : booking.cost ? (
            <span className="pill pill-upcoming"><Clock className="w-3 h-3" /> Pending</span>
          ) : null}
          {isIdea && <SwapSuggestionButton id={booking.id} tripSlug={tripSlug} />}
          {isIdea && <ConfirmSuggestionButton id={booking.id} tripSlug={tripSlug} />}
          {isPlanning && link && <BookItButton id={booking.id} tripSlug={tripSlug} url={link.url} label={link.label} />}
          {isPlanning && <MarkBookedButton id={booking.id} tripSlug={tripSlug} />}
          {!isIdea && RETIMEABLE_TYPES.has(booking.type) && <RetimeButton id={booking.id} tripSlug={tripSlug} currentTime={hhmmOf(booking.startAt)} />}
          <InlineDeleteButton kind="booking" id={booking.id} tripSlug={tripSlug} />
        </div>
      </div>

      {/* Title + linked detail body — runs full card width */}
      <Link href={`/trips/${tripSlug}/booking/${booking.id}`} className="block">
        <h3 className="font-medium text-sm sm:text-base mt-1.5 leading-tight">{booking.title}</h3>
        {booking.notes && <p className="text-xs text-ink-muted mt-1 line-clamp-2">{booking.notes}</p>}
        {(spanLabel || cancelPill) && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {spanLabel && <span className="pill pill-info text-[9px]">{spanLabel}</span>}
            {cancelPill && (
              <span className={`pill text-[9px] ${cancelPill.tone === 'warning' ? 'pill-upcoming' : 'pill-overdue'}`}>
                <AlertTriangle className="w-3 h-3" /> {cancelPill.text}
              </span>
            )}
          </div>
        )}
        {(booking.confirmationCode || booking.cost) && (
          <div className="text-xs text-ink-muted mt-2 flex flex-wrap items-center gap-x-2">
            {booking.confirmationCode && <span className="num-mono">{booking.confirmationCode}</span>}
            {booking.confirmationCode && booking.cost && <span className="opacity-50">·</span>}
            {booking.cost && (
              <span>
                {isIdea || isPlanning
                  ? `est. ${fmtMoneyFull(booking.cost, booking.currency ?? homeCurrency)} pp`
                  : fmtMoneyFull(booking.cost, booking.currency ?? homeCurrency)}
              </span>
            )}
          </div>
        )}
      </Link>
    </div>
  )
}
