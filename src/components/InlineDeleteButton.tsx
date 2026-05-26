'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteBooking, deleteDocument, deletePayment, deleteIncomingEmail } from '@/lib/actions'

const actions = {
  booking: deleteBooking,
  document: deleteDocument,
  payment: deletePayment,
  email: deleteIncomingEmail,
}

export function InlineDeleteButton({
  kind,
  id,
  tripSlug,
  label,
  size = 'sm',
}: {
  kind: 'booking' | 'document' | 'payment' | 'email'
  id: string
  tripSlug: string
  label?: string
  size?: 'sm' | 'md'
}) {
  const [armed, setArmed] = useState(false)
  const [pending, startTransition] = useTransition()
  const timer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function click(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!armed) {
      setArmed(true)
      timer.current = setTimeout(() => setArmed(false), 3000)
      return
    }
    if (timer.current) clearTimeout(timer.current)
    const fd = new FormData()
    fd.set('id', id)
    fd.set('tripSlug', tripSlug)
    startTransition(async () => {
      await actions[kind](fd)
    })
  }

  const base = size === 'md'
    ? 'px-2.5 py-1.5 text-xs'
    : 'px-2 py-1 text-[10px]'

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      className={`inline-flex items-center gap-1 rounded ${base} transition ${
        armed
          ? 'bg-wine text-paper-pure'
          : 'text-ink-muted hover:bg-line-soft hover:text-wine'
      }`}
      title={armed ? 'Click again to confirm' : (label ?? 'Delete')}
    >
      <Trash2 className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      {armed && <span>{pending ? 'Deleting…' : 'Confirm'}</span>}
    </button>
  )
}
