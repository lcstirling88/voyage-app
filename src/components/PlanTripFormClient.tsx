'use client'

/**
 * Preferences form for "Let Itinera plan it". Tick interests by category, pick
 * a budget tier (or a specific amount) and a pace, then generate. On success
 * we bounce back to the itinerary, where the suggestions appear as dashed
 * placeholder cards.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Check, Loader2 } from 'lucide-react'
import { generateTripPlan } from '@/lib/actions'
import type { PlanCategory } from '@/lib/trip-planner'

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

export function PlanTripFormClient({
  tripSlug, categories, currency,
}: {
  tripSlug: string
  categories: PlanCategory[]
  currency: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tier, setTier] = useState('balanced')
  const [showAmount, setShowAmount] = useState(false)
  const [amount, setAmount] = useState('')
  const [pace, setPace] = useState('balanced')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(label: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function submit() {
    setError(null)
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('interests', [...selected].join('||'))
    fd.set('budgetTier', tier)
    if (showAmount && amount.trim()) fd.set('budgetAmount', amount.trim())
    fd.set('pace', pace)
    startTransition(async () => {
      const res = await generateTripPlan(fd)
      if (res.ok) {
        router.push(`/trips/${tripSlug}/itinerary`)
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="mt-8 sm:mt-10 space-y-8">
      {categories.map((cat) => (
        <div key={cat.key}>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2.5">{cat.label}</div>
          <div className="flex flex-wrap gap-2">
            {cat.options.map((o) => {
              const on = selected.has(o.label)
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => toggle(o.label)}
                  className={`text-sm rounded-full px-3.5 py-1.5 border transition inline-flex items-center gap-1.5 ${
                    on
                      ? 'border-sage bg-sage text-paper-pure'
                      : 'border-line bg-paper-pure text-ink-soft hover:border-sage'
                  }`}
                >
                  {on && <Check className="w-3 h-3" />}
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Budget */}
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

      {error && <div className="text-sm text-rust">{error}</div>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="btn-ink inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Itinera is planning…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Plan my trip</>
          )}
        </button>
        {pending && <span className="text-xs text-ink-muted">Filling your days — this takes a few seconds.</span>}
      </div>

      <p className="text-xs text-ink-muted/70 italic">
        Suggestions land as dashed placeholders on your itinerary — keep the ones you like, delete the rest.
        Re-running replaces the previous suggestions.
      </p>
    </div>
  )
}
