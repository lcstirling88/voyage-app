/**
 * Itinera brand mark. Two filled dots (origin + destination) connected by a
 * hand-drawn arc — a journey from A to B, rendered as a single inline SVG.
 *
 * Use cases:
 *   <ItineraBrand />                     →  mark + wordmark, default size
 *   <ItineraBrand size="lg" />           →  larger for the welcome hero
 *   <ItineraBrand wordmark={false} />    →  just the dot-arc mark
 *
 * The brand colour (terracotta-ish, evoking the Latin/Italian roots of the
 * name) is hard-coded as a CSS variable below so it stays consistent
 * everywhere the brand mark appears without depending on the existing
 * sage/gold theme tokens.
 */

export const ITINERA_BRAND_COLOR = '#C66B47'    // terracotta — primary brand accent
export const ITINERA_INK = '#1A1A2E'             // deep midnight for the wordmark

export function ItineraBrand({
  size = 'md',
  wordmark = true,
  invert = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  wordmark?: boolean
  /** Inverted variant: white wordmark for dark backgrounds. Mark stays terracotta. */
  invert?: boolean
  className?: string
}) {
  // Tuned proportions for each size; the mark scales with the wordmark text.
  const dimensions = {
    sm: { svgW: 36, svgH: 14, text: 'text-lg', gap: 'gap-2' },
    md: { svgW: 56, svgH: 22, text: 'text-2xl', gap: 'gap-2.5' },
    lg: { svgW: 96, svgH: 36, text: 'text-5xl', gap: 'gap-4' },
    xl: { svgW: 140, svgH: 52, text: 'text-7xl', gap: 'gap-5' },
  }[size]

  const wordmarkColor = invert ? '#FBF8F1' : ITINERA_INK

  return (
    <div className={`inline-flex items-center ${dimensions.gap} ${className ?? ''}`}>
      <svg
        viewBox="0 0 60 24"
        width={dimensions.svgW}
        height={dimensions.svgH}
        aria-label="Itinera"
        className="shrink-0"
      >
        {/* Arc — slightly asymmetric, like a flight path on a map */}
        <path
          d="M 6 18 Q 30 -2 54 18"
          stroke={ITINERA_BRAND_COLOR}
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        {/* Origin dot */}
        <circle cx="6" cy="18" r="3.2" fill={ITINERA_BRAND_COLOR} />
        {/* Destination dot — a touch larger, slight glow effect via inner highlight */}
        <circle cx="54" cy="18" r="3.6" fill={ITINERA_BRAND_COLOR} />
      </svg>
      {wordmark && (
        <span
          className={`font-display ${dimensions.text} leading-none tracking-tight`}
          style={{ color: wordmarkColor }}
        >
          Itinera
        </span>
      )}
    </div>
  )
}
