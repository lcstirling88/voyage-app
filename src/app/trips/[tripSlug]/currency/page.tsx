import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftRight, Coins } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { CurrencyConverterClient, type ConversionTarget } from '@/components/CurrencyConverterClient'
import { safeParseLocalInfoSet } from '@/lib/local-info'
import {
  profileForDestination, convertCurrency, currencySymbol,
  currencyDecimals, currencyQuickAmounts,
} from '@/lib/destinations'
import { getTripSegments, activeSegment, isMultiCountry } from '@/lib/segments'

/**
 * Dedicated Currency tab — promoted to the bottom nav so it's one tap away
 * in-trip. Reuses the converter card from the Local Info page but stands on
 * its own: hero + converter + rule-of-thumb. The heavier "know before you go"
 * content (tipping, power, phrases…) stays on the Local Info tab.
 */
export default async function CurrencyPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  await requireTripAccess(tripSlug)
  const trip = await prisma.trip.findUnique({ where: { slug: tripSlug } })
  if (!trip) notFound()

  // Currency converter inputs — driven by the trip's legs. On a multi-country
  // trip the converter defaults to the leg you're on now (or heading to).
  const segments = await getTripSegments(trip)
  const activeLeg = activeSegment(segments)
  const multiCountry = isMultiCountry(segments)

  const localCurrency = activeLeg?.currency ?? trip.localCurrency ?? profileForDestination(trip.destination).currency ?? 'USD'
  const homeCurrency = trip.homeCurrency || 'AUD'
  // Build conversion targets: home first (highlighted), then up to 3 other
  // majors, skipping any that equal the local or home currency.
  const otherMajors = ['USD', 'EUR', 'GBP', 'AUD', 'NZD']
    .filter((c) => c !== homeCurrency && c !== localCurrency)
    .slice(0, 3)
  const conversions: ConversionTarget[] = [homeCurrency, ...otherMajors].map((code) => ({
    code,
    symbol: currencySymbol(code),
    rate: convertCurrency(1, localCurrency, code),
    decimals: currencyDecimals(code),
  }))

  // Rule-of-thumb spending tip, if Local Info has been generated for this leg's
  // country. Same stale-cache guard as the Local Info page: only trust cached
  // countries that are actually in the trip's resolved legs.
  const localSet = safeParseLocalInfoSet(trip.localInfoJson)
  const segCountryNames = new Set(segments.map((s) => s.country.trim().toLowerCase()))
  const ruleOfThumb =
    localSet?.countries.find(
      (c) =>
        c.country === activeLeg?.country &&
        segCountryNames.has(c.country.trim().toLowerCase()),
    )?.info.ruleOfThumbCurrency ?? null

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Currency</div>
        <h1 className="h-display text-4xl sm:text-6xl mt-2">What it&apos;ll cost.</h1>
        <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5" /> {localCurrency} → {homeCurrency}
          </span>
          {multiCountry && activeLeg && (
            <>
              <span className="text-ink-muted/40">·</span>
              <span>{activeLeg.flag ? `${activeLeg.flag} ` : ''}{activeLeg.country}</span>
            </>
          )}
        </p>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-3xl">
        <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6">
          <div className="flex items-baseline justify-between mb-5 gap-3 flex-wrap">
            <h3 className="font-display text-2xl flex items-center gap-2">
              <Coins className="w-5 h-5 text-sage" /> Converter
            </h3>
            <div className="text-xs text-ink-muted num-mono">Static rates · live in v2</div>
          </div>
          {multiCountry && (
            <p className="text-xs text-ink-muted mb-4 -mt-2">
              Showing the leg you&apos;re on. Other legs:{' '}
              {segments.filter((s) => s.currency !== localCurrency).map((s) => `${s.flag ?? ''} ${s.currency}`).join(' · ')}
            </p>
          )}
          <CurrencyConverterClient
            localCurrency={localCurrency}
            localSymbol={currencySymbol(localCurrency)}
            localDecimals={currencyDecimals(localCurrency)}
            quickAmounts={currencyQuickAmounts(localCurrency)}
            conversions={conversions}
          />
          {ruleOfThumb && (
            <div className="mt-5 pt-5 border-t border-line text-xs text-ink-muted">
              <span className="font-medium text-ink">Rule of thumb:</span> {ruleOfThumb}
            </div>
          )}
        </div>

        <p className="text-[10px] text-ink-muted mt-6 text-center italic">
          Looking for tipping, power, cash vs card and emergency numbers?{' '}
          <Link href={`/trips/${tripSlug}/local`} className="ulink text-ink">See Local info</Link>.
        </p>
      </div>
    </>
  )
}
