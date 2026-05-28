/**
 * Weather via Open-Meteo — free, no API key required.
 *
 * Two data sources depending on how far out the trip is:
 *   • within ~16 days  → real daily forecast (api.open-meteo.com)
 *   • further out      → "typical" conditions pulled from the SAME calendar
 *     dates one year ago (archive-api.open-meteo.com), re-labelled with this
 *     year's trip dates. Honest seasonal expectation rather than a fake one.
 *
 * As a trip approaches, it crosses into the 16-day window and the page
 * starts showing the live forecast automatically — no code change needed.
 *
 * All fetches use Next's fetch cache (6h for weather, 30d for geocoding) so
 * we're gentle on the free API.
 */

import { startOfDay, addDays, subYears, format } from 'date-fns'

export type WeatherDay = {
  date: string                 // YYYY-MM-DD (this year's trip date)
  hiC: number
  loC: number
  code: number                 // WMO weather code
  precipProb: number | null    // % chance (forecast only; null for typical)
  windKmh: number | null
}

export type TripWeather = {
  mode: 'forecast' | 'typical' | 'none'
  /** Friendly description of the data source for the UI. */
  label: string
  days: WeatherDay[]
}

export type GeoResult = { lat: number; lon: number; label: string; country: string }

const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd')

/** Resolve a place name (city or country) to coordinates via Open-Meteo geocoding. */
export async function geocodePlace(name: string): Promise<GeoResult | null> {
  if (!name?.trim()) return null
  const q = encodeURIComponent(name.split(',')[0].trim())
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en&format=json`
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } })
    if (!res.ok) return null
    const data = await res.json()
    const hit = data?.results?.[0]
    if (!hit) return null
    return {
      lat: hit.latitude,
      lon: hit.longitude,
      label: hit.name,
      country: hit.country ?? '',
    }
  } catch {
    return null
  }
}

type DailyKind = 'forecast' | 'archive'

async function fetchDaily(
  kind: DailyKind, lat: number, lon: number, startDate: string, endDate: string,
): Promise<WeatherDay[]> {
  const base = kind === 'forecast'
    ? 'https://api.open-meteo.com/v1/forecast'
    : 'https://archive-api.open-meteo.com/v1/archive'
  const daily = kind === 'forecast'
    ? 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max'
    : 'temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max'
  const url = `${base}?latitude=${lat}&longitude=${lon}&daily=${daily}&timezone=auto&start_date=${startDate}&end_date=${endDate}`
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 6 } })
    if (!res.ok) return []
    const data = await res.json()
    const t: string[] = data?.daily?.time ?? []
    const hi: number[] = data?.daily?.temperature_2m_max ?? []
    const lo: number[] = data?.daily?.temperature_2m_min ?? []
    const code: number[] = data?.daily?.weather_code ?? []
    const prob: number[] = data?.daily?.precipitation_probability_max ?? []
    const wind: number[] = data?.daily?.wind_speed_10m_max ?? []
    return t.map((date, i) => ({
      date,
      hiC: Math.round(hi[i]),
      loC: Math.round(lo[i]),
      code: code[i] ?? 0,
      precipProb: kind === 'forecast' ? (prob[i] ?? null) : null,
      windKmh: wind[i] != null ? Math.round(wind[i]) : null,
    })).filter((d) => Number.isFinite(d.hiC) && Number.isFinite(d.loC)) as WeatherDay[]
  } catch {
    return []
  }
}

/** Daily weather across a trip's date range, picking forecast or typical data. */
export async function getTripWeather(
  lat: number, lon: number, startISO: string, endISO: string,
): Promise<TripWeather> {
  const today = startOfDay(new Date())
  const start = startOfDay(new Date(startISO))
  const end = startOfDay(new Date(endISO))
  const horizon = addDays(today, 16)

  // Live forecast when the trip overlaps the next 16 days.
  if (end >= today && start <= horizon) {
    const fStart = start < today ? today : start
    const fEnd = end > horizon ? horizon : end
    const days = (await fetchDaily('forecast', lat, lon, fmtDate(fStart), fmtDate(fEnd))) as WeatherDay[]
    if (days.length) return { mode: 'forecast', label: 'Live forecast', days }
  }

  // Otherwise: same dates last year, re-labelled to this year's trip dates.
  const lyDays = (await fetchDaily('archive', lat, lon, fmtDate(subYears(start, 1)), fmtDate(subYears(end, 1)))) as WeatherDay[]
  if (lyDays.length) {
    const days = lyDays.map((d, i) => ({ ...d, date: fmtDate(addDays(start, i)) }))
    return { mode: 'typical', label: 'Typical for these dates (based on last year)', days }
  }

  return { mode: 'none', label: '', days: [] }
}

/** Map a WMO weather code to an icon key + short label. */
export function weatherCodeToInfo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: 'sun', label: 'Clear' }
  if (code === 1 || code === 2) return { icon: 'cloud-sun', label: 'Partly cloudy' }
  if (code === 3) return { icon: 'cloud', label: 'Overcast' }
  if (code === 45 || code === 48) return { icon: 'fog', label: 'Fog' }
  if (code >= 51 && code <= 57) return { icon: 'cloud-rain', label: 'Drizzle' }
  if (code >= 61 && code <= 67) return { icon: 'cloud-rain', label: 'Rain' }
  if (code >= 71 && code <= 77) return { icon: 'snow', label: 'Snow' }
  if (code >= 80 && code <= 82) return { icon: 'cloud-rain', label: 'Showers' }
  if (code === 85 || code === 86) return { icon: 'snow', label: 'Snow showers' }
  if (code >= 95) return { icon: 'storm', label: 'Thunderstorm' }
  return { icon: 'cloud', label: '—' }
}

/** True if a day's code/precip suggests meaningful rain (for "wet day" counts). */
export function isWetDay(day: WeatherDay): boolean {
  if (day.precipProb != null) return day.precipProb >= 50
  // Typical mode has no probability — infer from the weather code.
  return (day.code >= 51 && day.code <= 67) || (day.code >= 80 && day.code <= 99)
}
