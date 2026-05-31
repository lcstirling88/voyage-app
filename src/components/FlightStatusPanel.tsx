import { Plane, PlaneTakeoff, PlaneLanding, Radar, ArrowRight } from 'lucide-react'
import type { FlightStatusData, FlightLegStatus } from '@/lib/flight-status'

/**
 * Live flight status, shown on a flight booking's detail page.
 *
 * Presentational only — the page decides whether to call AviationStack (gated
 * on the travel-day window + whether a key is configured) and hands us a
 * discriminated `view`. We always render the traveller's booked details; the
 * live board, a "tracking opens soon" note, a setup nudge, or an "add your
 * flight number" prompt layer on top depending on the view.
 */

export type FlightScheduled = {
  flightNumber: string
  airline: string
  fromCode: string
  toCode: string
  depTime: string   // 'HH:MM' (booked, wall-clock) or ''
  arrTime: string
  dateLabel: string // 'Thu 18 Jun' or ''
  terminal: string
  gate: string
  seat: string
  cabin: string
}

export type FlightStatusView =
  | { kind: 'live'; data: FlightStatusData }
  | { kind: 'scheduled'; note: string }   // before window / not found / API error
  | { kind: 'unconfigured' }              // no API key set
  | { kind: 'no_number' }                 // booking has no flight number yet

const PHASE_PILL: Record<string, { label: string; tone: 'good' | 'warn' | 'alarm' | 'muted' }> = {
  scheduled: { label: 'On time', tone: 'good' },
  active:    { label: 'In the air', tone: 'good' },
  landed:    { label: 'Landed', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'alarm' },
  incident:  { label: 'Incident', tone: 'alarm' },
  diverted:  { label: 'Diverted', tone: 'warn' },
  unknown:   { label: 'Status unknown', tone: 'muted' },
}

const TONE: Record<'good' | 'warn' | 'alarm' | 'muted', { dot: string; text: string; ring: string }> = {
  good:  { dot: 'bg-sage', text: 'text-sage', ring: 'border-sage' },
  warn:  { dot: 'bg-gold', text: 'text-gold', ring: 'border-gold' },
  alarm: { dot: 'bg-wine', text: 'text-wine', ring: 'border-wine' },
  muted: { dot: 'bg-ink-muted', text: 'text-ink-muted', ring: 'border-line' },
}

function fmtDelay(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Render an ISO instant in the airport's own timezone (HH:MM, 24h). */
function airportTime(iso: string | null, tz: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || 'UTC',
    }).format(d)
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
    }).format(d)
  }
}

/** One side of the live board (departure or arrival). */
function LegBoard({
  leg, fallbackCode, Icon, role,
}: {
  leg: FlightLegStatus
  fallbackCode: string
  Icon: typeof PlaneTakeoff
  role: 'Departs' | 'Arrives'
}) {
  const code = leg.iata || fallbackCode || '—'
  const sched = airportTime(leg.scheduledISO, leg.timezone)
  const live = airportTime(leg.actualISO ?? leg.estimatedISO, leg.timezone)
  const late = (leg.delayMin ?? 0) >= 1 && live != null && live !== sched

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        <Icon className="w-3.5 h-3.5" /> {role}
      </div>
      <div className="font-display text-2xl sm:text-3xl mt-1 leading-none">{code}</div>
      {leg.airport && (
        <div className="text-xs text-ink-muted mt-1 truncate">{leg.airport}</div>
      )}
      <div className="mt-2 flex items-baseline gap-2">
        {sched && (
          <span className={`num-mono ${late ? 'text-ink-muted line-through' : 'text-ink'}`}>{sched}</span>
        )}
        {late && <span className="num-mono text-gold font-medium">{live}</span>}
        {!sched && live && <span className="num-mono text-ink">{live}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-ink-muted">
        {leg.terminal && <span className="px-1.5 py-0.5 rounded border border-line">Terminal {leg.terminal}</span>}
        {leg.gate && <span className="px-1.5 py-0.5 rounded border border-line">Gate {leg.gate}</span>}
      </div>
    </div>
  )
}

function Chips({ scheduled }: { scheduled: FlightScheduled }) {
  const chips: string[] = []
  if (scheduled.terminal) chips.push(`Terminal ${scheduled.terminal}`)
  if (scheduled.gate) chips.push(`Gate ${scheduled.gate}`)
  if (scheduled.seat) chips.push(`Seat ${scheduled.seat}`)
  if (scheduled.cabin) chips.push(scheduled.cabin)
  if (chips.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-ink-muted">
      {chips.map((c) => (
        <span key={c} className="px-2 py-0.5 rounded-full border border-line num-mono">{c}</span>
      ))}
    </div>
  )
}

/** The booked route + time, shown for every non-live view. */
function ScheduledSummary({ scheduled }: { scheduled: FlightScheduled }) {
  const hasRoute = scheduled.fromCode || scheduled.toCode
  return (
    <div>
      {hasRoute && (
        <div className="flex items-center gap-2 font-display text-xl">
          <span>{scheduled.fromCode || '—'}</span>
          <ArrowRight className="w-4 h-4 text-ink-muted" />
          <span>{scheduled.toCode || '—'}</span>
        </div>
      )}
      {(scheduled.depTime || scheduled.dateLabel) && (
        <div className="text-sm text-ink-muted mt-1">
          {scheduled.dateLabel}
          {scheduled.depTime && <> · Departs <span className="num-mono">{scheduled.depTime}</span></>}
          {scheduled.arrTime && <> · Arrives <span className="num-mono">{scheduled.arrTime}</span></>}
        </div>
      )}
      <Chips scheduled={scheduled} />
    </div>
  )
}

export function FlightStatusPanel({
  scheduled, view,
}: {
  scheduled: FlightScheduled
  view: FlightStatusView
}) {
  const title = scheduled.flightNumber || 'This flight'
  const subtitle = scheduled.airline

  // Headline pill (live only). Delay/cancellation override the raw phase label.
  let pill: { label: string; tone: 'good' | 'warn' | 'alarm' | 'muted' } | null = null
  if (view.kind === 'live') {
    const base = PHASE_PILL[view.data.phase] ?? PHASE_PILL.unknown
    const maxDelay = Math.max(view.data.departure.delayMin ?? 0, view.data.arrival.delayMin ?? 0)
    if (view.data.phase === 'cancelled' || view.data.phase === 'incident') {
      pill = base
    } else if (view.data.phase === 'diverted') {
      pill = base
    } else if (maxDelay >= 1) {
      pill = { label: `Delayed ${fmtDelay(maxDelay)}`, tone: maxDelay >= 60 ? 'alarm' : 'warn' }
    } else {
      pill = base
    }
  }

  return (
    <section className="border border-line rounded-xl bg-paper-pure p-5 sm:p-6 mb-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Plane className="w-4 h-4 text-sage shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Flight status</div>
            <div className="font-display text-lg leading-tight truncate">
              {title}
              {subtitle && <span className="text-ink-muted font-sans text-sm"> · {subtitle}</span>}
            </div>
          </div>
        </div>
        {pill && (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shrink-0 ${TONE[pill.tone].ring} ${TONE[pill.tone].text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${TONE[pill.tone].dot}`} aria-hidden />
            {pill.label}
          </span>
        )}
      </div>

      <div className="mt-5">
        {view.kind === 'live' ? (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
              <LegBoard leg={view.data.departure} fallbackCode={scheduled.fromCode} Icon={PlaneTakeoff} role="Departs" />
              <div className="self-center pt-6 text-ink-muted/50">
                <ArrowRight className="w-5 h-5" />
              </div>
              <LegBoard leg={view.data.arrival} fallbackCode={scheduled.toCode} Icon={PlaneLanding} role="Arrives" />
            </div>
            {(scheduled.seat || scheduled.cabin) && (
              <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] text-ink-muted">
                {scheduled.seat && <span className="px-2 py-0.5 rounded-full border border-line num-mono">Seat {scheduled.seat}</span>}
                {scheduled.cabin && <span className="px-2 py-0.5 rounded-full border border-line">{scheduled.cabin}</span>}
              </div>
            )}
            <p className="text-[11px] text-ink-muted mt-4">
              Live data via AviationStack · checked {airportTime(view.data.fetchedAtISO, null)} UTC. Always confirm with your airline before travelling.
            </p>
          </>
        ) : (
          <>
            <ScheduledSummary scheduled={scheduled} />

            {view.kind === 'scheduled' && (
              <p className="text-[11px] text-ink-muted mt-4 flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5 shrink-0" /> {view.note}
              </p>
            )}

            {view.kind === 'no_number' && (
              <div className="mt-4 rounded-lg border border-dashed border-line bg-paper/40 p-3 text-[11px] text-ink-muted flex items-start gap-2">
                <Radar className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Add this flight&apos;s number (e.g. <span className="num-mono">QF25</span>) below to switch on live delay &amp; cancellation tracking.</span>
              </div>
            )}

            {view.kind === 'unconfigured' && (
              <div className="mt-4 rounded-lg border border-dashed border-line bg-paper/40 p-3 text-[11px] text-ink-muted flex items-start gap-2">
                <Radar className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Live delays, gates &amp; cancellations aren&apos;t connected yet. Add a free
                  {' '}<span className="num-mono">AVIATIONSTACK_API_KEY</span>{' '}
                  to enable real-time tracking for every flight.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
