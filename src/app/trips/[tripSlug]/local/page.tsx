import { notFound } from 'next/navigation'
import { HandCoins, Plug, Banknote, Wifi, AlertOctagon, LifeBuoy } from 'lucide-react'
import { prisma } from '@/lib/db'
import { CurrencyConverterClient } from '@/components/CurrencyConverterClient'

export default async function LocalPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const trip = await prisma.trip.findUnique({ where: { slug: tripSlug } })
  if (!trip) notFound()

  return (
    <>
      <div className="hero-light border-b border-line px-10 py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Local intelligence</div>
        <h1 className="h-display text-6xl mt-2">Know before you go.</h1>
      </div>

      <div className="px-10 py-10 max-w-7xl">
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 border border-line rounded-xl bg-paper-pure p-6">
            <div className="flex items-baseline justify-between mb-5">
              <h3 className="font-display text-2xl">Currency converter</h3>
              <div className="text-xs text-ink-muted num-mono">Static rates · refresh live in v2</div>
            </div>
            <CurrencyConverterClient homeCurrency={trip.homeCurrency} />
            <div className="mt-5 pt-5 border-t border-line text-xs text-ink-muted">
              <span className="font-medium text-ink">Rule of thumb:</span> drop the last two digits of a yen price for a rough {trip.homeCurrency} figure (¥1,200 ≈ $12), then add ~10%.
            </div>
          </div>

          <div className="border border-line rounded-xl bg-paper-pure p-6">
            <div className="w-10 h-10 rounded-full bg-sakura-soft grid place-items-center mb-3"><HandCoins className="w-5 h-5 text-wine" /></div>
            <h3 className="font-display text-xl">Tipping</h3>
            <p className="text-sm text-ink-muted mt-1">Not the custom — and often refused.</p>
            <ul className="text-sm mt-4 space-y-2">
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Restaurants: <strong>no tip</strong></li>
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Taxis: <strong>no tip</strong></li>
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Private guides: small gift OK</li>
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Ryokan: optional <em>kokoro-zuke</em> in envelope (¥3,000) on arrival</li>
            </ul>
          </div>

          <div className="border border-line rounded-xl bg-paper-pure p-6">
            <div className="w-10 h-10 rounded-full bg-gold-soft grid place-items-center mb-3"><Plug className="w-5 h-5 text-gold" /></div>
            <h3 className="font-display text-xl">Power</h3>
            <p className="text-sm text-ink-muted mt-1">Type A · 100V · 50/60Hz</p>
            <ul className="text-sm mt-4 space-y-2">
              <li className="flex gap-2"><span className="text-ink-muted">·</span>AU plugs need adapter</li>
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Most laptops/phones handle 100V fine</li>
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Hair tools: bring dual-voltage</li>
            </ul>
          </div>

          <div className="border border-line rounded-xl bg-paper-pure p-6">
            <div className="w-10 h-10 rounded-full bg-sage-soft grid place-items-center mb-3"><Banknote className="w-5 h-5 text-sage" /></div>
            <h3 className="font-display text-xl">Cash vs card</h3>
            <p className="text-sm text-ink-muted mt-1">More cashless than it used to be, but...</p>
            <ul className="text-sm mt-4 space-y-2">
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Carry ¥10–20k cash always</li>
              <li className="flex gap-2"><span className="text-ink-muted">·</span>7-Eleven ATMs accept foreign cards</li>
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Suica IC card for transit/conveniences</li>
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Many small restaurants are cash-only</li>
            </ul>
          </div>

          <div className="border border-line rounded-xl bg-paper-pure p-6">
            <div className="w-10 h-10 rounded-full bg-sakura-soft grid place-items-center mb-3"><Wifi className="w-5 h-5 text-wine" /></div>
            <h3 className="font-display text-xl">Connectivity</h3>
            <p className="text-sm text-ink-muted mt-1">eSIM is the move.</p>
            <ul className="text-sm mt-4 space-y-2">
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Airalo Japan 10GB · $18</li>
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Hotel WiFi excellent everywhere</li>
              <li className="flex gap-2"><span className="text-ink-muted">·</span>Google Maps transit is near-perfect</li>
            </ul>
          </div>

          <div className="sm:col-span-2 border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
            <h3 className="font-display text-2xl mb-4">Useful phrases</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ['Sumimasen', 'Excuse me / Sorry'],
                ['Arigatou gozaimasu', 'Thank you (formal)'],
                ['Eigo o hanasemasu ka?', 'Do you speak English?'],
                ['Okaikei onegaishimasu', 'Bill, please'],
                ['Oishii desu!', "It's delicious!"],
                ['Toire wa doko desu ka?', "Where's the bathroom?"],
                ['Kore o kudasai', "I'll have this please"],
                ['Daijoubu desu', "I'm OK / No thanks"],
              ].map(([jp, en]) => (
                <div key={jp} className="flex justify-between items-baseline border-b border-line-soft pb-2">
                  <span className="text-ink-muted italic">{jp}</span>
                  <span className="text-right">{en}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-line rounded-xl bg-ink text-paper-pure p-6 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-sakura/20" />
            <div className="w-10 h-10 rounded-full bg-paper-pure/10 grid place-items-center mb-3"><AlertOctagon className="w-5 h-5 text-sakura" /></div>
            <h3 className="font-display text-xl">Don&apos;t do this</h3>
            <ul className="text-sm mt-4 space-y-2.5 text-paper-pure/80">
              <li>· Don&apos;t tip. Genuinely.</li>
              <li>· Don&apos;t eat while walking</li>
              <li>· Don&apos;t blow nose in public</li>
              <li>· Shoes off when you see the step</li>
              <li>· Quiet on trains — no calls</li>
              <li>· Don&apos;t stick chopsticks upright in rice</li>
              <li>· Tattoos may bar you from onsen — check first</li>
            </ul>
          </div>

          <div className="border border-line rounded-xl bg-paper-pure p-6">
            <div className="w-10 h-10 rounded-full bg-sakura-soft grid place-items-center mb-3"><LifeBuoy className="w-5 h-5 text-wine" /></div>
            <h3 className="font-display text-xl">In an emergency</h3>
            <ul className="text-sm mt-4 space-y-2">
              {[
                ['Police', '110'],
                ['Fire / Ambulance', '119'],
                ['AU Embassy Tokyo', '03-5232-4111'],
                ['Insurance (AAMI)', '+61 2 8923 2900'],
                ['Travel hotline (24/7)', '050-3816-2787'],
              ].map(([label, num]) => (
                <li key={label} className="flex justify-between">
                  <span className="text-ink-muted">{label}</span>
                  <span className="num-mono font-medium">{num}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
