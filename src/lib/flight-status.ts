/**
 * Live flight status via AviationStack — optional, free-tier friendly.
 *
 * The free AviationStack plan is intentionally stingy: 100 requests / month,
 * HTTP only (no TLS), and real-time data only (no far-future schedules). So the
 * whole module is built around *not* calling the API unless it's actually worth
 * it:
 *
 *   1. No key set            → we never call out; the UI shows the booked
 *                              details and a one-line "connect live tracking"
 *                              nudge. Everything degrades gracefully.
 *   2. Flight not near today  → we skip the call. Live status for a flight three
 *                              months away is both useless and unavailable on
 *                              the free tier, so we gate on a travel-day window.
 *   3. On / around travel day → we hit the API and hard-cache the result in
 *                              Next's data cache for STATUS_TTL_SECONDS, so
 *                              repeated page loads cost at most one call per
 *                              window — protecting the monthly quota.
 *
 * The API key lives in AVIATIONSTACK_API_KEY (server-only — it goes in the query
 * string AviationStack requires, but never leaves the server and is never
 * logged). Set it in .env.local for dev and in the Vercel project env for prod.
 */

const API_BASE = 'http://api.aviationstack.com/v1/flights'

// Free tier = 100 requests/month. Cache hard so a flight being watched on its
// travel day costs ~1 call per half hour rather than one per page view.
const STATUS_TTL_SECONDS = 1800 // 30 min

export type FlightLegStatus = {
  airport: string | null     // full airport name, e.g. "Sydney Kingsford Smith"
  iata: string | null        // e.g. "SYD"
  timezone: string | null    // IANA tz, e.g. "Australia/Sydney" (for time display)
  terminal: string | null
  gate: string | null
  scheduledISO: string | null
  estimatedISO: string | null
  actualISO: string | null
  delayMin: number | null    // minutes late vs schedule (null = unknown / on time)
}

export type FlightPhase =
  | 'scheduled' | 'active' | 'landed' | 'cancelled' | 'incident' | 'diverted' | 'unknown'

export type FlightStatusData = {
  flightIata: string
  airlineName: string | null
  flightDate: string | null   // YYYY-MM-DD (departure-airport local date)
  phase: FlightPhase
  departure: FlightLegStatus
  arrival: FlightLegStatus
  fetchedAtISO: string
}

export type FlightStatusResult =
  | { state: 'ok'; data: FlightStatusData }
  | { state: 'unconfigured' }                 // no API key
  | { state: 'not_found' }                     // no data for this flight + date
  | { state: 'error'; message: string }        // network / quota / API error

/** True when an API key is present. Cheap, no network — safe to call in render. */
export function isFlightStatusConfigured(): boolean {
  return Boolean(process.env.AVIATIONSTACK_API_KEY)
}

/**
 * The window during which we'll actually call the live API for a flight:
 * from a day before departure to half a day after arrival. Outside this we
 * show the booked details only (saves the monthly quota and matches the fact
 * that the free tier has no far-future data anyway).
 *
 * Note: booking datetimes are stored as wall-clock-as-UTC (offsets stripped on
 * ingest), so `departure.getTime()` is skewed from the true instant by the
 * destination's UTC offset (≤14h). The window is deliberately generous so that
 * skew never pushes the real travel day outside it.
 */
export function flightTrackingWindow(departure: Date, arrival: Date | null) {
  const opensAt = new Date(departure.getTime() - 24 * 3600_000)
  const tail = arrival ?? new Date(departure.getTime() + 12 * 3600_000)
  const closesAt = new Date(tail.getTime() + 12 * 3600_000)
  return { opensAt, closesAt }
}

export function isWithinTrackingWindow(
  departure: Date, arrival: Date | null, now: Date = new Date(),
): boolean {
  const { opensAt, closesAt } = flightTrackingWindow(departure, arrival)
  return now.getTime() >= opensAt.getTime() && now.getTime() <= closesAt.getTime()
}

/** Normalise "QF 25" / "qf25" → "QF25"; returns '' if it doesn't look like a code. */
export function normalizeFlightIata(raw: string | null | undefined): string {
  if (!raw) return ''
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // 2–3 char airline prefix + 1–4 digit number, optional trailing letter.
  return /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(cleaned) ? cleaned : ''
}

// --- AviationStack response shapes (loosely typed; everything is optional) ---

type RawLeg = {
  airport?: string | null
  timezone?: string | null
  iata?: string | null
  terminal?: string | null
  gate?: string | null
  delay?: number | null
  scheduled?: string | null
  estimated?: string | null
  actual?: string | null
}

type RawFlight = {
  flight_date?: string | null
  flight_status?: string | null
  departure?: RawLeg
  arrival?: RawLeg
  airline?: { name?: string | null } | null
  flight?: { iata?: string | null; number?: string | null } | null
}

type RawResponse = {
  data?: RawFlight[]
  error?: { code?: string; message?: string; type?: string } | string
}

function toPhase(s: string | null | undefined): FlightPhase {
  switch ((s ?? '').toLowerCase()) {
    case 'scheduled': return 'scheduled'
    case 'active':    return 'active'
    case 'landed':    return 'landed'
    case 'cancelled': return 'cancelled'
    case 'incident':  return 'incident'
    case 'diverted':  return 'diverted'
    default:          return 'unknown'
  }
}

function normalizeLeg(leg: RawLeg | undefined): FlightLegStatus {
  return {
    airport: leg?.airport ?? null,
    iata: leg?.iata ?? null,
    timezone: leg?.timezone ?? null,
    terminal: leg?.terminal ?? null,
    gate: leg?.gate ?? null,
    scheduledISO: leg?.scheduled ?? null,
    estimatedISO: leg?.estimated ?? null,
    actualISO: leg?.actual ?? null,
    delayMin: typeof leg?.delay === 'number' ? leg.delay : null,
  }
}

/** Friendly message for AviationStack's known error codes. */
function describeApiError(err: NonNullable<RawResponse['error']>): string {
  const code = typeof err === 'string' ? err : (err.code ?? err.type ?? '')
  switch (code) {
    case 'usage_limit_reached':
    case 'monthly_limit_reached':
      return 'Live-tracking quota for this month is used up.'
    case 'invalid_access_key':
    case 'missing_access_key':
      return 'The flight-tracking API key looks invalid.'
    case 'function_access_restricted':
    case 'https_access_restricted':
      return 'This lookup needs a paid AviationStack plan.'
    default:
      return 'Flight-tracking service is unavailable right now.'
  }
}

/**
 * Look up live status for a flight on a specific date.
 *
 * @param flightIataRaw  IATA flight code, e.g. "QF25" (whitespace tolerated).
 * @param flightDate     Departure-airport local date as YYYY-MM-DD — used to
 *                       pick the right entry when AviationStack returns several.
 *
 * Callers should gate on isWithinTrackingWindow() first so we don't burn the
 * monthly quota on far-future flights.
 */
export async function getFlightStatus(
  flightIataRaw: string, flightDate: string,
): Promise<FlightStatusResult> {
  const apiKey = process.env.AVIATIONSTACK_API_KEY
  if (!apiKey) return { state: 'unconfigured' }

  const flightIata = normalizeFlightIata(flightIataRaw)
  if (!flightIata) return { state: 'not_found' }

  const url = `${API_BASE}?access_key=${encodeURIComponent(apiKey)}&flight_iata=${encodeURIComponent(flightIata)}&limit=100`

  let raw: RawResponse
  try {
    const res = await fetch(url, { next: { revalidate: STATUS_TTL_SECONDS } })
    if (!res.ok) {
      // Don't leak the URL (it carries the key) into logs.
      console.error(`[flight-status] HTTP ${res.status} for ${flightIata}`)
      return { state: 'error', message: 'Flight-tracking service is unavailable right now.' }
    }
    raw = (await res.json()) as RawResponse
  } catch (err) {
    console.error('[flight-status] fetch failed:', String(err))
    return { state: 'error', message: 'Couldn’t reach the flight-tracking service.' }
  }

  if (raw.error) return { state: 'error', message: describeApiError(raw.error) }

  const rows = Array.isArray(raw.data) ? raw.data : []
  if (rows.length === 0) return { state: 'not_found' }

  // Prefer the row whose departure date matches the booking. AviationStack's
  // flight_date is the departure-airport local date, which is exactly what
  // fmtDateInput(startAt) gives us (booking startAt is stored as local
  // wall-clock). If nothing matches the date, the free tier simply doesn't have
  // this date yet — treat as not found rather than show the wrong day.
  const match = rows.find((r) => r.flight_date === flightDate)
  if (!match) return { state: 'not_found' }

  return {
    state: 'ok',
    data: {
      flightIata: match.flight?.iata?.toUpperCase() || flightIata,
      airlineName: match.airline?.name ?? null,
      flightDate: match.flight_date ?? flightDate,
      phase: toPhase(match.flight_status),
      departure: normalizeLeg(match.departure),
      arrival: normalizeLeg(match.arrival),
      fetchedAtISO: new Date().toISOString(),
    },
  }
}
