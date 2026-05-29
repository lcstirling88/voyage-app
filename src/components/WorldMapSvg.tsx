import {
  COUNTRY_PATHS, ATLAS_VIEW_WIDTH, ATLAS_VIEW_HEIGHT,
  UPCOMING_ONLY_FILL, UNVISITED_FILL, LIVED_EDGE_COLOR, HOME_FILL,
  type AtlasRenderHint,
} from '@/lib/atlas'

const COUNTRY_STROKE = '#FFFFFF'

/**
 * Server component that renders the world map SVG. Used by both the
 * /atlas overview page and the /atlas/map full-screen route. Country
 * polygons act as in-page anchors when `anchorPrefix` is provided —
 * useful on /atlas where each polygon links to its card below the map.
 */
export type RenderHints = Map<string, AtlasRenderHint>

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
      // Show the full projection bounds — Equal Earth uses the entire vertical
      // band for actual land (incl. northern Canada and Antarctica), unlike
      // Natural Earth which had empty polar caps we could crop.
      viewBox={`0 0 ${ATLAS_VIEW_WIDTH} ${ATLAS_VIEW_HEIGHT}`}
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
          <rect width="6" height="6" fill="#C3CAD2" />
          <rect width="3" height="6" fill="#6E7682" />
        </pattern>
      </defs>

      <rect width={ATLAS_VIEW_WIDTH} height={ATLAS_VIEW_HEIGHT} fill="#F2F4F6" />

      {COUNTRY_PATHS.map((c) => {
        const hint = renderHints.get(c.id)
        // Home wins over any tier — burgundy regardless of trip aggregations.
        const fill = hint?.home
          ? HOME_FILL
          : hint?.tier
            ? hint.tier.mapFill
            : hint?.upcomingOnly
              ? UPCOMING_ONLY_FILL
              : UNVISITED_FILL
        const prominent = hint?.home || hint?.tier?.isLived
        const stroke = prominent ? LIVED_EDGE_COLOR : COUNTRY_STROKE
        const strokeWidth = prominent ? 1.4 : 0.5

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
