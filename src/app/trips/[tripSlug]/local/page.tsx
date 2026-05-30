import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HandCoins, Plug, Banknote, Wifi, AlertOctagon, LifeBuoy, Stamp } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { CurrencyConverterClient, type ConversionTarget } from '@/components/CurrencyConverterClient'
import { GenerateLocalInfoClient } from '@/components/GenerateLocalInfoClient'
import { GenerateVisaInfoClient } from '@/components/GenerateVisaInfoClient'
import { safeParseLocalInfoSet, type LocalInfo } from '@/lib/local-info'
import { safeParseVisaInfo, visaStatusDisplay } from '@/lib/visa'
import {
  profileForDestination, profileForIsoNumeric, convertCurrency, currencySymbol,
  currencyDecimals, currencyQuickAmounts,
} from '@/lib/destinations'
import { getTripSegments, activeSegment, isMultiCountry } from '@/lib/segments'

export default async function LocalPage({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  const { user } = await requireTripAccess(tripSlug)
  const trip = await prisma.trip.findUnique({ where: { slug: tripSlug } })
  if (!trip) notFound()

  const localSet = safeParseLocalInfoSet(trip.localInfoJson)

  // Visa / entry: generated for the user's passport (nationality → home fallback).
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { nationalityIso: true, homeCountryIso: true },
  })
  const effectivePassport = dbUser?.nationalityIso ?? dbUser?.homeCountryIso ?? null
  const visaInfo = safeParseVisaInfo(trip.visaInfoJson)

  // Currency converter inputs — driven by the trip's legs. On a multi-country
  // trip the converter defaults to the leg you're on now (or heading to).
  const segments = await getTripSegments(trip)
  const activeLeg = activeSegment(segments)
  const multiCountry = isMultiCountry(segments)

  // Stale-cache guard: trip.localInfoJson can hold countries from an earlier
  // version of the trip (a destination that was later changed, or an old
  // mis-geocode — e.g. a NZ trip that once resolved to South Africa). Only ever
  // show local-info for countries that are actually in this trip's resolved
  // legs, matched by country name (case-insensitive) or ISO numeric. If nothing
  // survives the filter, treat it as "not generated yet" so the regenerate CTA
  // shows instead of stale data.
  const segCountryNames = new Set(segments.map((s) => s.country.trim().toLowerCase()))
  const segIsoNumerics = new Set(
    segments.map((s) => s.isoNumeric).filter((x): x is string => Boolean(x)),
  )
  const visibleCountries = (localSet?.countries ?? []).filter(
    (c) =>
      segCountryNames.has(c.country.trim().toLowerCase()) ||
      (c.isoNumeric != null && segIsoNumerics.has(c.isoNumeric)),
  )
  const effectiveLocalSet =
    localSet && visibleCountries.length > 0 ? { ...localSet, countries: visibleCountries } : null

  // Local-info for the active leg's country drives the currency rule-of-thumb.
  const activeCountryInfo =
    effectiveLocalSet?.countries.find((c) => c.country === activeLeg?.country)?.info
    ?? effectiveLocalSet?.countries[0]?.info ?? null
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

  return (
    <>
      <div className="hero-light border-b border-line px-6 sm:px-10 py-8 sm:py-10">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">Local intelligence</div>
            <h1 className="h-display text-4xl sm:text-6xl mt-2">Know before you go.</h1>
          </div>
          {effectiveLocalSet && <GenerateLocalInfoClient tripSlug={trip.slug} destination={trip.destination} regenerate />}
        </div>
      </div>

      <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-7xl">
        {/* Entry & visa — per destination, for the user's passport */}
        <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6 mb-6">
          <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
            <h3 className="font-display text-2xl flex items-center gap-2">
              <Stamp className="w-5 h-5 text-sage" /> Entry &amp; visa
            </h3>
            {visaInfo && <GenerateVisaInfoClient tripSlug={trip.slug} regenerate />}
          </div>

          {!effectivePassport ? (
            <p className="text-sm text-ink-muted">
              Set your passport on <Link href="/profile" className="ulink text-ink">your profile</Link> to
              check entry requirements for your nationality.
            </p>
          ) : !visaInfo ? (
            <GenerateVisaInfoClient tripSlug={trip.slug} />
          ) : (
            <>
              {visaInfo.passportIso !== effectivePassport && (
                <div className="text-xs text-rust mb-3">
                  Generated for a {visaInfo.passportLabel} passport — your passport has changed since. Refresh to update.
                </div>
              )}
              <div className="text-xs text-ink-muted mb-3">
                For a <span className="text-ink">{visaInfo.passportLabel}</span> passport · short-stay tourism
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {visaInfo.countries.map((c, i) => {
                  const d = visaStatusDisplay(c.status)
                  return (
                    <div key={i} className="border border-line rounded-lg p-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="font-display text-lg">{c.country}</div>
                        <span className={`pill ${d.pill}`}>{d.label}</span>
                      </div>
                      {c.allowedStayDays != null && (
                        <div className="text-xs text-ink-muted mt-1 num-mono">Up to {c.allowedStayDays} days</div>
                      )}
                      <p className="text-sm mt-2">{c.summary}</p>
                      {c.requirements.length > 0 && (
                        <ul className="text-xs text-ink-muted mt-2 space-y-1">
                          {c.requirements.map((r, j) => (
                            <li key={j} className="flex gap-1.5"><span>·</span><span>{r}</span></li>
                          ))}
                        </ul>
                      )}
                      {c.passportValidityRule && (
                        <div className="text-xs text-ink-muted mt-2 italic">{c.passportValidityRule}</div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-ink-muted mt-4 italic">
                AI-generated guidance — entry rules change often. Always confirm with the official
                government / embassy site before you travel.
              </p>
            </>
          )}
        </div>

        {/* Currency converter always shown — works for any destination */}
        <div className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6 mb-6">
          <div className="flex items-baseline justify-between mb-5 gap-3 flex-wrap">
            <h3 className="font-display text-2xl">
              Currency converter
              {multiCountry && activeLeg && (
                <span className="ml-2 text-sm text-ink-muted font-normal">
                  · {activeLeg.flag ? `${activeLeg.flag} ` : ''}{activeLeg.country}
                </span>
              )}
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
          {activeCountryInfo?.ruleOfThumbCurrency && (
            <div className="mt-5 pt-5 border-t border-line text-xs text-ink-muted">
              <span className="font-medium text-ink">Rule of thumb:</span> {activeCountryInfo.ruleOfThumbCurrency}
            </div>
          )}
        </div>

        {!effectiveLocalSet ? (
          <GenerateLocalInfoClient tripSlug={trip.slug} destination={trip.destination} />
        ) : effectiveLocalSet.countries.length === 1 ? (
          <LocalInfoGrid info={effectiveLocalSet.countries[0].info} />
        ) : (
          <div className="space-y-10 sm:space-y-12">
            {effectiveLocalSet.countries.map((c) => {
              const flag = c.isoNumeric ? profileForIsoNumeric(c.isoNumeric)?.passportIcon : null
              return (
                <section key={c.country}>
                  <h2 className="font-display text-2xl sm:text-3xl mb-4 flex items-center gap-2 border-b border-line pb-3">
                    <span aria-hidden>{flag ?? '🌍'}</span> {c.country}
                  </h2>
                  <LocalInfoGrid info={c.info} />
                </section>
              )
            })}
          </div>
        )}

        {effectiveLocalSet && (
          <p className="text-[10px] text-ink-muted mt-6 text-center italic">
            Local info generated by AI{effectiveLocalSet.generatedAt ? ` on ${new Date(effectiveLocalSet.generatedAt).toLocaleDateString()}` : ''}. Double-check critical details (emergency numbers, embassy contacts) before you rely on them.
          </p>
        )}
      </div>
    </>
  )
}

/** The card grid for one country's local info — tipping, power, cash, etc. */
function LocalInfoGrid({ info }: { info: LocalInfo }) {
  return (
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
  )
}
