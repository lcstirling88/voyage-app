/**
 * Three-step header for the planner: 1 Route → 2 Interests → 3 Picks. Server
 * component (just links + styling). The current step is emphasised; the others
 * are navigable so the traveller can move back and forth. (Jumping straight to
 * Picks without choosing interests bounces back to Step 2, which has no themes
 * to work from.)
 */

import Link from 'next/link'
import { MapPin, Heart, Images } from 'lucide-react'

type Step = 'route' | 'interests' | 'picks'

function Pill({
  n, label, icon: Icon, active, href,
}: {
  n: number
  label: string
  icon: typeof MapPin
  active: boolean
  href: string
}) {
  const inner = (
    <span
      className={`inline-flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5 border transition ${
        active
          ? 'border-sage bg-sage text-paper-pure'
          : 'border-line bg-paper-pure text-ink-muted hover:border-sage hover:text-ink'
      }`}
    >
      <span
        className={`num-mono w-5 h-5 rounded-full grid place-items-center text-[11px] ${
          active ? 'bg-paper-pure/20 text-paper-pure' : 'bg-paper text-ink-muted'
        }`}
      >
        {n}
      </span>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs uppercase tracking-[0.16em] font-medium">{label}</span>
    </span>
  )
  return active ? inner : <Link href={href}>{inner}</Link>
}

export function PlanSteps({ tripSlug, current }: { tripSlug: string; current: Step }) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <Pill n={1} label="Route" icon={MapPin} active={current === 'route'} href={`/trips/${tripSlug}/plan`} />
      <span className="h-px w-5 bg-line" />
      <Pill n={2} label="Interests" icon={Heart} active={current === 'interests'} href={`/trips/${tripSlug}/plan/days`} />
      <span className="h-px w-5 bg-line" />
      <Pill n={3} label="Picks" icon={Images} active={current === 'picks'} href={`/trips/${tripSlug}/plan/picks`} />
    </div>
  )
}
