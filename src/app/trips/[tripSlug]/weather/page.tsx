import { notFound } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import {
  Sun, Cloud, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog,
  MapPin, Droplets, Wind, Waves, Shirt, Sparkles,
} from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { geocodePlace, getTripWeather, weatherCodeToInfo } from '@/lib/weather'

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

export default async function WeatherPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  await requireTripAccess(tripSlug)
  const trip = await prisma.trip.findUnique({
    where: { slug: tripSlug },
    include: { cities: { orderBy: { displayOrder: 'asc' }, take: 1 } },
  })
  if (!trip) notFound()

  const lookupName = trip.cities[0]?.name?.trim() || trip.destination
  const geo = await geocodePlace(lookupName)
  const weather = geo
    ? await getTripWeather(geo.lat, geo.lon, trip.startDate.toISOString(), trip.endDate.toISOString())
    : null

  const placeLabel = geo ? `${geo.label}${geo.country ? `, ${geo.country}` : ''}` : trip.destination
  const weeks = weather?.weeks ?? []
  const hasData = weeks.length > 0

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Weather</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">What to expect.</h1>
        <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {placeLabel}
          </span>
          {weather && weather.mode !== 'none' && (
            <>
              <span className="text-ink-muted/40">·</span>
              <span>{weather.label}</span>
              {weather.isCoastal && (
                <>
                  <span className="text-ink-muted/40">·</span>
                  <span className="inline-flex items-center gap-1"><Waves className="w-3.5 h-3.5" /> Coastal</span>
                </>
              )}
            </>
          )}
        </p>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl space-y-8 sm:space-y-10">
        {!hasData ? (
          <div className="border border-dashed border-line rounded-xl bg-paper/40 p-8 sm:p-10 text-center">
            <Cloud className="w-8 h-8 text-ink-muted mx-auto mb-3" />
            <h2 className="font-display text-2xl mb-2">No outlook yet.</h2>
            <p className="text-sm text-ink-muted max-w-md mx-auto">
              {geo
                ? 'We couldn’t pull conditions for these dates right now — check back closer to departure.'
                : `We couldn’t locate “${trip.destination}”. Add a city to the trip for an accurate outlook.`}
            </p>
          </div>
        ) : (
          <>
            {/* Weekly outlook cards */}
            <section>
              <h2 className="font-display text-2xl sm:text-3xl mb-5">Week by week</h2>
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
                        {w.swellM != null && (
                          <div className="flex items-center gap-1.5 col-span-2">
                            <Waves className="w-3.5 h-3.5 text-sage shrink-0" />
                            <span>{w.swellM}m swell</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Narrative: how it'll feel + what to pack */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-sage" />
                  <h3 className="font-display text-2xl">How it&apos;ll feel</h3>
                </div>
                <ul className="space-y-2.5 text-sm">
                  {weather!.insights.summary.map((s, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="text-sage mt-1.5 w-1 h-1 rounded-full bg-sage shrink-0" aria-hidden />
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
                  {weather!.insights.clothing.map((c, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-sakura shrink-0" aria-hidden />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <p className="text-[10px] text-ink-muted text-center italic">
              {weather!.mode === 'forecast'
                ? 'Live forecast from Open-Meteo, refreshed through the day.'
                : 'Averaged from the last 3 years of conditions for these dates — a live forecast appears automatically within ~16 days of departure.'}
            </p>
          </>
        )}
      </div>
    </>
  )
}
