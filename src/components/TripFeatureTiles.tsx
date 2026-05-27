import Link from 'next/link'
import {
  CalendarDays, Wallet, CloudSun, Globe2, Folder, ListChecks,
  Mail, Settings as SettingsIcon,
} from 'lucide-react'

/**
 * App-launcher grid — the entire navigation surface for a trip.
 *
 * Each tile is a solid-coloured "app icon" square (no paper wrapper) with
 * the icon centred on top, and the label + preview stacked underneath the
 * card the way an iPhone home screen lays out app names beneath icons.
 * Eight tiles, six core features + two utilities:
 *   Itinerary · Costs · Weather · Local Info ·
 *   Documents · Packing · Forward bookings · Trip settings.
 *
 * Two tiles (Costs, Packing) carry a progress strip across the bottom
 * edge of the card — a thin cream bar that fills the otherwise-empty
 * lower band with a piece of glanceable progress info.
 *
 * Tints reuse the existing palette (sage gradient + gold + terracotta +
 * burgundy + taupes) so the row reads as one composed family rather
 * than iOS rainbow tiles.
 */

type TileSpec = {
  href: string
  label: string
  preview: string
  Icon: typeof CalendarDays
  /** Solid colour for the entire card. */
  color: string
  /** Optional 0–100 progress value. When set, a thin cream bar runs
   *  across the bottom inside edge of the card. Used for Costs (% paid)
   *  and Packing Assist (% items done). */
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
      color: '#3F5B4E',   // deep sage
    },
    {
      href: `/trips/${tripSlug}/costs`,
      label: 'Costs & Payments',
      preview: costsPreview,
      Icon: Wallet,
      color: '#A8814B',   // gold
      progressPct: costsPct,
    },
    {
      href: `/trips/${tripSlug}/weather`,
      label: 'Weather',
      preview: weatherPreview,
      Icon: CloudSun,
      color: '#7A9387',   // mid sage
    },
    {
      href: `/trips/${tripSlug}/local`,
      label: 'Local Info',
      preview: localPreview,
      Icon: Globe2,
      color: '#C66B47',   // terracotta (brand)
    },
    {
      href: `/trips/${tripSlug}/documents`,
      label: 'Documents',
      preview: documentsPreview,
      Icon: Folder,
      color: '#243730',   // deepest sage
    },
    {
      href: `/trips/${tripSlug}/checklist`,
      label: 'Packing Assist',
      preview: packingPreview,
      Icon: ListChecks,
      color: '#6B2737',   // burgundy (matches Home tier)
      progressPct: packingPct,
    },
    {
      href: `/trips/${tripSlug}/inbox`,
      label: 'Forward bookings',
      preview: inboxPreview,
      Icon: Mail,
      color: '#5C4938',   // warm taupe
    },
    {
      href: `/trips/${tripSlug}/settings`,
      label: 'Trip settings',
      preview: settingsPreview,
      Icon: SettingsIcon,
      color: '#52525B',   // cool taupe
    },
  ]

  return (
    <div className="px-5 sm:px-10 pt-8 sm:pt-10 pb-10 sm:pb-12">
      {/* Cap the grid at a comfortable width so on big monitors the
          app icons don't balloon. ~1024px keeps each tile ≈ 220px square,
          which is where the icon-as-card design feels best. */}
      <div className="max-w-5xl">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-4 sm:mb-5">
          Trip
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-7">
          {tiles.map(({ href, label, preview, Icon, color, progressPct }) => (
            <Link key={href} href={href} className="group block">
              {/* The "app icon" — a solid-colour square that IS the tile.
                  Subtle inset highlight on top + inset shadow on bottom give
                  the surface a slight dimension so it doesn't read flat. */}
              <div
                className="relative aspect-square rounded-3xl overflow-hidden grid place-items-center transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lift"
                style={{
                  background: color,
                  boxShadow:
                    'inset 0 1px 0 rgba(255, 255, 255, 0.16), ' +
                    'inset 0 -1px 0 rgba(0, 0, 0, 0.12), ' +
                    '0 1px 2px rgba(0, 0, 0, 0.08)',
                }}
              >
                <Icon
                  className="w-12 h-12 sm:w-16 sm:h-16 text-paper-pure"
                  strokeWidth={1.5}
                  aria-hidden
                />

                {/* Progress strip — only when the tile has a real %. Cream
                    track on the colour, with a brighter cream fill. Reads
                    as part of the icon's surface, not a separate widget. */}
                {typeof progressPct === 'number' && (
                  <div className="absolute inset-x-4 bottom-4 h-1 rounded-full bg-paper-pure/25 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-paper-pure transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
                      aria-hidden
                    />
                  </div>
                )}
              </div>

              {/* Label + preview sit *under* the card, like app names on a
                  home screen. Center-aligned so they read as captions to
                  the square above. */}
              <div className="mt-2.5 sm:mt-3 text-center px-1">
                <h3 className="font-display text-sm sm:text-base leading-tight text-ink group-hover:text-sage transition">
                  {label}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-ink-muted mt-0.5 truncate">
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
