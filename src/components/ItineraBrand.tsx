/**
 * Itinera brand mark — wordmark-only (Option E): the name set in Fraunces,
 * deep umber, finished with a spinifex-sage full stop. No pictorial mark.
 *
 *   <ItineraBrand />                  →  "Itinera." wordmark, default size
 *   <ItineraBrand size="xl" />        →  larger for the welcome hero
 *   <ItineraBrand wordmark={false} /> →  compact "I." monogram (icon slot)
 *   <ItineraBrand invert />           →  white wordmark for dark backgrounds
 */

export const ITINERA_INK = '#33241B'      // Deep umber — wordmark
export const ITINERA_ACCENT = '#8F9A66'   // Spinifex sage — the full stop

export function ItineraBrand({
  size = 'md',
  wordmark = true,
  invert = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  wordmark?: boolean
  invert?: boolean
  className?: string
}) {
  const textClass = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-5xl',
    xl: 'text-7xl',
  }[size]

  const wordmarkColor = invert ? '#FFFFFF' : ITINERA_INK

  // Icon-only slots get a compact "I." monogram in the same style.
  const label = wordmark ? 'Itinera' : 'I'

  return (
    <span
      className={`font-display ${textClass} leading-none tracking-tight ${className ?? ''}`}
      style={{ color: wordmarkColor }}
      aria-label="Itinera"
    >
      {label}
      <span style={{ color: ITINERA_ACCENT }}>.</span>
    </span>
  )
}
