import Link from 'next/link'
import {
  CalendarDays, Wallet, CloudSun, Globe2, Folder, ListChecks,
  Mail, Settings as SettingsIcon, ArrowUpRight,
} from 'lucide-react'

/**
 * App-launcher grid — the entire navigation surface for a trip. Eight
 * tiles replacing the old left-rail sidebar: six core features
 * (Itinerary / Costs / Weather / Local Info / Documents / Packing) plus
 * two utility tiles (Forward bookings / Trip settings) that used to live
 * in the sidebar footer.
 *
 * Each tile carries a live one-line stat preview so the grid functions
 * like a row of app widgets, not just labelled buttons. Icon tints reuse
 * the existing palette (sage gradient + gold + terracotta + burgundy)
 * so the row reads as one composed family rather than iOS rainbow tiles.
 */

type TileSpec = {
  href: string
  label: string
  preview: string
  Icon: typeof CalendarDays
  /** Background tint for the icon square. Light wash of the accent. */
  tintBg: string
  /** Solid accent colour for the icon glyph itself. Also used as the
   *  fill colour of the progress bar when `progressPct` is set. */
  tintFg: string
  /** Optional 0–100 progress value. When set, the tile renders a thin
   *  horizontal bar above the title. Used for Costs (% paid) and Packing
   *  Assist (% items done) — fills the otherwise empty mid-card space
   *  with a piece of useful at-a-glance information. */
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
      tintBg: 'rgba(63, 91, 78, 0.10)',   // deep sage wash
      tintFg: '#3F5B4E',
    },
    {
      href: `/trips/${tripSlug}/costs`,
      label: 'Costs & Payments',
      preview: costsPreview,
      Icon: Wallet,
      tintBg: 'rgba(168, 129, 75, 0.14)', // gold wash
      tintFg: '#A8814B',
      progressPct: costsPct,
    },
    {
      href: `/trips/${tripSlug}/weather`,
      label: 'Weather',
      preview: weatherPreview,
      Icon: CloudSun,
      tintBg: 'rgba(122, 147, 135, 0.16)', // mid sage wash
      tintFg: '#7A9387',
    },
    {
      href: `/trips/${tripSlug}/local`,
      label: 'Local Info',
      preview: localPreview,
      Icon: Globe2,
      tintBg: 'rgba(198, 107, 71, 0.12)', // terracotta wash (brand)
      tintFg: '#C66B47',
    },
    {
      href: `/trips/${tripSlug}/documents`,
      label: 'Documents',
      preview: documentsPreview,
      Icon: Folder,
      tintBg: 'rgba(36, 55, 48, 0.12)',  // deepest sage wash
      tintFg: '#243730',
    },
    {
      href: `/trips/${tripSlug}/checklist`,
      label: 'Packing Assist',
      preview: packingPreview,
      Icon: ListChecks,
      tintBg: 'rgba(107, 39, 55, 0.10)', // burgundy wash (matches Home tier)
      tintFg: '#6B2737',
      progressPct: packingPct,
    },
    {
      href: `/trips/${tripSlug}/inbox`,
      label: 'Forward bookings',
      preview: inboxPreview,
      Icon: Mail,
      tintBg: 'rgba(92, 73, 56, 0.10)',  // warm taupe wash — utility neutral
      tintFg: '#5C4938',
    },
    {
      href: `/trips/${tripSlug}/settings`,
      label: 'Trip settings',
      preview: settingsPreview,
      Icon: SettingsIcon,
      tintBg: 'rgba(101, 101, 110, 0.10)', // cool taupe wash — utility neutral
      tintFg: '#52525B',
    },
  ]

  return (
    <div className="px-5 sm:px-10 pt-8 sm:pt-10 pb-10 sm:pb-12">
      {/* Cap the grid at a comfortable reading width so on a 1920px monitor
          the tiles don't balloon into vacant rectangles. ~1024px keeps each
          desktop tile around 240px — close to the size that feels right on
          mobile. */}
      <div className="max-w-5xl">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-3 sm:mb-4">
          Trip
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {tiles.map(({ href, label, preview, Icon, tintBg, tintFg, progressPct }) => (
            <Link
              key={href}
              href={href}
              className="group relative block rounded-2xl border border-line bg-paper-pure p-4 sm:p-5 hover:border-sage hover:shadow-lift transition aspect-[5/4] flex flex-col"
            >
              <div
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl grid place-items-center shrink-0"
                style={{ background: tintBg }}
                aria-hidden
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: tintFg }} />
              </div>

              <ArrowUpRight
                className="absolute top-4 right-4 sm:top-5 sm:right-5 w-4 h-4 text-ink-muted/30 group-hover:text-sage transition"
                aria-hidden
              />

              <div className="mt-auto">
                {/* Thin progress bar — only on tiles where we have a real %.
                    Fills the otherwise empty mid-card space with a
                    glanceable piece of info, tinted with the tile's accent. */}
                {typeof progressPct === 'number' && (
                  <div className="mb-2 sm:mb-2.5">
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

                <h3 className="font-display text-base sm:text-lg leading-tight">{label}</h3>
                <p className="text-[11px] sm:text-xs text-ink-muted mt-1 truncate">
                  {preview}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
