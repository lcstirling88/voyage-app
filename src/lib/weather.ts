/**
 * Weather via Open-Meteo — free, no API key.
 *
 * Two regimes depending on how far out the trip is:
 *   • within ~16 days → live daily forecast
 *   • further out     → "typical" conditions averaged over the SAME calendar
 *     window across the last 3 years (a real historical trend, not one noisy
 *     sample), re-labelled to this year's trip dates.
 *
 * Daily numbers are then bucketed into WEEKS (Week 1 / Week 2 / …) for the
 * UI, because for a multi-week trip a weekly trend reads far better than 21
 * individual estimates. We also pull marine data (swell) when the spot is
 * coastal, and synthesise plain-English "how it'll feel" + clothing notes
 * from the numbers — using apparent ("feels-like") temperature so e.g. a
 * humid 27° honestly reads as "feels like 32°".
 */

import { startOfDay, addDays, subYears, differenceInDays, format } from 'date-fns'

export type WeatherDay = {
  date: string          // YYYY-MM-DD (this year's trip date)
  hiC: number
  loC: number
  feelsHiC: number
  feelsLoC: number
  rainMm: number
  windKmh: number
  code: number          // WMO weather code
  precipProb: number | null
}

export type WeatherWeek = {
  index: number         // 1-based
  startDate: string
  endDate: string
  dayCount: number
  avgHiC: number
  avgLoC: number
  feelsHiC: number
  feelsLoC: number
  rainMm: number        // total across the week
  avgWindKmh: number
  maxWindKmh: number
  wetDays: number
  icon: string          // dominant condition
  label: string
  swellM: number | null
}

export type WeatherInsights = { summary: string[]; clothing: string[] }

export type TripWeather = {
  mode: 'forecast' | 'typical' | 'none'
  label: string
  isCoastal: boolean
  swellM: number | null   // representative recent swell, coastal only
  days: WeatherDay[]
  weeks: WeatherWeek[]
  insights: WeatherInsights
}

export type GeoResult = { lat: number; lon: number; label: string; country: string }

const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd')
const round = (n: number) => Math.round(n)
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
function modeOf(xs: number[]): number {
  const counts = new Map<number, number>()
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
  let best = xs[0] ?? 0, bestN = -1
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n }
  return best
}

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
    return { lat: hit.latitude, lon: hit.longitude, label: hit.name, country: hit.country ?? '' }
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
  const fields = [
    'temperature_2m_max', 'temperature_2m_min',
    'apparent_temperature_max', 'apparent_temperature_min',
    'precipitation_sum', 'weather_code', 'wind_speed_10m_max',
    ...(kind === 'forecast' ? ['precipitation_probability_max'] : []),
  ].join(',')
  const url = `${base}?latitude=${lat}&longitude=${lon}&daily=${fields}&timezone=auto&start_date=${startDate}&end_date=${endDate}`
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 6 } })
    if (!res.ok) return []
    const d = await res.json()
    const day = d?.daily
    if (!day?.time) return []
    return day.time.map((date: string, i: number): WeatherDay => {
      const hi = day.temperature_2m_max?.[i]
      const lo = day.temperature_2m_min?.[i]
      return {
        date,
        hiC: round(hi),
        loC: round(lo),
        feelsHiC: round(day.apparent_temperature_max?.[i] ?? hi),
        feelsLoC: round(day.apparent_temperature_min?.[i] ?? lo),
        rainMm: Math.max(0, day.precipitation_sum?.[i] ?? 0),
        windKmh: round(day.wind_speed_10m_max?.[i] ?? 0),
        code: day.weather_code?.[i] ?? 0,
        precipProb: kind === 'forecast' ? (day.precipitation_probability_max?.[i] ?? null) : null,
      }
    }).filter((x: WeatherDay) => Number.isFinite(x.hiC) && Number.isFinite(x.loC))
  } catch {
    return []
  }
}

/** Average the trip window across the last `years` years into one daily series. */
async function fetchHistoricalAveraged(
  lat: number, lon: number, start: Date, end: Date, years = 3,
): Promise<WeatherDay[]> {
  const perYear = await Promise.all(
    Array.from({ length: years }, (_, k) => k + 1).map((y) =>
      fetchDaily('archive', lat, lon, fmtDate(subYears(start, y)), fmtDate(subYears(end, y))),
    ),
  )
  const valid = perYear.filter((r) => r.length > 0)
  if (valid.length === 0) return []
  const len = Math.min(...valid.map((r) => r.length))
  const out: WeatherDay[] = []
  for (let i = 0; i < len; i++) {
    const s = valid.map((r) => r[i])
    out.push({
      date: fmtDate(addDays(start, i)),
      hiC: round(avg(s.map((x) => x.hiC))),
      loC: round(avg(s.map((x) => x.loC))),
      feelsHiC: round(avg(s.map((x) => x.feelsHiC))),
      feelsLoC: round(avg(s.map((x) => x.feelsLoC))),
      rainMm: round(avg(s.map((x) => x.rainMm))),
      windKmh: round(avg(s.map((x) => x.windKmh))),
      code: modeOf(s.map((x) => x.code)),
      precipProb: null,
    })
  }
  return out
}

/** Probe the marine API near the coords; returns a representative swell (m)
 *  if this is a coastal/ocean point, else null (treated as inland). */
async function probeMarine(lat: number, lon: number): Promise<number | null> {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&daily=swell_wave_height_max,wave_height_max&timezone=auto&forecast_days=7`
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 12 } })
    if (!res.ok) return null
    const d = await res.json()
    const swell: number[] = (d?.daily?.swell_wave_height_max ?? d?.daily?.wave_height_max ?? [])
      .filter((n: number | null) => typeof n === 'number')
    if (swell.length === 0) return null
    return Math.round(avg(swell) * 10) / 10
  } catch {
    return null
  }
}

function isWet(day: WeatherDay): boolean {
  if (day.precipProb != null) return day.precipProb >= 50
  if (day.rainMm >= 2) return true
  return (day.code >= 51 && day.code <= 67) || (day.code >= 80 && day.code <= 99)
}

function bucketIntoWeeks(days: WeatherDay[], swellM: number | null): WeatherWeek[] {
  const weeks: WeatherWeek[] = []
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7)
    if (chunk.length === 0) continue
    weeks.push({
      index: weeks.length + 1,
      startDate: chunk[0].date,
      endDate: chunk[chunk.length - 1].date,
      dayCount: chunk.length,
      avgHiC: round(avg(chunk.map((d) => d.hiC))),
      avgLoC: round(avg(chunk.map((d) => d.loC))),
      feelsHiC: round(avg(chunk.map((d) => d.feelsHiC))),
      feelsLoC: round(avg(chunk.map((d) => d.feelsLoC))),
      rainMm: round(chunk.reduce((a, d) => a + d.rainMm, 0)),
      avgWindKmh: round(avg(chunk.map((d) => d.windKmh))),
      maxWindKmh: round(Math.max(...chunk.map((d) => d.windKmh))),
      wetDays: chunk.filter(isWet).length,
      icon: weatherCodeToInfo(modeOf(chunk.map((d) => d.code))).icon,
      label: weatherCodeToInfo(modeOf(chunk.map((d) => d.code))).label,
      swellM,
    })
  }
  return weeks
}

/** Plain-English "how it'll feel" + clothing advice from the numbers. */
function buildInsights(days: WeatherDay[], isCoastal: boolean, swellM: number | null): WeatherInsights {
  const summary: string[] = []
  const clothing: string[] = []
  if (days.length === 0) return { summary, clothing }

  const maxHi = Math.max(...days.map((d) => d.hiC))
  const minLo = Math.min(...days.map((d) => d.loC))
  const avgHi = round(avg(days.map((d) => d.hiC)))
  const avgLo = round(avg(days.map((d) => d.loC)))
  const avgFeelsHi = round(avg(days.map((d) => d.feelsHiC)))
  const feelsDelta = avgFeelsHi - avgHi
  const swing = round(avg(days.map((d) => d.hiC - d.loC)))
  const maxWind = Math.max(...days.map((d) => d.windKmh))
  const wetDays = days.filter(isWet).length
  const total = days.length

  // --- How it'll feel ---
  if (feelsDelta >= 3) {
    summary.push(`Highs near ${avgHi}° will feel more like ${avgFeelsHi}° once humidity is factored in — middays are sticky and sap energy faster than the number suggests.`)
  } else if (feelsDelta <= -3) {
    summary.push(`Wind drags the felt temperature down: a ${avgHi}° high feels closer to ${avgFeelsHi}°, so it's cooler than it looks on paper.`)
  } else {
    summary.push(`Comfortable and honest temperatures — what you see is roughly what you get, around ${avgHi}° through the afternoon.`)
  }

  if (swing >= 10) {
    summary.push(`Big daily swing: warm ${avgHi}° afternoons fall away to ${avgLo}° after dark. The heat doesn't hold once the sun's down, so evenings feel markedly cooler.`)
  }

  if (isCoastal) {
    summary.push(
      maxWind >= 25
        ? `On the coast the afternoon sea breeze picks up and takes the edge off — by dinner, near the water, it'll feel several degrees cooler than midday.`
        : `Right on the coast, so expect a light sea breeze and humid air off the water.`,
    )
    if (swellM != null) {
      const sea = swellM < 0.8 ? 'calm, good for swimming' : swellM < 1.8 ? 'a moderate swell — fine for confident swimmers' : 'a sizeable swell — check local surf/beach reports before going in'
      summary.push(`Seas running about ${swellM} m — ${sea}.`)
    }
  }

  summary.push(
    wetDays === 0
      ? `Looking mostly dry across your dates.`
      : `Pack for showers: ${wetDays} of ${total} days look wet.`,
  )

  // --- What to pack ---
  if (maxHi >= 28) clothing.push(`Light, breathable layers for the day — linen and cotton. A hat and sunscreen are non-negotiable for the midday peak.`)
  else if (maxHi >= 20) clothing.push(`Mild daytime — t-shirt-and-light-trousers weather, with a light layer handy.`)

  if (swing >= 10 || minLo <= 15) clothing.push(`Bring a warmer layer for evenings — a light jacket or merino for dinner${isCoastal ? `, especially near the water where it cools quickly` : ``}. The midday heat is brief.`)
  if (minLo <= 5) clothing.push(`Genuinely cold mornings and nights — a proper warm jacket, plus a beanie and gloves.`)
  if (wetDays > 0) clothing.push(`A compact umbrella or a packable rain shell.`)
  if (isCoastal) clothing.push(`Swimwear and a quick-dry towel; reef shoes if the beaches are rocky.`)
  if (maxWind >= 35) clothing.push(`A windproof outer layer for exposed lookouts and clifftops.`)

  return { summary, clothing }
}

export async function getTripWeather(
  lat: number, lon: number, startISO: string, endISO: string,
): Promise<TripWeather> {
  const today = startOfDay(new Date())
  const start = startOfDay(new Date(startISO))
  const end = startOfDay(new Date(endISO))
  const horizon = addDays(today, 16)

  const swellM = await probeMarine(lat, lon)
  const isCoastal = swellM != null

  let mode: TripWeather['mode'] = 'none'
  let label = ''
  let days: WeatherDay[] = []

  if (end >= today && start <= horizon) {
    const fStart = start < today ? today : start
    const fEnd = end > horizon ? horizon : end
    days = await fetchDaily('forecast', lat, lon, fmtDate(fStart), fmtDate(fEnd))
    if (days.length) { mode = 'forecast'; label = 'Live forecast' }
  }
  if (days.length === 0) {
    const yearsBack = differenceInDays(end, start) >= 0 ? 3 : 3
    days = await fetchHistoricalAveraged(lat, lon, start, end, yearsBack)
    if (days.length) { mode = 'typical'; label = 'Typical for these dates (3-year average)' }
  }

  return {
    mode,
    label,
    isCoastal,
    swellM,
    days,
    // Swell is a single representative reading, not per-week data — surface it
    // once in the page header rather than repeating it on every week card.
    weeks: bucketIntoWeeks(days, null),
    insights: buildInsights(days, isCoastal, swellM),
  }
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
