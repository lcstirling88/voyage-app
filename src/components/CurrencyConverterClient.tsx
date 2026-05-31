'use client'
import { useEffect, useState } from 'react'

/**
 * Destination-aware currency converter. The user types an amount in the
 * trip's LOCAL currency and sees it converted to their home currency
 * (highlighted) plus a couple of other majors. All rates are computed
 * server-side from the FX table and passed in as plain multipliers, so
 * this component ships no rate data and works for any destination.
 *
 * On top of the mid-market rate the traveller can enter their card's foreign
 * transaction fee (a % markup most banks add when you pay abroad). When set,
 * every converted figure reflects what the card will actually charge, with the
 * home-currency line broken down into mid-market + fee so the markup is visible.
 * The fee is remembered in localStorage — your card doesn't change between trips.
 */
export type ConversionTarget = {
  code: string
  symbol: string
  /** Multiply a local-currency amount by this to get the target amount. */
  rate: number
  decimals: number
}

const FEE_STORAGE_KEY = 'itinera.cardFeePct'
const FEE_PRESETS = [0, 1, 2, 3]

export function CurrencyConverterClient({
  localCurrency,
  localSymbol,
  localDecimals,
  quickAmounts,
  conversions,
}: {
  localCurrency: string
  localSymbol: string
  localDecimals: number
  quickAmounts: number[]
  conversions: ConversionTarget[]
}) {
  // Default to a middle quick-amount so the box isn't empty on first load.
  const [amount, setAmount] = useState<number>(quickAmounts[1] ?? quickAmounts[0] ?? 100)
  // Card foreign-transaction fee, as a percentage. Starts at 0 (so SSR + first
  // client render agree) and is rehydrated from localStorage after mount.
  const [cardFee, setCardFee] = useState<number>(0)

  useEffect(() => {
    const saved = Number(localStorage.getItem(FEE_STORAGE_KEY))
    if (Number.isFinite(saved) && saved > 0) setCardFee(saved)
  }, [])

  function updateFee(value: number) {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
    setCardFee(clamped)
    try { localStorage.setItem(FEE_STORAGE_KEY, String(clamped)) } catch { /* private mode */ }
  }

  const home = conversions[0]
  const others = conversions.slice(1)

  const feeMult = 1 + cardFee / 100
  const hasFee = cardFee > 0

  const fmt = (value: number, decimals: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

  const homeBase = home ? amount * home.rate : 0
  const homeTotal = homeBase * feeMult
  const homeFee = homeTotal - homeBase

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Input side — amount in the destination's currency */}
      <div>
        <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          You&apos;ll pay ({localSymbol} {localCurrency})
        </label>
        <div className="flex items-end gap-2 mt-2">
          <span className="font-display text-3xl text-ink-muted">{localSymbol}</span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="bg-transparent border-b border-line focus:border-sage outline-none font-display text-4xl sm:text-5xl w-full num-mono min-w-0"
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          {quickAmounts.map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className="px-3 py-1 border border-line rounded-full hover:bg-line-soft num-mono"
            >
              {v.toLocaleString()}
            </button>
          ))}
        </div>

        {/* Card fee — the % markup your bank adds on foreign spend */}
        <div className="mt-6 pt-5 border-t border-line">
          <label htmlFor="card-fee" className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            Card conversion fee
          </label>
          <div className="flex items-center gap-2 mt-2">
            <input
              id="card-fee"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.1}
              value={cardFee}
              onChange={(e) => updateFee(parseFloat(e.target.value))}
              className="bg-transparent border-b border-line focus:border-sage outline-none font-display text-2xl w-20 num-mono"
            />
            <span className="font-display text-2xl text-ink-muted">%</span>
            <div className="flex flex-wrap gap-1.5 ml-1">
              {FEE_PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => updateFee(v)}
                  className={`px-2.5 py-1 rounded-full border text-xs num-mono transition ${
                    cardFee === v ? 'border-sage bg-sage-soft text-ink' : 'border-line hover:bg-line-soft'
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-ink-muted mt-2">
            The foreign-transaction fee your card adds abroad. Many travel cards charge 0%; typical bank cards 2–3%.
          </p>
        </div>
      </div>

      {/* Output side — home currency (big) + a few other majors */}
      {home && (
        <div className="bg-sage text-paper-pure rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-paper-pure/70">
            {hasFee ? 'Charged to your card' : 'Costs you'}
          </div>
          <div className="flex items-end gap-2 mt-2">
            <span className="font-display text-3xl text-paper-pure/70">{home.symbol}</span>
            <span className="font-display text-4xl sm:text-5xl num-mono">
              {fmt(homeTotal, home.decimals)}
            </span>
            <span className="text-paper-pure/70 text-xs mb-2">{home.code}</span>
          </div>

          {hasFee && (
            <div className="mt-3 pt-3 border-t border-paper-pure/20 text-xs text-paper-pure/85 space-y-1">
              <div className="flex justify-between">
                <span>Mid-market</span>
                <span className="num-mono">{home.symbol}{fmt(homeBase, home.decimals)}</span>
              </div>
              <div className="flex justify-between">
                <span>+ {fmt(cardFee, cardFee % 1 === 0 ? 0 : 1)}% card fee</span>
                <span className="num-mono">{home.symbol}{fmt(homeFee, home.decimals)}</span>
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div className={`text-xs text-paper-pure/80 space-y-1 ${hasFee ? 'mt-3 pt-3 border-t border-paper-pure/20' : 'mt-3'}`}>
              {others.map((t) => (
                <div key={t.code} className="flex justify-between">
                  <span>{t.code}</span>
                  <span className="num-mono">{t.symbol}{fmt(amount * t.rate * feeMult, t.decimals)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
