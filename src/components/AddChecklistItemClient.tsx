'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { addChecklistItem } from '@/lib/actions'

export function AddChecklistItemClient({
  tripSlug,
  section,
  category,
}: {
  tripSlug: string
  section: string         // '3mo' | '1mo' | '1wk' | 'day_of' | 'packing'
  category?: string       // for packing: 'clothing' | 'tech' | ...
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!text.trim()) return
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('section', section)
    if (category) fd.set('category', category)
    fd.set('text', text)
    startTransition(async () => {
      await addChecklistItem(fd)
      setText('')
      // Keep input open and focused for multi-add
      inputRef.current?.focus()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="text-xs text-ink-muted hover:text-sage inline-flex items-center gap-1 mt-1"
      >
        <Plus className="w-3 h-3" /> Add item
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 mt-1">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add an item, press Enter…"
        className="input text-sm py-1.5"
      />
      <button type="submit" disabled={pending || !text.trim()} className="btn-ink text-xs">
        {pending ? '…' : 'Add'}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setText('') }}
        className="text-ink-muted hover:text-ink p-1"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </form>
  )
}
