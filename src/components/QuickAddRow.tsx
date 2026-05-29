'use client'

/**
 * Inline "+ Add a plan or note" affordance that lives at the foot of every
 * itinerary session. Collapsed it's a quiet dashed link; tapped it expands into
 * a one-line composer with a Plan/Note toggle. Adding keeps the box open and
 * refocused so several items can be jotted in a row — the server component
 * re-renders under it via router.refresh() while this client island keeps its
 * own open/typed state.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { quickAddItem } from '@/lib/actions'

export function QuickAddRow({
  tripSlug, date, session,
}: {
  tripSlug: string
  date: string        // YYYY-MM-DD
  session: string     // morning | afternoon | night
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'plan' | 'note'>('plan')
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function add() {
    const t = title.trim()
    if (!t) return
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('date', date)
    fd.set('session', session)
    fd.set('kind', kind)
    fd.set('title', t)
    startTransition(async () => {
      const res = await quickAddItem(fd)
      if (res.ok) {
        setTitle('')
        router.refresh()
        inputRef.current?.focus()
      }
    })
  }

  function close() {
    setOpen(false)
    setTitle('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-1 py-1 text-xs italic text-ink-muted/60 hover:text-ink-muted transition"
      >
        <Plus className="w-3.5 h-3.5" /> Add a plan or note
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-paper-pure p-2">
      <div className="flex shrink-0 overflow-hidden rounded-md border border-line text-[10px] uppercase tracking-[0.12em]">
        <button
          type="button"
          onClick={() => setKind('plan')}
          className={kind === 'plan' ? 'px-2.5 py-1.5 bg-sage text-paper-pure' : 'px-2.5 py-1.5 text-ink-muted hover:bg-paper'}
        >
          Plan
        </button>
        <button
          type="button"
          onClick={() => setKind('note')}
          className={kind === 'note' ? 'px-2.5 py-1.5 bg-sage text-paper-pure' : 'px-2.5 py-1.5 text-ink-muted hover:bg-paper'}
        >
          Note
        </button>
      </div>
      <input
        ref={inputRef}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add() }
          if (e.key === 'Escape') { e.preventDefault(); close() }
        }}
        placeholder={kind === 'plan' ? 'e.g. Wander the old town' : 'e.g. Bring cash for the market'}
        className="input min-w-0 flex-1 py-1.5"
      />
      <button
        type="button"
        onClick={add}
        disabled={pending || !title.trim()}
        className="btn-ink shrink-0 text-xs disabled:opacity-50"
      >
        {pending ? '…' : 'Add'}
      </button>
      <button
        type="button"
        onClick={close}
        aria-label="Cancel"
        className="shrink-0 p-1 text-ink-muted hover:text-ink"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
