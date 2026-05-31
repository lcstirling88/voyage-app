/**
 * Street-level geocoding + slippy-map maths for the per-day itinerary maps.
 *
 * We turn a booking's address into coordinates with OpenStreetMap's Nominatim
 * service (free, no API key) and render a static map by stitching raw OSM tiles
 * — no mapping library, no paid tiles. The browser calls Nominatim directly,
 * one request at a time (see the global queue below), so the load comes from
 * the user's own IP and stays comfortably within OSM's usage policy. Resolved
 * coordinates are persisted back onto the Booking (see cacheBookingGeo in
 * lib/actions) so the same address is never geocoded twice.
 *
 * This module is imported by a client component, so it stays pure/isomorphic —
 * no server-only imports.
 */

export type GeoPoint = { lat: number; lng: number }

const TILE = 256

// ---- Web-Mercator projection (slippy map) -------------------------------------------

/** Longitude → global pixel X at zoom z (world is 256·2^z px wide). */
export function lngToGlobalX(lng: number, z: number): number {
  return ((lng + 180) / 360) * TILE * 2 ** z
}

/** Latitude → global pixel Y at zoom z (Y grows southward). */
export function latToGlobalY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2
  return y * TILE * 2 ** z
}

export type MapTile = { x: number; y: number; left: number; top: number }

export type MapLayout = {
  zoom: number
  /** Tiles covering the square; left/top are px offsets within a `size`×`size` box. */
  tiles: MapTile[]
  /** Project a coordinate to px within the same `size`×`size` box. */
  project: (p: GeoPoint) => { x: number; y: number }
}

/**
 * Fit all points inside a `size`×`size` px square: pick the highest zoom at
 * which their bounding box still fits (with padding), centre on it, and list
 * the OSM tiles that cover the square plus a projector for the markers.
 */
export function computeMapLayout(
  points: GeoPoint[],
  size: number,
  opts?: { padding?: number; maxZoom?: number; minZoom?: number; singleZoom?: number },
): MapLayout | null {
  if (points.length === 0) return null
  const pad = opts?.padding ?? 44
  const maxZoom = opts?.maxZoom ?? 17
  const minZoom = opts?.minZoom ?? 2

  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)

  let zoom: number
  if (points.length === 1 || (minLat === maxLat && minLng === maxLng)) {
    zoom = opts?.singleZoom ?? 15
  } else {
    const usable = Math.max(1, size - pad * 2)
    zoom = minZoom // fallback: most zoomed-out if the span is huge
    for (let z = maxZoom; z >= minZoom; z--) {
      const w = lngToGlobalX(maxLng, z) - lngToGlobalX(minLng, z)
      const h = latToGlobalY(minLat, z) - latToGlobalY(maxLat, z)
      if (w <= usable && h <= usable) { zoom = z; break }
    }
  }

  const z = zoom
  const cx = lngToGlobalX((minLng + maxLng) / 2, z)
  const cy = latToGlobalY((minLat + maxLat) / 2, z)
  const originX = cx - size / 2 // global px at the square's left edge
  const originY = cy - size / 2 // global px at the square's top edge

  const project = (p: GeoPoint) => ({
    x: lngToGlobalX(p.lng, z) - originX,
    y: latToGlobalY(p.lat, z) - originY,
  })

  const nTiles = 2 ** z
  const tiles: MapTile[] = []
  for (let tx = Math.floor(originX / TILE); tx <= Math.floor((originX + size) / TILE); tx++) {
    for (let ty = Math.floor(originY / TILE); ty <= Math.floor((originY + size) / TILE); ty++) {
      if (ty < 0 || ty >= nTiles) continue // no tiles past the poles
      tiles.push({
        x: ((tx % nTiles) + nTiles) % nTiles, // wrap longitude at the antimeridian
        y: ty,
        left: tx * TILE - originX,
        top: ty * TILE - originY,
      })
    }
  }

  return { zoom: z, tiles, project }
}

/** OSM standard tile URL. */
export function tileUrl(x: number, y: number, z: number): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
}

// ---- Geocoding query builder --------------------------------------------------------

/**
 * Build the most precise geocoding query we can for a booking: its full address
 * if present, else its location, else the venue name + city. The trip country is
 * appended as a bias when the text doesn't already name it.
 */
export function geocodeQuery(input: {
  address?: string | null
  location?: string | null
  title?: string | null
  country?: string | null
}): string | null {
  let q = (input.address?.trim() || input.location?.trim() || '')
  if (!q && input.title?.trim()) {
    q = [input.title.trim(), input.location?.trim()].filter(Boolean).join(', ')
  }
  if (!q) return null
  const country = input.country?.trim()
  if (country) {
    const safe = country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!new RegExp(`\\b${safe}\\b`, 'i').test(q)) q = `${q}, ${country}`
  }
  return q
}

// ---- Nominatim geocoding (browser-side, globally throttled) --------------------------

/** Geocode one query via Nominatim. Returns null on any failure. */
export async function geocodeViaNominatim(query: string): Promise<GeoPoint | null> {
  if (!query.trim()) return null
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    const hit = Array.isArray(data) ? data[0] : null
    if (!hit) return null
    const lat = parseFloat(hit.lat)
    const lng = parseFloat(hit.lon)
    if (!isFinite(lat) || !isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

// Serialise every geocode on the page through one chain with a ~1s spacing, so
// no matter how many day-maps mount at once we never exceed OSM's 1-request-per-
// second policy.
let geoChain: Promise<unknown> = Promise.resolve()
let lastGeoAt = 0

export function queuedGeocode(query: string): Promise<GeoPoint | null> {
  const run = geoChain.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastGeoAt))
    if (wait) await new Promise((r) => setTimeout(r, wait))
    lastGeoAt = Date.now()
    return geocodeViaNominatim(query)
  })
  geoChain = run.catch(() => {})
  return run
}

// ---- Google Maps directions link ----------------------------------------------------

function approxSpanKm(pts: GeoPoint[]): number {
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng)
  const midLat = (Math.max(...lats) + Math.min(...lats)) / 2
  const kmLat = (Math.max(...lats) - Math.min(...lats)) * 111
  const kmLng = (Math.max(...lngs) - Math.min(...lngs)) * 111 * Math.cos((midLat * Math.PI) / 180)
  return Math.sqrt(kmLat * kmLat + kmLng * kmLng)
}

/**
 * Google Maps directions URL chaining the day's stops in order. Uses precise
 * coordinates where we have them, else the raw address text (Google geocodes
 * it), so the link works even before our own geocoding has run. Walking for a
 * tight cluster, driving once the day spreads beyond ~3 km.
 */
export function googleMapsDirectionsUrl(
  stops: Array<{ point?: GeoPoint | null; query?: string | null }>,
): string | null {
  const usable = stops.filter((s) => s.point || (s.query && s.query.trim()))
  if (usable.length === 0) return null
  const toParam = (s: (typeof usable)[number]) =>
    s.point ? `${s.point.lat},${s.point.lng}` : (s.query as string)

  if (usable.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(toParam(usable[0]))}`
  }

  const pts = usable.map((s) => s.point).filter((p): p is GeoPoint => Boolean(p))
  const mode = pts.length >= 2 && approxSpanKm(pts) > 3 ? 'driving' : 'walking'

  const params = new URLSearchParams({
    api: '1',
    origin: toParam(usable[0]),
    destination: toParam(usable[usable.length - 1]),
    travelmode: mode,
  })
  const waypoints = usable.slice(1, -1).map(toParam)
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
