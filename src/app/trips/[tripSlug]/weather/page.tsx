import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  Sun, Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog,
  MapPin, Droplets, Wind, Waves, Shirt, Sparkles,
} from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { geocodePlace, getTripWeather, weatherCodeToInfo, type TripWeather } from '@/lib/weather'
import { getTripSegments } from '@/lib/segments'

function WeatherIcon({ name, className = 'w-10 h-10' }: { name: string; className?: string }) {
  if (name === 'sun') return <Sun className={`${className} text-gold`} />
  if (name === 'cloud-sun') return <CloudSun className={`${className} text-gold`} />
  if (name === 'cloud') return <Cloud className={`${className} text-ink-muted`} />
  if (name === 'cloud-rain') return <CloudRain className={`${className} text-ink-muted`} />
  if (name === 'snow') return <CloudSnow className={`${className} text-sage`} />
  if (name === 'storm') return <CloudLightning className={`${className} text-wine`} />
  if (name === 'fog') return <CloudFog className={`${className} text-ink-muted`} />
  return <Cloud className={`${className} text-ink-muted`} />
}

/** Weeks grid + "how it'll feel" + "what to pack" for one leg's weather. */
function LegOutlook({ weather }: { weather: TripWeather }) {
  const weeks = weather.weeks
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {weeks.map((w) => {
          const feelsDiffers = Math.abs(w.feelsHiC - w.avgHiC) >= 3
          return (
            <div key={w.index} className="border border-line rounded-xl bg-paper-pure p-5">
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                  {weeks.length > 1 ? `Week ${w.index}` : 'Your dates'}
                </div>
                <div className="text-xs text-ink-muted num-mono">
                  {format(parseISO(w.startDate), 'd MMM')}{w.dayCount > 1 ? ` – ${format(parseISO(w.endDate), 'd MMM')}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <WeatherIcon name={w.icon} className="w-12 h-12 shrink-0" />
                <div className="min-w-0">
                  <div className="font-display text-4xl leading-none">
                    {w.avgHiC}°<span className="text-ink-muted text-2xl"> / {w.avgLoC}°</span>
                  </div>
                  <div className="text-[11px] text-ink-muted mt-1">{w.label} · avg high / low</div>
                </div>
              </div>
              {feelsDiffers && (
                <div className="text-xs text-ink-muted mt-2">
                  Feels like <span className="text-ink">{w.feelsHiC}° / {w.feelsLoC}°</span>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-line-soft grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <Droplets className={`w-3.5 h-3.5 shrink-0 ${w.wetDays > 0 ? 'text-sage' : 'text-ink-muted'}`} />
                  <span>{w.rainMm}mm · {w.wetDays} wet</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  <span className="num-mono">{w.avgWindKmh}–{w.maxWindKmh} km/h</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
        <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-sage" />
            <h3 className="font-display text-2xl">How it&apos;ll feel</h3>
          </div>
          <ul className="space-y-2.5 text-sm">
            {weather.insights.summary.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-sage shrink-0" aria-hidden />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-line rounded-xl bg-ink text-paper-pure p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-sakura/15" />
          <div className="flex items-center gap-2 mb-3">
            <Shirt className="w-4 h-4 text-sakura" />
            <h3 className="font-display text-2xl">What to pack</h3>
          </div>
          <ul className="space-y-2.5 text-sm text-paper-pure/85">
            {weather.insights.clothing.map((c, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-sakura shrink-0" aria-hidden />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="text-[10px] text-ink-muted text-center italic mt-4">
        {weather.mode === 'forecast'
          ? 'Live forecast from Open-Meteo.'
          : 'Averaged from the last 3 years for these dates — a live forecast appears within ~16 days of departure.'}
      </p>
    </>
  )
}

export default async function WeatherPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  await requireTripAccess(tripSlug)
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { cities: { orderBy: { displayOrder: 'asc' } } },
  })
  if (!trip) notFound()

  const segments = await getTripSegments(trip)
  const multi = new Set(segments.map((s) => s.country)).size > 1

  // Per-leg weather. For each leg prefer a trip city that overlaps its dates
  // (city-level accuracy) and fall back to the leg's country.
  const legs = await Promise.all(segments.map(async (leg) => {
    const cityInLeg = trip.cities.find((c) => c.arriveOn <= leg.endDate && c.leaveOn >= leg.startDate)
    const lookupName = cityInLeg?.name?.trim() || leg.country
    // Hint the leg's country so an ambiguous city (e.g. "Queenstown") resolves
    // within this leg rather than to the most populous match worldwide.
    const geo = await geocodePlace(lookupName, { countryHint: leg.country })
    const weather = geo
      ? await getTripWeather(geo.lat, geo.lon, leg.startDate.toISOString(), leg.endDate.toISOString())
      : null
    return {
      key: leg.id ?? leg.country,
      country: leg.country,
      flag: leg.flag,
      placeLabel: geo ? `${geo.label}${geo.country ? `, ${geo.country}` : ''}` : leg.country,
      range: `${format(leg.startDate, 'd MMM')} – ${format(leg.endDate, 'd MMM yyyy')}`,
      coastal: weather?.isCoastal ?? false,
      swellM: weather?.swellM ?? null,
      weather,
    }
  }))

  const withData = legs.filter((l) => l.weather && l.weather.weeks.length > 0)
  const single = withData.length === 1 ? withData[0] : null

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Weather</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">What to expect.</h1>
        <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base flex flex-wrap items-center gap-x-2 gap-y-1">
          {multi ? (
            <span>{withData.length} {withData.length === 1 ? 'country' : 'countries'} on this trip</span>
          ) : single ? (
            <>
              <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {single.placeLabel}</span>
              {single.weather && (
                <>
                  <span className="text-ink-muted/40">·</span>
                  <span>{single.weather.label}</span>
                  {single.coastal && (
                    <>
                      <span className="text-ink-muted/40">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Waves className="w-3.5 h-3.5" /> Coastal{single.swellM != null ? ` · ~${single.swellM}m swell` : ''}
                      </span>
                    </>
                  )}
                </>
              )}
            </>
          ) : null}
        </p>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl space-y-10 sm:space-y-12">
        {withData.length === 0 ? (
          <div className="border border-dashed border-line rounded-xl bg-paper/40 p-8 sm:p-10 text-center">
            <Cloud className="w-8 h-8 text-ink-muted mx-auto mb-3" />
            <h2 className="font-display text-2xl mb-2">No outlook yet.</h2>
            <p className="text-sm text-ink-muted max-w-md mx-auto">
              We couldn&apos;t pull conditions for these dates — check back closer to departure, or add a city to the trip for an accurate read.
            </p>
          </div>
        ) : single ? (
          <LegOutlook weather={single.weather!} />
        ) : (
          // Multi-country: a section per leg, each with its own heading.
          withData.map((leg) => (
            <section key={leg.key}>
              <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2 border-b border-line pb-3">
                <h2 className="font-display text-2xl sm:text-3xl flex items-center gap-2">
                  <span aria-hidden>{leg.flag ?? '📍'}</span> {leg.country}
                </h2>
                <div className="text-xs text-ink-muted flex items-center gap-2 flex-wrap">
                  <span className="num-mono">{leg.range}</span>
                  <span className="text-ink-muted/40">·</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {leg.placeLabel}</span>
                  {leg.coastal && (
                    <>
                      <span className="text-ink-muted/40">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Waves className="w-3 h-3" /> Coastal{leg.swellM != null ? ` ~${leg.swellM}m` : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <LegOutlook weather={leg.weather!} />
            </section>
          ))
        )}
      </div>
    </>
  )
}
