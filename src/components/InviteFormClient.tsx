'use client'

import { useState, useTransition } from 'react'
import { Send, Users, X } from 'lucide-react'
import { inviteToTrip, removeMember } from '@/lib/actions'

type Member = {
  id: string
  role: string
  user: { id: string; email: string | null; name: string | null }
}

export function InviteFormClient({
  tripSlug,
  members,
  currentUserId,
  isOwner,
}: {
  tripSlug: string
  members: Member[]
  currentUserId: string
  isOwner: boolean
}) {
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('email', email)
    startTransition(async () => {
      const res = await inviteToTrip(fd)
      if (res.ok) {
        setResult({
          ok: true,
          msg: res.emailSent
            ? `Invitation sent to ${email}.`
            : `${email} already has an Itinera account — added them directly.`,
        })
        setEmail('')
      } else {
        setResult({ ok: false, msg: res.error })
      }
    })
  }

  function remove(membershipId: string) {
    const fd = new FormData()
    fd.set('tripSlug', tripSlug)
    fd.set('membershipId', membershipId)
    startTransition(async () => { await removeMember(fd) })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <Users className="w-4 h-4 text-ink-muted" />
        <span className="text-ink-muted">People on this trip:</span>
      </div>

      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-3 border border-line rounded-lg bg-paper-pure">
            <div className="w-8 h-8 rounded-full bg-sage grid place-items-center text-paper-pure font-display text-sm">
              {(m.user.name ?? m.user.email ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {m.user.name ?? m.user.email}
                {m.user.id === currentUserId && <span className="text-xs text-ink-muted ml-2">(you)</span>}
              </div>
              <div className="text-xs text-ink-muted truncate">{m.user.email}</div>
            </div>
            <span className="pill pill-info">{m.role}</span>
            {isOwner && m.role !== 'owner' && (
              <button
                onClick={() => remove(m.id)}
                disabled={pending}
                title="Remove from trip"
                className="text-ink-muted hover:text-rust p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={submit} className="border border-line rounded-lg bg-paper-pure p-4 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Invite someone</div>
          <div className="flex gap-2">
            <input
              type="email"
              className="input flex-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="them@example.com"
              required
            />
            <button type="submit" disabled={pending || !email} className="btn-ink shrink-0">
              {pending ? 'Sending…' : <>Invite <Send className="w-3.5 h-3.5" /></>}
            </button>
          </div>
          {result && (
            <div className={`text-sm ${result.ok ? 'text-sage' : 'text-rust'}`}>
              {result.ok ? '✓ ' : '× '}{result.msg}
            </div>
          )}
          <p className="text-xs text-ink-muted">
            They&apos;ll get a magic-link email. Once they accept, they can see and edit everything on this trip.
          </p>
        </form>
      )}

      {!isOwner && (
        <p className="text-xs text-ink-muted italic">Only the trip owner can invite or remove people.</p>
      )}
    </div>
  )
}
