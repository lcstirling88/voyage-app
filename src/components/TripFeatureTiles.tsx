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
 *  - Progress strip still lives on Costs + Packing tiles (sienna + rust
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
      tintBg: 'rgba(181, 99, 60, 0.10)',    // Terracotta
      tintFg: '#B5633C',
    },
    {
      href: `/trips/${tripSlug}/costs`,
      label: 'Costs & Payments',
      preview: costsPreview,
      Icon: Wallet,
      tintBg: 'rgba(110, 58, 40, 0.10)',    // Burnt sienna
      tintFg: '#6E3A28',
      progressPct: costsPct,
    },
    {
      href: `/trips/${tripSlug}/weather`,
      label: 'Weather',
      preview: weatherPreview,
      Icon: CloudSun,
      tintBg: 'rgba(194, 133, 60, 0.16)',   // Desert ochre
      tintFg: '#B57A2E',
    },
    {
      href: `/trips/${tripSlug}/local`,
      label: 'Local Info',
      preview: localPreview,
      Icon: Globe2,
      tintBg: 'rgba(143, 154, 102, 0.16)',  // Spinifex sage
      tintFg: '#6F7A4A',
    },
    {
      href: `/trips/${tripSlug}/documents`,
      label: 'Documents',
      preview: documentsPreview,
      Icon: Folder,
      tintBg: 'rgba(162, 97, 58, 0.12)',    // Clay
      tintFg: '#A2613A',
    },
    {
      href: `/trips/${tripSlug}/checklist`,
      label: 'Packing Assist',
      preview: packingPreview,
      Icon: ListChecks,
      tintBg: 'rgba(188, 90, 68, 0.12)',    // Rust
      tintFg: '#BC5A44',
      progressPct: packingPct,
    },
    {
      href: `/trips/${tripSlug}/inbox`,
      label: 'Emails',
      preview: inboxPreview,
      Icon: Mail,
      tintBg: 'rgba(138, 122, 78, 0.14)',   // Dry grass
      tintFg: '#8A7A4E',
    },
    {
      href: `/trips/${tripSlug}/settings`,
      label: 'Trip settings',
      preview: settingsPreview,
      Icon: SettingsIcon,
      tintBg: 'rgba(122, 99, 83, 0.12)',    // Taupe stone
      tintFg: '#7A6353',
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
