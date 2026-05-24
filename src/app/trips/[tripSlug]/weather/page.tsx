import { notFound } from 'next/navigation'
import { Sun, Cloud, CloudSun, CloudRain, Umbrella, Shirt, Sunrise, Leaf } from 'lucide-react'
import { prisma } from '@/lib/db'

// Static seasonal forecast for the prototype. In production this would hit OpenWeather / Visual Crossing.
const tokyoForecast = [
  { date: 'Thu Oct 8', icon: 'cloud-sun', hi: 22, lo: 16, label: 'Partly cloudy', rain: 15, wind: 12 },
  { date: 'Fri Oct 9', icon: 'sun', hi: 24, lo: 17, label: 'Clear', rain: 5, wind: 8 },
  { date: 'Sat Oct 10', icon: 'sun', hi: 25, lo: 18, label: 'Clear · light breeze', rain: 2, wind: 6, best: true },
  { date: 'Sun Oct 11', icon: 'cloud-rain', hi: 19, lo: 14, label: 'Showers', rain: 70, wind: 18 },
]

const kyotoForecast = [
  { date: 'Mon 12', icon: 'cloud', hi: 21, lo: 15 },
  { date: 'Tue 13', icon: 'sun', hi: 23, lo: 14 },
  { date: 'Wed 14', icon: 'sun', hi: 24, lo: 15 },
  { date: 'Thu 15', icon: 'cloud-sun', hi: 22, lo: 14 },
  { date: 'Fri 16', icon: 'cloud-rain', hi: 18, lo: 12, rain: 60 },
  { date: 'Sat 17', icon: 'sun', hi: 22, lo: 14 },
]

function Icon({ name, className = 'w-10 h-10' }: { name: string; className?: string }) {
  if (name === 'sun') return <Sun className={`${className} text-gold mx-auto`} />
  if (name === 'cloud') return <Cloud className={`${className} text-ink-muted mx-auto`} />
  if (name === 'cloud-sun') return <CloudSun className={`${className} text-gold mx-auto`} />
  if (name === 'cloud-rain') return <CloudRain className={`${className} text-ink-muted mx-auto`} />
  return <Cloud className={`${className} text-ink-muted mx-auto`} />
}

export default async function WeatherPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({ where: { slug: tripSlug } })
  if (!trip) notFound()

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Weather</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">What to expect.</h1>
        <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base">
          Forecasts pull live nearer to your trip. For now, ten-year averages.
        </p>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl space-y-8 sm:space-y-10">
        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-display text-3xl">Tokyo · Oct 8 – 11</h2>
            <span className="text-xs text-ink-muted">Sunrise 05:47 · Sunset 17:18</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {tokyoForecast.map((f) => (
              <div key={f.date} className={`border rounded-xl bg-paper-pure p-5 text-center ${f.best ? 'border-sage border-2 relative' : 'border-line'}`}>
                {f.best && <span className="absolute -top-2 left-1/2 -translate-x-1/2 pill pill-paid">Best day</span>}
                <div className={`text-xs text-ink-muted ${f.best ? 'mt-1' : ''}`}>{f.date}</div>
                <div className="my-3"><Icon name={f.icon} /></div>
                <div className="font-display text-3xl">{f.hi}° / {f.lo}°</div>
                <div className="text-xs text-ink-muted mt-2">{f.label}</div>
                <div className={`text-[10px] mt-1 num-mono ${f.rain >= 60 ? 'text-rust' : 'text-ink-muted'}`}>{f.rain}% rain · {f.wind}km/h</div>
              </div>
            ))}
            <div className="border border-dashed border-line rounded-xl p-5 text-center text-ink-muted">
              <div className="text-xs">Hakone</div>
              <div className="my-3"><CloudRain className="w-10 h-10 mx-auto" /></div>
              <div className="font-display text-lg">Pack a layer</div>
              <div className="text-xs mt-1">Cooler at altitude</div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-display text-3xl">Kyoto · Oct 12 – 17</h2>
            <span className="text-xs text-ink-muted">Maple foliage starts mid-Oct in higher temples</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {kyotoForecast.map((f) => (
              <div key={f.date} className="border border-line rounded-xl bg-paper-pure p-4 text-center">
                <div className="text-xs text-ink-muted">{f.date}</div>
                <div className="my-2"><Icon name={f.icon} className="w-8 h-8" /></div>
                <div className="font-display text-2xl">{f.hi}°</div>
                <div className={`text-[10px] mt-1 ${f.rain ? 'text-rust' : 'text-ink-muted'}`}>{f.lo}°{f.rain ? ` · ${f.rain}%` : ''}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-line rounded-xl bg-paper-pure p-6">
          <h3 className="font-display text-2xl mb-3">Voyage notes for these conditions</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-3"><Umbrella className="w-4 h-4 text-ink-muted mt-0.5 shrink-0" /><span>Pack a compact umbrella — at least one wet day in each city.</span></li>
            <li className="flex gap-3"><Shirt className="w-4 h-4 text-ink-muted mt-0.5 shrink-0" /><span>Layering season. Cool mornings (12–15°C) warming to mid-20s by 2pm. Merino + light jacket.</span></li>
            <li className="flex gap-3"><Sunrise className="w-4 h-4 text-ink-muted mt-0.5 shrink-0" /><span>Day 6 Fushimi Inari plan still works at 06:00 — sunrise is ~05:50.</span></li>
            <li className="flex gap-3"><Leaf className="w-4 h-4 text-sage mt-0.5 shrink-0" /><span><strong>Foliage forecast:</strong> Kyoto momiji likely 40–60% peak during your stay. Higher elevations (Kurama, Hieizan) will be ahead — consider day trip.</span></li>
          </ul>
        </section>
      </div>
    </>
  )
}
