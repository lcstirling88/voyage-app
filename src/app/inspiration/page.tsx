/**
 * Travel inspiration — curated destinations, browseable without an account.
 * V1 is a hand-pulled list from the destinations registry; future versions
 * can layer in seasonal picks, "trips like X you might enjoy", or editorial
 * articles.
 */

import Link from 'next/link'
import { ChevronLeft, Compass, ArrowRight } from 'lucide-react'
import { listDestinations } from '@/lib/destinations'
import { ItineraBrand } from '@/components/ItineraBrand'

/** A short editorial pitch per destination — what makes it special. */
const PITCHES: Record<string, string> = {
  '392': 'Cherry blossoms, kaiseki dinners, and shinkansen lines threaded through nine centuries of capital cities.',
  '554': 'Two islands, a fjord, and ski fields a half-hour from the lake. Pack twice the layers.',
  '036': 'Reef in the morning, vineyard at lunch, harbour ferry by sunset.',
  '380': 'Cinque Terre cliffs, Florence galleries, Sicilian markets. Eat slowly.',
  '352': 'Volcanic black sand, glacier ice caves, and a Reykjavík sauna at the end of every day.',
  '764': 'Bangkok night markets, Chiang Mai temples, and the limestone karsts of Krabi.',
  '250': 'Paris in the rain, lavender fields in Provence, oysters in Cancale.',
  '724': 'Tapas in San Sebastián, modernist Barcelona, and the bone-quiet of the Camino at dawn.',
  '276': 'Christmas markets, Black Forest cake, and the Berlin you only see by bicycle.',
  '620': 'Pastéis de nata in Lisbon, port cellars in Porto, and the wild Atlantic coast in between.',
  '826': 'London galleries, Cornish coastal paths, and Scottish whisky distilleries with a view.',
  '372': 'Cliffs of Moher, Dublin pubs, and the slow road through Connemara.',
  '840': 'National parks the size of small countries, jazz clubs the size of front rooms.',
  '124': 'Rockies, Maritimes, the northern lights, and Montréal\'s croissants.',
  '484': 'Yucatán cenotes, Oaxaca mezcal, and the ruins at sunrise.',
  '702': 'Hawker centres, infinity pools, and a botanical garden you could spend a week in.',
  '360': 'Bali rice terraces, Borneo orangutans, and the cone-perfect volcanoes of Java.',
  '704': 'Hanoi street food, Hạ Long Bay, and an overnight train to the sand dunes.',
  '410': 'Seoul night markets, temple stays at Gyeongju, and Jeju\'s sea-women.',
  '156': 'The Great Wall, terracotta warriors, and Yunnan\'s tea-horse roads.',
  '344': 'Dim sum trolleys, peak tram views, and a different island for every weekend.',
  '356': 'Rajasthan palaces, Kerala backwaters, and the slow trains south.',
}

export default function InspirationPage() {
  const destinations = listDestinations()

  return (
    <main className="min-h-screen bg-paper-pure">
      <header className="border-b border-line px-5 sm:px-10 py-4 flex items-center justify-between">
        <Link href="/" className="text-xs text-ink-muted hover:text-ink ulink inline-flex items-center gap-1.5">
          <ChevronLeft className="w-3.5 h-3.5" /> Home
        </Link>
        <Link href="/" aria-label="Home">
          <ItineraBrand size="sm" />
        </Link>
        <div className="w-12" />
      </header>

      <div className="max-w-5xl mx-auto px-5 sm:px-10 py-8 sm:py-12">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted flex items-center gap-2">
          <Compass className="w-3 h-3" /> Travel inspiration
        </div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">Where to next.</h1>
        <p className="text-ink-muted mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
          A short, opinionated atlas of places we keep coming back to. Pick a country,
          start a trip, forward your bookings, and Itinera does the rest.
        </p>

        <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {destinations.map((d) => {
            if (!d.isoNumeric) return null
            const pitch = PITCHES[d.isoNumeric] ?? ''
            const heroSrc = d.heroImage?.src
            return (
              <Link
                key={d.isoNumeric}
                href={`/trips/new?destination=${encodeURIComponent(d.label)}`}
                className="group border border-line rounded-xl bg-paper-pure overflow-hidden hover:shadow-soft hover:border-sage transition"
              >
                <div className="relative h-32 sm:h-36 bg-ink/10">
                  {heroSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={heroSrc}
                      alt={d.heroImage?.alt ?? d.label}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ objectPosition: d.heroImage?.objectPosition ?? 'center' }}
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-5xl">
                      {d.passportIcon ?? '🗺️'}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2 text-paper-pure">
                    <span className="text-xl">{d.passportIcon ?? '🗺️'}</span>
                    <span className="font-display text-xl truncate drop-shadow">{d.label}</span>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  {pitch && (
                    <p className="text-sm text-ink-soft leading-relaxed italic">{pitch}</p>
                  )}
                  <div className="mt-3 text-xs text-ink-muted inline-flex items-center gap-1 group-hover:text-ink transition">
                    Start a trip <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-12 sm:mt-16 border-t border-line pt-8 text-center">
          <p className="text-xs text-ink-muted italic max-w-lg mx-auto">
            More destinations, seasonal picks, and editorial guides are on the way.
            For now, pick a country above to start planning.
          </p>
        </div>
      </div>
    </main>
  )
}
