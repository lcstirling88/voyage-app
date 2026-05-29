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
  startDate, endDate, daysByDate, cityOrder, palette, tripSlug, today,
}: {
  startDate: Date
  endDate: Date
  daysByDate: Map<string, DayInfo>
  cityOrder: string[]
  palette: PaletteSpec
  tripSlug: string
  /** Date treated as "today" for the highlight ring. Defaults to current time. */
  today?: Date
}) {
  // Compare via formatted date strings (YYYY-MM-DD) so TZ differences between
  // the Vercel runtime and the user's locale can't desync today's highlight.
  const todayKey = format(today ?? new Date(), 'yyyy-MM-dd')
  // Every month that overlaps the trip range
  const months = eachMonthOfInterval({
    start: startOfMonth(startDate),
    end: startOfMonth(endDate),
  })

  const multiMonth = months.length > 1

  return (
    <section className="bg-paper-pure border-b border-line">
      <div
        className={`px-4 sm:px-10 py-3 sm:py-5 ${multiMonth ? 'max-w-5xl' : 'mx-auto'}`}
        style={multiMonth ? undefined : { maxWidth: '32rem' }}
      >
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Where you are
          </div>
          {multiMonth && (
            <div className="text-[9px] uppercase tracking-[0.2em] text-ink-muted/70 sm:hidden">
              Swipe →
            </div>
          )}
        </div>

        {/*
          Multi-month: horizontal scroll-snap carousel on mobile (one month per
          swipe page), side-by-side grid on desktop. Single-month: just render
          centred. Negative margin + matching padding extends the scroll area
          to the screen edges on mobile so the swipe gesture feels native.
        */}
        {multiMonth ? (
          <div
            className="
              flex sm:grid sm:grid-cols-2 gap-6 sm:gap-8
              overflow-x-auto sm:overflow-visible
              snap-x snap-mandatory sm:snap-none
              -mx-4 px-4 sm:mx-0 sm:px-0
              [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
            "
          >
            {months.map((monthStart) => (
              <div
                key={monthStart.toISOString()}
                className="snap-center shrink-0 w-full sm:w-auto"
              >
                <MonthGrid
                  monthStart={monthStart}
                  tripStart={startDate}
                  tripEnd={endDate}
                  daysByDate={daysByDate}
                  cityOrder={cityOrder}
                  palette={palette}
                  tripSlug={tripSlug}
                  todayKey={todayKey}
                />
              </div>
            ))}
          </div>
        ) : (
          <MonthGrid
            monthStart={months[0]}
            tripStart={startDate}
            tripEnd={endDate}
            daysByDate={daysByDate}
            cityOrder={cityOrder}
            palette={palette}
            tripSlug={tripSlug}
            todayKey={todayKey}
          />
        )}

        {cityOrder.length > 0 && (
          <Legend cityOrder={cityOrder} palette={palette} />
        )}
      </div>
    </section>
  )
}

function MonthGrid({
  monthStart, tripStart, tripEnd, daysByDate, cityOrder, palette, tripSlug, todayKey,
}: {
  monthStart: Date
  tripStart: Date
  tripEnd: Date
  daysByDate: Map<string, DayInfo>
  cityOrder: string[]
  palette: PaletteSpec
  tripSlug: string
  todayKey: string
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
      <div className="font-display text-base sm:text-lg mb-1.5 sm:mb-2">
        {format(monthStart, 'MMMM yyyy')}
      </div>

      <div className="grid grid-cols-7 gap-1 text-[9px] uppercase tracking-[0.16em] text-ink-muted mb-0.5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center py-0.5">{d}</div>
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

          const isToday = dateKey === todayKey
          // Build the cell's resting style first (city bg + contrast text colour).
          const baseStyle: React.CSSProperties = bgColor
            ? { background: bgColor, color: palette.textOnColor }
            : {}
          // For today's cell, derive an in-family tint of the city colour and
          // use it for BOTH the inset ring and the day number. Lighter palettes
          // (pastel: dark contrast text → light cells) get a darker tint;
          // darker palettes (jewel / mono: light contrast text → dark cells)
          // get a lighter tint. End result: a "lighter purple" sort of accent
          // on jewel amethyst, a deeper-rose accent on pastel, etc.
          const todayAccent = isToday ? deriveTodayAccent(bgColor, palette) : null
          const cellStyle: React.CSSProperties = {
            ...baseStyle,
            ...(isToday && todayAccent
              ? { boxShadow: `inset 0 0 0 3px ${todayAccent}`, color: todayAccent }
              : {}),
          }
          const cellClass = `aspect-square rounded-md grid place-items-center text-xs transition hover:scale-105 ${
            bgColor ? '' : 'bg-line-soft text-ink-soft'
          } ${isToday ? 'font-bold' : 'font-medium'}`

          return (
            <a
              key={dateKey}
              href={`#day-${dateKey}`}
              className={cellClass}
              style={cellStyle}
              title={
                (city ? `${format(day, 'EEE MMM d')} — ${city}` : `${format(day, 'EEE MMM d')} — no accommodation booked`) +
                (isToday ? ' (today)' : '')
              }
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
    <div className="mt-2 sm:mt-4 pt-2 border-t border-line-soft flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] uppercase tracking-[0.16em]">
      {cityOrder.map((city) => {
        const bg = lookupCityColor(city, cityOrder, palette)
        return (
          <span key={city} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
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

/**
 * Compute the "today" accent colour for a calendar cell. We want a tint that's
 * recognisably in the same colour family as the cell's city colour but with
 * enough contrast to stand out as the day marker.
 *
 *   - On dark-palette cells (jewel, mono — textOnColor is light/cream), the
 *     cell is dark, so we lighten the city colour: e.g. a dark amethyst cell
 *     gets a soft lavender accent.
 *   - On light-palette cells (pastel — textOnColor is dark brown), the cell
 *     is light, so we darken the city colour: e.g. a powder-blue cell gets
 *     a deeper teal accent.
 *
 * Uses CSS color-mix at render time so the browser does the actual blending.
 * Cells with no city colour (no accommodation that night) fall back to the
 * palette's plain contrast colour as the accent.
 */
function deriveTodayAccent(bgColor: string | null, palette: PaletteSpec): string {
  if (!bgColor) return palette.textOnColor
  // First byte of the hex contrast colour: < 128 = a dark text colour, which
  // means the palette's cells are light overall.
  const firstByte = parseInt(palette.textOnColor.slice(1, 3), 16)
  const cellIsLight = !Number.isNaN(firstByte) && firstByte < 128
  return cellIsLight
    ? `color-mix(in srgb, ${bgColor} 35%, black)`     // light cell → noticeably darker in-family tint
    : `color-mix(in srgb, ${bgColor} 70%, white)`     // dark cell → still-purple tint, not washed out
}
