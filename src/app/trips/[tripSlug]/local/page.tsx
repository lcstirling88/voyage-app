import { notFound } from 'next/navigation'
import { HandCoins, Plug, Banknote, Wifi, AlertOctagon, LifeBuoy } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { CurrencyConverterClient } from '@/components/CurrencyConverterClient'
import { GenerateLocalInfoClient } from '@/components/GenerateLocalInfoClient'
import { safeParseLocalInfo } from '@/lib/local-info'

export default async function LocalPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  await requireTripAccess(tripSlug)
  const trip = await prisma.trip.findUnique({ where: { slug: tripSlug } })
  if (!trip) notFound()

  const info = safeParseLocalInfo(trip.localInfoJson)

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Local intelligence</div>
            <h1 className="h-display text-4xl sm:text-6xl mt-2">Know before you go.</h1>
          </div>
          {info && <GenerateLocalInfoClient tripSlug={trip.slug} destination={trip.destination} regenerate />}
        </div>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl">
        {/* Currency converter always shown — works for any destination */}
        <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6 mb-6">
          <div className="flex items-baseline justify-between mb-5">
            <h3 className="font-display text-2xl">Currency converter</h3>
            <div className="text-xs text-ink-muted num-mono">Static rates · live in v2</div>
          </div>
          <CurrencyConverterClient homeCurrency={trip.homeCurrency} />
          {info?.ruleOfThumbCurrency && (
            <div className="mt-5 pt-5 border-t border-line text-xs text-ink-muted">
              <span className="font-medium text-ink">Rule of thumb:</span> {info.ruleOfThumbCurrency}
            </div>
          )}
        </div>

        {!info && (
          <GenerateLocalInfoClient tripSlug={trip.slug} destination={trip.destination} />
        )}

        {info && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Tipping */}
            <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
              <div className="w-10 h-10 rounded-full bg-sakura-soft grid place-items-center mb-3">
                <HandCoins className="w-5 h-5 text-wine" />
              </div>
              <h3 className="font-display text-xl">Tipping</h3>
              <p className="text-sm text-ink-muted mt-1">{info.tipping.summary}</p>
              <ul className="text-sm mt-4 space-y-2">
                {info.tipping.rules.map((r, i) => (
                  <li key={i} className="flex gap-2"><span className="text-ink-muted">·</span>{r}</li>
                ))}
              </ul>
            </div>

            {/* Power */}
            <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
              <div className="w-10 h-10 rounded-full bg-gold-soft grid place-items-center mb-3">
                <Plug className="w-5 h-5 text-gold" />
              </div>
              <h3 className="font-display text-xl">Power</h3>
              <p className="text-sm text-ink-muted mt-1">{info.power.type} · {info.power.voltage} · {info.power.frequency}</p>
              <ul className="text-sm mt-4 space-y-2">
                {info.power.notes.map((n, i) => (
                  <li key={i} className="flex gap-2"><span className="text-ink-muted">·</span>{n}</li>
                ))}
              </ul>
            </div>

            {/* Cash vs Card */}
            <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
              <div className="w-10 h-10 rounded-full bg-sage-soft grid place-items-center mb-3">
                <Banknote className="w-5 h-5 text-sage" />
              </div>
              <h3 className="font-display text-xl">Cash vs card</h3>
              <p className="text-sm text-ink-muted mt-1">{info.cashVsCard.summary}</p>
              <ul className="text-sm mt-4 space-y-2">
                {info.cashVsCard.notes.map((n, i) => (
                  <li key={i} className="flex gap-2"><span className="text-ink-muted">·</span>{n}</li>
                ))}
              </ul>
            </div>

            {/* Connectivity */}
            <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
              <div className="w-10 h-10 rounded-full bg-sakura-soft grid place-items-center mb-3">
                <Wifi className="w-5 h-5 text-wine" />
              </div>
              <h3 className="font-display text-xl">Connectivity</h3>
              <p className="text-sm text-ink-muted mt-1">{info.connectivity.summary}</p>
              <ul className="text-sm mt-4 space-y-2">
                {info.connectivity.notes.map((n, i) => (
                  <li key={i} className="flex gap-2"><span className="text-ink-muted">·</span>{n}</li>
                ))}
              </ul>
            </div>

            {/* Phrases */}
            <div className="sm:col-span-2 border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
              <h3 className="font-display text-2xl mb-4">Useful phrases</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {info.phrases.map((p, i) => (
                  <div key={i} className="flex justify-between items-baseline border-b border-line-soft pb-2">
                    <span className="text-ink-muted italic">{p.phrase}</span>
                    <span className="text-right">{p.translation}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Don't do this */}
            <div className="border border-line rounded-xl bg-ink text-paper-pure p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-sakura/20" />
              <div className="w-10 h-10 rounded-full bg-paper-pure/10 grid place-items-center mb-3">
                <AlertOctagon className="w-5 h-5 text-sakura" />
              </div>
              <h3 className="font-display text-xl">Don&apos;t do this</h3>
              <ul className="text-sm mt-4 space-y-2.5 text-paper-pure/80">
                {info.dontDoThis.map((d, i) => (
                  <li key={i}>· {d}</li>
                ))}
              </ul>
            </div>

            {/* Emergency */}
            <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
              <div className="w-10 h-10 rounded-full bg-sakura-soft grid place-items-center mb-3">
                <LifeBuoy className="w-5 h-5 text-wine" />
              </div>
              <h3 className="font-display text-xl">In an emergency</h3>
              <ul className="text-sm mt-4 space-y-2">
                {info.emergencyNumbers.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-ink-muted truncate">{e.label}</span>
                    <span className="num-mono font-medium shrink-0">{e.number}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {info && (
          <p className="text-[10px] text-ink-muted mt-6 text-center italic">
            Local info generated by AI on {new Date(info.generatedAt).toLocaleDateString()}. Double-check critical details (emergency numbers, embassy contacts) before you rely on them.
          </p>
        )}
      </div>
    </>
  )
}
