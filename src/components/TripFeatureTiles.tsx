import Link from 'next/link'
import {
  CalendarDays, Wallet, CloudSun, Globe2, Folder, ListChecks,
  Mail, Settings as SettingsIcon, Plus,
} from 'lucide-react'

/**
 * App-launcher grid — the entire navigation surface for a trip.
 *
 * Back to white paper tiles (was briefly solid-coloured app-icons) with
 * a tinted icon square in the top-left of each card. This version is
 * tighter than the original though:
 *
 *  - 5 columns wide on desktop, 2 rows tall = 10 tile slots
 *  - 8 real features, 2 placeholders so the row reads as a deliberate
 *    composition (and leaves slots for future features to slip into)
 *  - Icon backdrop bumped from w-11 → w-12 mobile / w-12 → w-14 desktop,
 *    and the glyph itself from w-5 → w-6 mobile / w-6 → w-7 desktop, so
 *    the "picture" inside each white card reads a touch more present
 *  - Progress strip still lives on Costs + Packing tiles (gold + burgundy
 *    bars across the bottom of each, above the label)
 */

type TileSpec = {
  href: string
  label: string
  preview: string
  Icon: typeof CalendarDays
  /** Light wash for the icon backdrop. */
  tintBg: string
  /** Saturated accent for the icon glyph + progress bar fill. */
  tintFg: string
  /** Optional 0–100 progress. When set, a thin coloured bar sits above
   *  the title — visible on Costs and Packing tiles only. */
  progressPct?: number
}

export function TripFeatureTiles({
  tripSlug,
  itineraryPreview,
  costsPreview,
  costsPct,
  weatherPreview,
  localPreview,
  documentsPreview,
  packingPreview,
  packingPct,
  inboxPreview,
  settingsPreview,
}: {
  tripSlug: string
  itineraryPreview: string
  costsPreview: string
  costsPct: number
  weatherPreview: string
  localPreview: string
  documentsPreview: string
  packingPreview: string
  packingPct: number
  inboxPreview: string
  settingsPreview: string
}) {
  const tiles: TileSpec[] = [
    {
      href: `/trips/${tripSlug}/itinerary`,
      label: 'Itinerary',
      preview: itineraryPreview,
      Icon: CalendarDays,
      tintBg: 'rgba(11, 111, 184, 0.10)',   // Spanish Blue
      tintFg: '#0B6FB8',
    },
    {
      href: `/trips/${tripSlug}/costs`,
      label: 'Costs & Payments',
      preview: costsPreview,
      Icon: Wallet,
      tintBg: 'rgba(27, 42, 85, 0.10)',     // Delft Blue
      tintFg: '#1B2A55',
      progressPct: costsPct,
    },
    {
      href: `/trips/${tripSlug}/weather`,
      label: 'Weather',
      preview: weatherPreview,
      Icon: CloudSun,
      tintBg: 'rgba(62, 155, 212, 0.14)',   // bright blue
      tintFg: '#2E86C9',
    },
    {
      href: `/trips/${tripSlug}/local`,
      label: 'Local Info',
      preview: localPreview,
      Icon: Globe2,
      tintBg: 'rgba(240, 128, 128, 0.14)',  // Light Coral accent
      tintFg: '#E06A6A',
    },
    {
      href: `/trips/${tripSlug}/documents`,
      label: 'Documents',
      preview: documentsPreview,
      Icon: Folder,
      tintBg: 'rgba(14, 92, 134, 0.12)',    // deep teal-blue
      tintFg: '#0E5C86',
    },
    {
      href: `/trips/${tripSlug}/checklist`,
      label: 'Packing Assist',
      preview: packingPreview,
      Icon: ListChecks,
      tintBg: 'rgba(199, 93, 93, 0.12)',    // deep coral
      tintFg: '#C75D5D',
      progressPct: packingPct,
    },
    {
      href: `/trips/${tripSlug}/inbox`,
      label: 'Forward bookings',
      preview: inboxPreview,
      Icon: Mail,
      tintBg: 'rgba(90, 113, 150, 0.12)',   // slate blue
      tintFg: '#5A7196',
    },
    {
      href: `/trips/${tripSlug}/settings`,
      label: 'Trip settings',
      preview: settingsPreview,
      Icon: SettingsIcon,
      tintBg: 'rgba(72, 86, 111, 0.12)',    // slate
      tintFg: '#48566F',
    },
  ]

  // Pad to 10 slots so the grid always renders as 5 across × 2 down.
  // Placeholders are dashed empty cells — "more coming" rather than
  // ragged trailing whitespace.
  const SLOT_COUNT = 10
  const placeholders = Math.max(0, SLOT_COUNT - tiles.length)

  return (
    <div className="px-5 sm:px-10 pt-8 sm:pt-10 pb-10 sm:pb-12">
      {/* mx-auto centres the capped grid in the viewport so on wide
          screens the tiles sit in the middle of the page rather than
          hugging the left edge under the full-bleed hero above. */}
      <div className="max-w-5xl mx-auto">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-4 sm:mb-5">
          Trip
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          {tiles.map(({ href, label, preview, Icon, tintBg, tintFg, progressPct }) => (
            <Link
              key={href}
              href={href}
              className="group relative block rounded-2xl border border-line bg-paper-pure p-3 sm:p-4 hover:border-sage hover:shadow-lift transition aspect-[5/4] flex flex-col"
            >
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl grid place-items-center shrink-0"
                style={{ background: tintBg }}
                aria-hidden
              >
                <Icon
                  className="w-6 h-6 sm:w-7 sm:h-7"
                  style={{ color: tintFg }}
                />
              </div>

              <div className="mt-auto">
                {typeof progressPct === 'number' && (
                  <div className="mb-2">
                    <div className="h-1 rounded-full bg-line-soft overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(0, Math.min(100, progressPct))}%`,
                          background: tintFg,
                        }}
                        aria-hidden
                      />
                    </div>
                  </div>
                )}

                <h3 className="font-display text-sm sm:text-base leading-tight">{label}</h3>
                <p className="text-[10px] sm:text-[11px] text-ink-muted mt-1 truncate">
                  {preview}
                </p>
              </div>
            </Link>
          ))}

          {/* Placeholder slots — same shape, dashed outline, faint plus
              glyph in the centre. Not clickable yet; they communicate
              "more features will land here" so the 8-tile row doesn't
              read as a ragged unfinished composition. */}
          {Array.from({ length: placeholders }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              className="rounded-2xl border border-dashed border-line/70 aspect-[5/4] grid place-items-center"
              aria-hidden
            >
              <Plus className="w-5 h-5 text-ink-muted/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
