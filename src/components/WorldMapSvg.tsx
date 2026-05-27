import {
  COUNTRY_PATHS, ATLAS_VIEW_WIDTH, ATLAS_VIEW_HEIGHT,
  UPCOMING_ONLY_FILL, UNVISITED_FILL, LIVED_EDGE_COLOR,
  type AtlasTierSpec,
} from '@/lib/atlas'

const COUNTRY_STROKE = '#FBF8F1'

/**
 * Server component that renders the world map SVG. Used by both the
 * /atlas overview page and the /atlas/map full-screen route. Country
 * polygons act as in-page anchors when `anchorPrefix` is provided —
 * useful on /atlas where each polygon links to its card below the map.
 */
export type RenderHints = Map<
  string,
  { tier: AtlasTierSpec | null; upcomingOnly: boolean }
>

export function WorldMapSvg({
  renderHints, className, anchorPrefix, ariaLabel,
}: {
  renderHints: RenderHints
  className?: string
  anchorPrefix?: string
  ariaLabel?: string
}) {
  return (
    <svg
      // Crop the empty polar / high-ocean bands top and bottom — gives the
      // SVG a ~2.33:1 aspect ratio, much closer to a landscape phone's
      // viewport (~2.17:1) so the full-screen route fills the screen with
      // minimal letterboxing when the user rotates their phone.
      viewBox={`0 30 ${ATLAS_VIEW_WIDTH} ${ATLAS_VIEW_HEIGHT - 60}`}
      className={className}
      role="img"
      aria-label={ariaLabel ?? 'World map highlighting countries you have trips in'}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern
          id="hatch-upcoming"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill="#A8B7AE" />
          <rect width="3" height="6" fill="#3F5B4E" />
        </pattern>
      </defs>

      <rect width={ATLAS_VIEW_WIDTH} height={ATLAS_VIEW_HEIGHT} fill="#F4EFE3" />

      {COUNTRY_PATHS.map((c) => {
        const hint = renderHints.get(c.id)
        const fill = hint?.tier
          ? hint.tier.mapFill
          : hint?.upcomingOnly
            ? UPCOMING_ONLY_FILL
            : UNVISITED_FILL
        const stroke = hint?.tier?.isLived ? LIVED_EDGE_COLOR : COUNTRY_STROKE
        const strokeWidth = hint?.tier?.isLived ? 1.4 : 0.5

        const path = (
          <path key={c.id} d={c.d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        )
        if (!hint || !anchorPrefix) return path
        return (
          <a key={c.id} href={`${anchorPrefix}${c.id}`} aria-label={`${c.name} — jump to trip card`}>
            {path}
          </a>
        )
      })}
    </svg>
  )
}
