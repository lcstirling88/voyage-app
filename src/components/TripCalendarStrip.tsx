import {
  startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval,
  format, getDay, startOfDay, isBefore, isAfter, isEqual,
} from 'date-fns'
import type { PaletteSpec } from '@/lib/itinerary'

/**
 * Calendar overview that sits below the hero image on the itinerary page.
 *
 * For each month the trip touches, render a 7-column day grid. Each in-trip
 * day cell is background-coloured by the city the traveller is sleeping in
 * that night (using the trip's existing palette). Clicking a day jumps to the
 * matching #day-YYYY-MM-DD anchor on the same page (anchors are set by the
 * itinerary page's day blocks; smooth-scroll comes from globals).
 *
 * Days outside the trip range are dimmed and non-clickable. Days inside the
 * trip but with no accommodation yet (e.g. you've forwarded confirmations
 * for some nights but not all) get a muted neutral background, still
 * clickable, so the user can drill in.
 */
type DayInfo = {
  /** City the traveller is sleeping in this night, or null if none booked yet. */
  city: string | null
}

export function TripCalendarStrip({
  startDate, endDate, daysByDate, cityOrder, palette, tripSlug,
}: {
  startDate: Date
  endDate: Date
  daysByDate: Map<string, DayInfo>
  cityOrder: string[]
  palette: PaletteSpec
  tripSlug: string
}) {
  // Every month that overlaps the trip range
  const months = eachMonthOfInterval({
    start: startOfMonth(startDate),
    end: startOfMonth(endDate),
  })

  return (
    <section className="bg-paper-pure border-b border-line">
      <div className="px-4 sm:px-10 py-5 sm:py-7 max-w-5xl">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-4">
          Where you are
        </div>

        <div className={`grid gap-6 sm:gap-8 ${months.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {months.map((monthStart) => (
            <MonthGrid
              key={monthStart.toISOString()}
              monthStart={monthStart}
              tripStart={startDate}
              tripEnd={endDate}
              daysByDate={daysByDate}
              cityOrder={cityOrder}
              palette={palette}
              tripSlug={tripSlug}
            />
          ))}
        </div>

        {cityOrder.length > 0 && (
          <Legend cityOrder={cityOrder} palette={palette} />
        )}
      </div>
    </section>
  )
}

function MonthGrid({
  monthStart, tripStart, tripEnd, daysByDate, cityOrder, palette, tripSlug,
}: {
  monthStart: Date
  tripStart: Date
  tripEnd: Date
  daysByDate: Map<string, DayInfo>
  cityOrder: string[]
  palette: PaletteSpec
  tripSlug: string
}) {
  const monthEnd = endOfMonth(monthStart)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Monday-first day-of-week alignment. getDay() is 0=Sun..6=Sat, so we map
  // it to a leading-blank count where Monday=0.
  const firstDow = getDay(monthStart) // 0..6, Sun=0
  const leadingBlanks = (firstDow + 6) % 7 // Mon=0, Tue=1, ..., Sun=6

  // Pad the trailing edge to fill the grid to a whole number of weeks (so
  // multi-month layouts line up cleanly when shown side-by-side).
  const totalCells = leadingBlanks + monthDays.length
  const trailingBlanks = (7 - (totalCells % 7)) % 7

  const tripStartDay = startOfDay(tripStart)
  const tripEndDay = startOfDay(tripEnd)

  return (
    <div>
      <div className="font-display text-base sm:text-lg mb-3">
        {format(monthStart, 'MMMM yyyy')}
      </div>

      <div className="grid grid-cols-7 gap-1 text-[9px] uppercase tracking-[0.16em] text-ink-muted mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`lead-${i}`} className="aspect-square" />
        ))}
        {monthDays.map((day) => {
          const inTrip =
            (isEqual(day, tripStartDay) || isAfter(day, tripStartDay)) &&
            (isEqual(day, tripEndDay) || isBefore(day, tripEndDay))
          const dateKey = format(day, 'yyyy-MM-dd')
          const info = daysByDate.get(dateKey)
          const city = info?.city ?? null
          const bgColor = city ? lookupCityColor(city, cityOrder, palette) : null

          if (!inTrip) {
            return (
              <div
                key={dateKey}
                className="aspect-square rounded-md grid place-items-center text-[10px] text-ink-muted/40"
              >
                {format(day, 'd')}
              </div>
            )
          }

          const sharedCellStyle = bgColor
            ? { background: bgColor, color: palette.textOnColor }
            : undefined
          const sharedCellClass = `aspect-square rounded-md grid place-items-center text-xs font-medium transition hover:scale-105 hover:shadow ${
            bgColor ? '' : 'bg-line-soft text-ink-soft'
          }`

          return (
            <a
              key={dateKey}
              href={`#day-${dateKey}`}
              className={sharedCellClass}
              style={sharedCellStyle}
              title={city ? `${format(day, 'EEE MMM d')} — ${city}` : `${format(day, 'EEE MMM d')} — no accommodation booked`}
            >
              {format(day, 'd')}
            </a>
          )
        })}
        {Array.from({ length: trailingBlanks }).map((_, i) => (
          <div key={`trail-${i}`} className="aspect-square" />
        ))}
      </div>
    </div>
  )
}

function Legend({ cityOrder, palette }: { cityOrder: string[]; palette: PaletteSpec }) {
  return (
    <div className="mt-5 sm:mt-6 pt-4 border-t border-line-soft flex flex-wrap gap-x-3 gap-y-2 text-[10px] uppercase tracking-[0.16em]">
      {cityOrder.map((city) => {
        const bg = lookupCityColor(city, cityOrder, palette)
        return (
          <span key={city} className="inline-flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: bg }}
              aria-hidden
            />
            <span className="text-ink-soft">{city}</span>
          </span>
        )
      })}
    </div>
  )
}

function lookupCityColor(city: string, cityOrder: string[], palette: PaletteSpec): string {
  const idx = cityOrder.indexOf(city)
  const safe = idx < 0 ? 0 : idx
  return palette.colors[safe % palette.colors.length]
}
