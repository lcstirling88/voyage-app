import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  Sun, Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog,
  Umbrella, Shirt, Thermometer, MapPin,
} from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import {
  geocodePlace, getTripWeather, weatherCodeToInfo, isWetDay, type WeatherDay,
} from '@/lib/weather'

function WeatherIcon({ name, className = 'w-10 h-10' }: { name: string; className?: string }) {
  const cls = `${className} mx-auto`
  if (name === 'sun') return <Sun className={`${cls} text-gold`} />
  if (name === 'cloud-sun') return <CloudSun className={`${cls} text-gold`} />
  if (name === 'cloud') return <Cloud className={`${cls} text-ink-muted`} />
  if (name === 'cloud-rain') return <CloudRain className={`${cls} text-ink-muted`} />
  if (name === 'snow') return <CloudSnow className={`${cls} text-sage`} />
  if (name === 'storm') return <CloudLightning className={`${cls} text-wine`} />
  if (name === 'fog') return <CloudFog className={`${cls} text-ink-muted`} />
  return <Cloud className={`${cls} text-ink-muted`} />
}

export default async function WeatherPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  await requireTripAccess(tripSlug)
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { cities: { orderBy: { displayOrder: 'asc' }, take: 1 } },
  })
  if (!trip) notFound()

  // Prefer a specific city for the lookup (more accurate than a whole country),
  // falling back to the destination string.
  const lookupName = trip.cities[0]?.name?.trim() || trip.destination
  const geo = await geocodePlace(lookupName)
  const weather = geo
    ? await getTripWeather(geo.lat, geo.lon, trip.startDate.toISOString(), trip.endDate.toISOString())
    : { mode: 'none' as const, label: '', days: [] as WeatherDay[] }

  const placeLabel = geo ? `${geo.label}${geo.country ? `, ${geo.country}` : ''}` : trip.destination

  // Derived, destination-agnostic notes computed from the actual numbers.
  const days = weather.days
  const hasData = days.length > 0
  const minLo = hasData ? Math.min(...days.map((d) => d.loC)) : 0
  const maxHi = hasData ? Math.max(...days.map((d) => d.hiC)) : 0
  const wetDays = days.filter(isWetDay).length
  const warmest = hasData ? days.reduce((a, b) => (b.hiC > a.hiC ? b : a)) : null
  const coldFew = minLo <= 10

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Weather</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">What to expect.</h1>
        <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {placeLabel}
          </span>
          {weather.mode !== 'none' && (
            <>
              <span className="text-ink-muted/40">·</span>
              <span>{weather.label}</span>
            </>
          )}
        </p>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl space-y-8 sm:space-y-10">
        {!hasData ? (
          <div className="border border-dashed border-line rounded-xl bg-paper/40 p-8 sm:p-10 text-center">
            <Cloud className="w-8 h-8 text-ink-muted mx-auto mb-3" />
            <h2 className="font-display text-2xl mb-2">No forecast yet.</h2>
            <p className="text-sm text-ink-muted max-w-md mx-auto">
              {geo
                ? 'We couldn’t pull conditions for these dates right now — check back closer to departure.'
                : `We couldn’t locate “${trip.destination}”. Add a city to the trip for an accurate forecast.`}
            </p>
          </div>
        ) : (
          <>
            <section>
              <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
                <h2 className="font-display text-2xl sm:text-3xl">
                  {format(parseISO(days[0].date), 'd MMM')} – {format(parseISO(days[days.length - 1].date), 'd MMM yyyy')}
                </h2>
                <span className="text-xs text-ink-muted">
                  {days.length} {days.length === 1 ? 'day' : 'days'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {days.map((d) => {
                  const info = weatherCodeToInfo(d.code)
                  const isWarm = warmest && d.date === warmest.date
                  // Historical/"typical" days get a greyed, dashed-edge card so
                  // they read clearly as an estimate rather than a real forecast.
                  const typical = weather.mode === 'typical'
                  const cardCls = [
                    'border rounded-xl p-4 text-center',
                    typical ? 'bg-line-soft/60' : 'bg-paper-pure',
                    isWarm
                      ? 'border-gold border-2 relative'
                      : typical ? 'border-dashed border-line' : 'border-line',
                  ].join(' ')
                  return (
                    <div key={d.date} className={cardCls}>
                      {isWarm && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.18em] bg-gold text-paper-pure px-2 py-0.5 rounded-full">
                          Warmest
                        </span>
                      )}
                      <div className={`text-[10px] uppercase tracking-[0.14em] text-ink-muted ${isWarm ? 'mt-1' : ''}`}>
                        {format(parseISO(d.date), 'EEE d')}
                      </div>
                      <div className="my-2.5"><WeatherIcon name={info.icon} className="w-9 h-9" /></div>
                      <div className="font-display text-2xl sm:text-3xl leading-none">{d.hiC}°</div>
                      <div className="text-xs text-ink-muted mt-1">{d.loC}° low</div>
                      <div className="text-[10px] mt-1.5 text-ink-muted">{info.label}</div>
                      {d.precipProb != null && (
                        <div className={`text-[10px] mt-0.5 num-mono ${d.precipProb >= 50 ? 'text-rust' : 'text-ink-muted'}`}>
                          {d.precipProb}% rain
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
              <h3 className="font-display text-2xl mb-3">What to pack for this</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-3">
                  <Thermometer className="w-4 h-4 text-ink-muted mt-0.5 shrink-0" />
                  <span>Expect lows around <strong>{minLo}°</strong> and highs near <strong>{maxHi}°</strong> across the trip.</span>
                </li>
                {coldFew && (
                  <li className="flex gap-3">
                    <Shirt className="w-4 h-4 text-ink-muted mt-0.5 shrink-0" />
                    <span>Cool mornings — pack layers and a warm jacket for the {minLo}° starts.</span>
                  </li>
                )}
                {wetDays > 0 ? (
                  <li className="flex gap-3">
                    <Umbrella className="w-4 h-4 text-ink-muted mt-0.5 shrink-0" />
                    <span><strong>{wetDays}</strong> {wetDays === 1 ? 'day looks' : 'days look'} wet — bring a compact umbrella or rain shell.</span>
                  </li>
                ) : (
                  <li className="flex gap-3">
                    <Sun className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                    <span>Looking dry across your dates — sunscreen over umbrella.</span>
                  </li>
                )}
              </ul>
            </section>

            <p className="text-[10px] text-ink-muted text-center italic">
              {weather.mode === 'forecast'
                ? 'Live forecast from Open-Meteo, refreshed through the day.'
                : 'Based on last year’s actual conditions for these dates — a live forecast appears automatically within ~16 days of departure.'}
            </p>
          </>
        )}
      </div>
    </>
  )
}
