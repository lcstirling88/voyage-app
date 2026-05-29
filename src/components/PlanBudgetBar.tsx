/**
 * The budget loop, made visible. A single stacked bar on the itinerary that
 * shows experiences + dining spend by commitment level — booked (real), planned
 * (kept), and ideas (not yet kept) — against the traveller's stated budget.
 *
 * As they keep, swap and book suggestions, this fills and shifts: the feedback
 * that turns a pile of ideas into a plan they can afford. Server-rendered, no
 * interactivity — purely a read of computePlanBudget().
 */

import { Wallet } from 'lucide-react'
import { fmtMoney } from '@/lib/format'
import type { PlanBudget } from '@/lib/budget'

export function PlanBudgetBar({ data }: { data: PlanBudget }) {
  if (data.itemCount === 0) return null
  const { currency, budget, booked, planned, ideas, food, foodPerPersonPerDay, foodEstimateDays, committed, projected, partySize } = data

  // Diagonal-hatch fill marks the food figure as an estimate, not a choice the
  // traveller has made — visually softer than even the "ideas" wedge.
  const foodHatch = { backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 1.5px, transparent 1.5px 4px)' }

  // The bar represents the larger of "where they'd land" and the budget, so the
  // budget marker always sits somewhere on the track and overspend reads as fill
  // pushing past it.
  const denom = Math.max(projected, budget ?? 0, 1)
  const w = (n: number) => `${(n / denom) * 100}%`
  const budgetPos = budget != null ? Math.min(100, (budget / denom) * 100) : null

  const over = budget != null && committed > budget
  const remaining = budget != null ? budget - committed : null
  const projectionExceeds = budget != null && !over && projected > budget
  // What's driving the projected overage, for honest copy.
  const overDriver = ideas > 0 && food > 0 ? 'ideas + est. food' : food > 0 ? 'est. food' : 'ideas'

  return (
    <div className="rounded-2xl border border-line bg-paper-pure px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          <Wallet className="w-3.5 h-3.5" /> Planned spend
        </div>
        <div className="text-right leading-none">
          <span className="font-display text-2xl">{fmtMoney(committed, currency)}</span>
          {budget != null && <span className="text-ink-muted text-sm"> / {fmtMoney(budget, currency)}</span>}
          <span className="text-[10px] text-ink-muted num-mono ml-1.5">{currency}</span>
        </div>
      </div>

      {/* Stacked track with an optional budget marker */}
      <div className="relative mt-5 mb-1">
        {budgetPos != null && (
          <div className="absolute -top-3.5 bottom-0 z-10 flex flex-col items-center" style={{ left: `${budgetPos}%`, transform: 'translateX(-50%)' }}>
            <span className="text-[8px] uppercase tracking-[0.15em] text-ink-muted whitespace-nowrap mb-0.5">Budget</span>
            <span className="w-px flex-1 bg-ink/40" />
          </div>
        )}
        <div className="h-2.5 rounded-full bg-line-soft overflow-hidden flex">
          {booked > 0 && <span className="bg-sage-dark h-full" style={{ width: w(booked) }} />}
          {planned > 0 && <span className="bg-sage h-full" style={{ width: w(planned) }} />}
          {ideas > 0 && <span className="bg-sage/35 h-full" style={{ width: w(ideas) }} />}
          {food > 0 && <span className="bg-sage/30 h-full" style={{ width: w(food), ...foodHatch }} />}
        </div>
      </div>

      {/* Legend + headroom */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs">
        {booked > 0 && <Legend swatch="bg-sage-dark" label="Booked" value={fmtMoney(booked, currency)} />}
        {planned > 0 && <Legend swatch="bg-sage" label="Planned" value={fmtMoney(planned, currency)} />}
        {ideas > 0 && <Legend swatch="bg-sage/35" label="Ideas" value={fmtMoney(ideas, currency)} />}
        {food > 0 && <Legend swatch="bg-sage/30" swatchStyle={foodHatch} label="Est. food" value={fmtMoney(food, currency)} />}
        <span className="flex-1" />
        {budget != null ? (
          over ? (
            <span className="text-rust font-medium">{fmtMoney(committed - budget, currency)} over budget</span>
          ) : (
            <span className="text-ink-muted">
              {fmtMoney(remaining ?? 0, currency)} left
              {projectionExceeds && (
                <span className="text-rust"> · {overDriver} would go {fmtMoney(projected - budget, currency)} over</span>
              )}
            </span>
          )
        ) : (
          (ideas > 0 || food > 0) && (
            <span className="text-ink-muted">
              {fmtMoney(projected, currency)} projected
              {ideas > 0 && food > 0 ? ' (ideas + est. food)' : food > 0 ? ' (incl. est. food)' : ' if you keep every idea'}
            </span>
          )
        )}
      </div>

      {food > 0 && (
        <div className="text-[10px] text-ink-muted/70 mt-2">
          Includes an est. {fmtMoney(foodPerPersonPerDay, currency)}/person/day for food on {foodEstimateDays} {foodEstimateDays === 1 ? 'day' : 'days'} without a booked meal{partySize > 1 ? `, across all ${partySize} travellers` : ''}.
        </div>
      )}
      {food === 0 && partySize > 1 && (
        <div className="text-[10px] text-ink-muted/70 mt-2">Estimates cover all {partySize} travellers.</div>
      )}
    </div>
  )
}

function Legend({ swatch, label, value, swatchStyle }: { swatch: string; label: string; value: string; swatchStyle?: React.CSSProperties }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm ${swatch}`} style={swatchStyle} />
      <span className="text-ink-muted">{label}</span>
      <span className="num-mono">{value}</span>
    </span>
  )
}
