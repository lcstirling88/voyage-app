import { Globe, Map, Compass, Plane, Crown, MapPin } from 'lucide-react'
import { tierForCountryCount } from '@/lib/atlas'

/**
 * Small medallion-style badge showing the user's "breadth of travel" tier
 * based on how many distinct countries they've visited. Slots into the
 * Countries Visited stat card on the profile page, sitting beside the
 * big number like an achievement crest on a passport.
 *
 * Tier ladder lives in lib/atlas (tierForCountryCount). Reuses the
 * existing palette (sage gradient + gold + burgundy) so the badge feels
 * like part of the same world as the atlas tier system, not a tacked-on
 * gamification widget.
 */

const ICONS = {
  pin: MapPin,
  plane: Plane,
  compass: Compass,
  map: Map,
  globe: Globe,
  crown: Crown,
} as const

export function CountriesBadge({ count }: { count: number }) {
  const tier = tierForCountryCount(count)
  const Icon = ICONS[tier.icon]

  return (
    <div className="flex flex-col items-center text-center shrink-0">
      <div
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full grid place-items-center"
        style={{
          background: tier.color,
          // Coin-like depth: inner highlight + soft drop shadow.
          boxShadow:
            'inset 0 0 0 2px rgba(255, 255, 255, 0.22), ' +
            'inset 0 -2px 4px rgba(0, 0, 0, 0.18), ' +
            '0 2px 6px -1px rgba(0, 0, 0, 0.18)',
        }}
        aria-hidden
      >
        <Icon className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: tier.iconColor }} />
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-ink font-medium">
        {tier.label}
      </div>
      <div className="text-[9px] uppercase tracking-[0.18em] text-ink-muted/70 mt-0.5">
        {tier.rangeLabel}
      </div>
    </div>
  )
}
