'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, ArrowUpRight } from 'lucide-react'
import {
  computeMapLayout, tileUrl, queuedGeocode, googleMapsDirectionsUrl,
  type GeoPoint,
} from '@/lib/geocode'
import { cacheBookingGeo } from '@/lib/actions'

/** One located stop on a day's map, in chronological order. */
export type DayMapStop = {
  bookingId: string
  n: number             // 1-based order number
  label: string         // short label for the legend
  kind: string          // booking type
  query: string | null  // geocoding query (null → can't be placed)
  point: GeoPoint | null // coordinates already cached server-side, if any
}

// Logical coordinate space for the square. The map renders resolution-
// independently: tiles are positioned in % of this size and the marker overlay
// uses an SVG viewBox, so the same layout scales to whatever width it's given.
const SIZE = 320

export function DayMapClient({ tripSlug, stops }: { tripSlug: string; stops: DayMapStop[] }) {
  const placeable = useMemo(() => stops.filter((s) => s.query), [stops])

  // Coordinates by bookingId, seeded with whatever the server already had cached.
  const [coords, setCoords] = useState<Record<string, GeoPoint>>(() => {
    const seed: Record<string, GeoPoint> = {}
    for (const s of stops) if (s.point) seed[s.bookingId] = s.point
    return seed
  })
  const started = useRef(false)

  // Lazily geocode the stops we don't yet have coordinates for. The shared queue
  // in lib/geocode keeps this to ~1 request/second across every map on the page.
  useEffect(() => {
    if (started.current) return
    started.current = true
    const missing = placeable.filter((s) => !coords[s.bookingId])
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const s of missing) {
        if (cancelled) return
        const pt = await queuedGeocode(s.query as string)
        if (cancelled) return
        if (pt) {
          setCoords((prev) => ({ ...prev, [s.bookingId]: pt }))
          // Persist so we never geocode this address again (best-effort).
          cacheBookingGeo({
            tripSlug, bookingId: s.bookingId, lat: pt.lat, lng: pt.lng, q: s.query as string,
          }).catch(() => {})
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const located = useMemo(
    () =>
      placeable
        .map((s) => ({ ...s, pt: coords[s.bookingId] ?? null }))
        .filter((s): s is DayMapStop & { pt: GeoPoint } => Boolean(s.pt)),
    [placeable, coords],
  )

  const layout = useMemo(
    () => computeMapLayout(located.map((s) => s.pt), SIZE),
    [located],
  )

  const mapsUrl = useMemo(
    () => googleMapsDirectionsUrl(placeable.map((s) => ({ point: coords[s.bookingId] ?? null, query: s.query }))),
    [placeable, coords],
  )

  if (placeable.length === 0) return null

  const resolving = located.length < placeable.length
  const pct = (v: number) => `${(v / SIZE) * 100}%`

  return (
    <div className="mb-5">
      <a
        href={mapsUrl ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open this day's route in Google Maps"
        className="group relative block w-full max-w-[320px] aspect-square rounded-xl overflow-hidden border border-line bg-paper shadow-soft"
      >
        {/* Tile layer — stitched OSM tiles, lightly toned to match the palette */}
        {layout ? (
          <div
            className="absolute inset-0"
            style={{ filter: 'saturate(0.9) contrast(1.03) brightness(1.02)' }}
          >
            {layout.tiles.map((t) => (
              // eslint-disable-next-line @next/next/no-img-element -- raw OSM tiles, next/image can't proxy these
              <img
                key={`${layout.zoom}-${t.x}-${t.y}`}
                src={tileUrl(t.x, t.y, layout.zoom)}
                alt=""
                loading="lazy"
                draggable={false}
                className="absolute select-none max-w-none"
                style={{ left: pct(t.left), top: pct(t.top), width: pct(256), height: pct(256) }}
              />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-ink-muted/40">
            <MapPin className="w-6 h-6 animate-pulse" />
          </div>
        )}

        {/* Marker overlay — route line + numbered pins, scaled via viewBox */}
        {layout && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            aria-hidden
          >
            {located.length > 1 && (
              <polyline
                points={located.map((s) => { const p = layout.project(s.pt); return `${p.x},${p.y}` }).join(' ')}
                fill="none"
                stroke="var(--color-ink)"
                strokeOpacity={0.5}
                strokeWidth={2}
                strokeDasharray="1 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {located.map((s) => {
              const p = layout.project(s.pt)
              return (
                <g key={s.bookingId} transform={`translate(${p.x}, ${p.y})`}>
                  <circle r={11} fill="var(--color-sage)" stroke="white" strokeWidth={2.5} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="white">
                    {s.n}
                  </text>
                </g>
              )
            })}
          </svg>
        )}

        {/* Corner affordance */}
        <div className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md bg-paper-pure/90 backdrop-blur px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-ink shadow-soft opacity-90 group-hover:opacity-100 transition">
          <ArrowUpRight className="w-3 h-3" /> Directions
        </div>

        {resolving && (
          <div className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-md bg-paper-pure/90 px-2 py-1 text-[10px] text-ink-muted">
            <MapPin className="w-3 h-3 animate-pulse" /> Locating…
          </div>
        )}
      </a>

      {/* Legend — numbers map to stops; greyed until a stop resolves */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted max-w-[320px]">
        {placeable.map((s) => (
          <span key={s.bookingId} className="inline-flex items-center gap-1 min-w-0">
            <span
              className={`inline-grid place-items-center w-4 h-4 rounded-full text-[9px] font-semibold shrink-0 ${
                coords[s.bookingId] ? 'bg-sage text-white' : 'bg-line text-ink-muted'
              }`}
            >
              {s.n}
            </span>
            <span className="truncate max-w-[150px]">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
