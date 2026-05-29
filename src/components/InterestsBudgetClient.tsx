'use client'

/**
 * Planner Step 2 — "Interests & budget". Budget sits at the top (it frames
 * everything below), then a grid of broad interest themes the traveller taps,
 * then pace. "Next" carries the choices to Step 3 (/plan/picks) as URL query
 * params — no server action, no DB write — where Itinera turns the chosen
 * themes into specific, named picks per city.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import type { InterestTheme } from '@/lib/trip-planner'
import { themeIcon } from '@/components/theme-icons'

const TIERS = [
  { id: 'budget', label: 'Budget', hint: 'Free & cheap' },
  { id: 'balanced', label: 'Balanced', hint: 'Mid-range' },
  { id: 'splurge', label: 'Splurge', hint: 'Treat ourselves' },
]
const PACES = [
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'packed', label: 'Packed' },
]

export function InterestsBudgetClient({
  tripSlug, themes, currency,
}: {
  tripSlug: string
  themes: InterestTheme[]
  currency: string
}) {
  const router = useRouter()
  const [tier, setTier] = useState('balanced')
  const [showAmount, setShowAmount] = useState(false)
  const [amount, setAmount] = useState('')
  const [pace, setPace] = useState('balanced')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function next() {
    const params = new URLSearchParams()
    params.set('tier', tier)
    if (showAmount && amount.trim()) params.set('amount', amount.trim())
    params.set('pace', pace)
    params.set('themes', [...selected].join(','))
    startTransition(() => {
      router.push(`/trips/${tripSlug}/plan/picks?${params.toString()}`)
    })
  }

  return (
    <div className="mt-8 sm:mt-10 space-y-9">
      {/* Budget — first, it frames everything else */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2.5">Budget</div>
        <div className="flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTier(t.id)}
              className={`rounded-xl px-4 py-2.5 border text-left transition ${
                tier === t.id ? 'border-sage bg-sage-soft/50' : 'border-line bg-paper-pure hover:border-sage'
              }`}
            >
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-[11px] text-ink-muted">{t.hint}</div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowAmount((v) => !v)}
          className="text-xs text-ink-muted hover:text-ink mt-2.5 ulink"
        >
          {showAmount ? 'Use a tier instead' : 'Or set a specific amount'}
        </button>
        {showAmount && (
          <label className="block mt-2 max-w-xs">
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              Total for activities + dining ({currency})
            </span>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input mt-1 num-mono"
              placeholder="e.g. 2000"
            />
          </label>
        )}
      </div>

      {/* Interests — broad themes, tap what you're into */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2.5">What are you into?</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {themes.map((t) => {
            const on = selected.has(t.id)
            const Icon = themeIcon(t.icon)
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => toggle(t.id)}
                aria-pressed={on}
                className={`relative rounded-2xl px-4 py-4 border text-left transition flex items-center gap-3 ${
                  on
                    ? 'border-sage bg-sage text-paper-pure'
                    : 'border-line bg-paper-pure text-ink-soft hover:border-sage'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${on ? 'text-paper-pure' : 'text-ink-muted'}`} />
                <span className="text-sm font-medium leading-tight">{t.label}</span>
                {on && <Check className="w-4 h-4 absolute top-2.5 right-2.5" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Pace */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2.5">Pace</div>
        <div className="flex flex-wrap gap-2">
          {PACES.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setPace(p.id)}
              className={`rounded-full px-4 py-1.5 border text-sm transition ${
                pace === p.id ? 'border-sage bg-sage text-paper-pure' : 'border-line bg-paper-pure hover:border-sage'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={next}
          disabled={pending || selected.size === 0}
          className="btn-ink inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Finding the best of each city…</>
          ) : (
            <>Next: see the picks <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
        {selected.size === 0 && (
          <span className="text-xs text-ink-muted">Pick at least one to continue.</span>
        )}
      </div>
    </div>
  )
}
