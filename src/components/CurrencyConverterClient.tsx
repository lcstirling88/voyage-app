'use client'
import { useState } from 'react'

// Static rates seeded for the prototype. In production, refresh from an FX API once a day.
const ratesFromJPY: Record<string, number> = {
  AUD: 0.0102,
  USD: 0.0067,
  EUR: 0.0062,
  GBP: 0.0053,
}

export function CurrencyConverterClient({ homeCurrency }: { homeCurrency: string }) {
  const [jpy, setJpy] = useState(3500)
  const home = ratesFromJPY[homeCurrency] ?? ratesFromJPY.AUD
  const sym = homeCurrency === 'GBP' ? '£' : homeCurrency === 'EUR' ? '€' : '$'

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">You&apos;ll pay (¥ JPY)</label>
        <div className="flex items-end gap-2 mt-2">
          <span className="font-display text-3xl text-ink-muted">¥</span>
          <input
            type="number"
            value={jpy}
            onChange={(e) => setJpy(parseFloat(e.target.value) || 0)}
            className="bg-transparent border-b border-line focus:border-sage outline-none font-display text-5xl w-full num-mono"
          />
        </div>
        <div className="flex gap-2 mt-3 text-xs">
          {[500, 1500, 3500, 10000].map((v) => (
            <button
              key={v}
              onClick={() => setJpy(v)}
              className="px-3 py-1 border border-line rounded-full hover:bg-line-soft num-mono"
            >
              {v.toLocaleString()}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-sage text-paper-pure rounded-xl p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-paper-pure/70">Costs you</div>
        <div className="flex items-end gap-2 mt-2">
          <span className="font-display text-3xl text-paper-pure/70">{sym}</span>
          <span className="font-display text-5xl num-mono">{(jpy * home).toFixed(2)}</span>
          <span className="text-paper-pure/70 text-xs mb-2">{homeCurrency}</span>
        </div>
        <div className="mt-3 text-xs text-paper-pure/80 space-y-1">
          {Object.entries(ratesFromJPY).filter(([k]) => k !== homeCurrency).map(([k, r]) => {
            const s = k === 'GBP' ? '£' : k === 'EUR' ? '€' : '$'
            return (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="num-mono">{s}{(jpy * r).toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
