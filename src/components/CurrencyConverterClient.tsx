'use client'
import { useState } from 'react'

/**
 * Destination-aware currency converter. The user types an amount in the
 * trip's LOCAL currency and sees it converted to their home currency
 * (highlighted) plus a couple of other majors. All rates are computed
 * server-side from the FX table and passed in as plain multipliers, so
 * this component ships no rate data and works for any destination.
 */
export type ConversionTarget = {
  code: string
  symbol: string
  /** Multiply a local-currency amount by this to get the target amount. */
  rate: number
  decimals: number
}

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

  const home = conversions[0]
  const others = conversions.slice(1)

  const fmt = (value: number, decimals: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

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
      </div>

      {/* Output side — home currency (big) + a few other majors */}
      {home && (
        <div className="bg-sage text-paper-pure rounded-xl p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-paper-pure/70">Costs you</div>
          <div className="flex items-end gap-2 mt-2">
            <span className="font-display text-3xl text-paper-pure/70">{home.symbol}</span>
            <span className="font-display text-4xl sm:text-5xl num-mono">
              {fmt(amount * home.rate, home.decimals)}
            </span>
            <span className="text-paper-pure/70 text-xs mb-2">{home.code}</span>
          </div>
          {others.length > 0 && (
            <div className="mt-3 text-xs text-paper-pure/80 space-y-1">
              {others.map((t) => (
                <div key={t.code} className="flex justify-between">
                  <span>{t.code}</span>
                  <span className="num-mono">{t.symbol}{fmt(amount * t.rate, t.decimals)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
