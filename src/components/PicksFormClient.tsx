'use client'

/**
 * Planner Step 3 — "Specific picks". Itinera has turned the chosen themes into
 * the top-rated, named attractions for each city; we show them as image cards
 * (Wikipedia photos, with a themed gradient fallback) grouped by city and then
 * by theme. The traveller taps the ones that catch their eye and hits "Plan my
 * trip" — we hand the selected names (plus the broad themes) to generateTripPlan,
 * which drafts the day-by-day itinerary. A skip option lets Itinera choose.
 */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Check, Loader2, ArrowLeft } from 'lucide-react'
import { generateTripPlan } from '@/lib/actions'
import type { CityPicks, InterestTheme, LocationPick } from '@/lib/trip-planner'
import { themeIcon } from '@/components/theme-icons'

const FALLBACK_GRADIENT = 'linear-gradient(155deg, #7C8B6B 0%, #5B6B49 55%, #3E4A33 100%)'

/**
 * One selectable attraction card. Module-scope (not nested in the parent) so a
 * selection toggle re-renders it in place rather than remounting it — which
 * would otherwise reload every Wikipedia photo on each tap.
 */
function PickCard({
  pick, iconKey, selected, broken, onToggle, onBroken,
}: {
  pick: LocationPick
  iconKey: string
  selected: boolean
  broken: boolean
  onToggle: () => void
  onBroken: () => void
}) {
  const Icon = themeIcon(iconKey)
  const showImage = pick.image && !broken
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`group text-left rounded-xl overflow-hidden border bg-paper-pure transition ${
        selected ? 'border-sage ring-2 ring-sage' : 'border-line hover:border-sage'
      }`}
    >
      <div className="relative aspect-[4/3]" style={{ background: FALLBACK_GRADIENT }}>
        {showImage ? (
          /* eslint-disable-next-line @next/next/no-img-element -- Wikipedia CDN image, next/image needs domain config */
          <img
            src={pick.image as string}
            alt={pick.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
            onError={onBroken}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <Icon className="w-8 h-8 text-paper-pure/70" />
          </div>
        )}
        <span
          className={`absolute top-2 right-2 w-6 h-6 rounded-full grid place-items-center border transition ${
            selected ? 'bg-sage border-sage text-paper-pure' : 'bg-paper-pure/80 border-line text-transparent'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="p-3">
        <div className="text-sm font-medium leading-snug">{pick.name}</div>
        {pick.blurb && <div className="text-xs text-ink-muted mt-1 line-clamp-2">{pick.blurb}</div>}
      </div>
    </button>
  )
}

export function PicksFormClient({
  tripSlug, cityPicks, themes, budgetTier, budgetAmount, pace,
}: {
  tripSlug: string
  cityPicks: CityPicks[]
  themes: InterestTheme[]
  budgetTier: string
  budgetAmount: string
  pace: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const themeLabels = useMemo(() => themes.map((t) => t.label), [themes])
  const allItems = useMemo(
    () => cityPicks.flatMap((c) => c.picks.map((p) => ({ city: c.city, pick: p }))),
    [cityPicks],
  )
  const hasPicks = allItems.length > 0

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function markBroken(id: string) {
    setBroken((s) => {
      const next = new Set(s)
      next.add(id)
      return next
    })
  }

  function plan(useSelection: boolean) {
    setError(null)
    const names = useSelection
      ? allItems
          .filter(({ pick }) => selected.has(pick.id))
          .map(({ city, pick }) => `${pick.name} (${city})`)
      : []
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('interests', [...names, ...themeLabels].join('||'))
    fd.set('budgetTier', budgetTier)
    if (budgetAmount) fd.set('budgetAmount', budgetAmount)
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
    <div className="mt-7 sm:mt-9">
      <Link
        href={`/trips/${tripSlug}/plan/days`}
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink ulink"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to interests &amp; budget
      </Link>

      {!hasPicks ? (
        <div className="mt-6 rounded-2xl border border-line bg-paper-pure p-6 text-sm text-ink-soft">
          <p>
            Itinera couldn&rsquo;t pull specific picks just now. You can still let it draft your days from the
            interests you chose.
          </p>
          {error && <p className="text-rust mt-3">{error}</p>}
          <button
            type="button"
            onClick={() => plan(false)}
            disabled={pending}
            className="btn-ink inline-flex items-center gap-2 mt-4 disabled:opacity-50"
          >
            {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Planning…</> : <><Sparkles className="w-4 h-4" /> Let Itinera choose</>}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-7 space-y-10">
            {cityPicks.map((c) => {
              const groups = themes
                .map((t) => ({ theme: t, picks: c.picks.filter((p) => p.theme === t.id) }))
                .filter((g) => g.picks.length > 0)
              if (groups.length === 0) return null
              return (
                <section key={c.city}>
                  <h2 className="h-display text-2xl sm:text-3xl">{c.city}</h2>
                  {groups.map(({ theme, picks }) => {
                    const TIcon = themeIcon(theme.icon)
                    return (
                      <div key={theme.id} className="mt-5">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-3">
                          <TIcon className="w-3.5 h-3.5" /> {theme.label}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {picks.map((p) => (
                            <PickCard
                              key={p.id}
                              pick={p}
                              iconKey={theme.icon}
                              selected={selected.has(p.id)}
                              broken={broken.has(p.id)}
                              onToggle={() => toggle(p.id)}
                              onBroken={() => markBroken(p.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </section>
              )
            })}
          </div>

          {error && <div className="text-sm text-rust mt-6">{error}</div>}

          <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <button
              type="button"
              onClick={() => plan(true)}
              disabled={pending}
              className="btn-ink inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Itinera is planning…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Plan my trip{selected.size ? ` (${selected.size} picked)` : ''}</>
              )}
            </button>
            <button
              type="button"
              onClick={() => plan(false)}
              disabled={pending}
              className="text-sm text-ink-muted hover:text-ink ulink disabled:opacity-50"
            >
              Skip — let Itinera choose
            </button>
          </div>

          <p className="text-xs text-ink-muted/70 italic mt-5">
            Your picks become the backbone; Itinera groups them by area and fills the gaps. Everything lands as
            removable suggestions on your itinerary — keep what you like, delete the rest.
          </p>
        </>
      )}
    </div>
  )
}
