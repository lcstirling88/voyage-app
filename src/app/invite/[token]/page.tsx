import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { acceptInvitation } from '@/lib/actions'
import { ItineraBrand } from '@/components/ItineraBrand'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { trip: true, sender: true },
  })

  const session = await auth()

  if (!invitation) {
    return (
      <Shell>
        <X className="w-10 h-10 text-rust mx-auto mb-4" />
        <h1 className="h-display text-4xl">Invitation not found.</h1>
        <p className="text-ink-muted mt-3">This invite link is invalid or has already been used.</p>
      </Shell>
    )
  }

  if (invitation.acceptedAt) {
    return (
      <Shell>
        <Check className="w-10 h-10 text-sage mx-auto mb-4" />
        <h1 className="h-display text-4xl">Already accepted.</h1>
        <p className="text-ink-muted mt-3">This invite has been used. Sign in to see the trip.</p>
        <Link href="/" className="btn-ink mt-6 inline-flex">Go to Itinera</Link>
      </Shell>
    )
  }

  // Not signed in → bounce to sign-in with a callback that returns here
  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`)
  }

  // Wrong email
  if (session.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <Shell>
        <X className="w-10 h-10 text-rust mx-auto mb-4" />
        <h1 className="h-display text-4xl">Wrong account.</h1>
        <p className="text-ink-muted mt-3">
          This invite was sent to <strong className="num-mono">{invitation.email}</strong>, but you&apos;re signed in as{' '}
          <strong className="num-mono">{session.user.email}</strong>.
        </p>
        <p className="text-ink-muted mt-3 text-sm">Sign out, then click the link again from the right email.</p>
      </Shell>
    )
  }

  // Signed in as the right person — show the accept form
  return (
    <Shell>
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">You&apos;ve been invited</div>
      <h1 className="h-display text-4xl mt-2">{invitation.trip.name}.</h1>
      <p className="text-ink-muted mt-3">
        {invitation.sender.name ?? invitation.sender.email} is sharing their trip to <strong>{invitation.trip.destination}</strong> with you.
      </p>
      <form
        action={async () => {
          'use server'
          const res = await acceptInvitation(token)
          if (res.ok && res.slug) redirect(`/trips/${res.slug}/overview`)
        }}
        className="mt-6"
      >
        <button type="submit" className="btn-ink">Accept invitation</button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center px-6 bg-paper">
      <div className="max-w-md text-center">
        <div className="flex justify-center mb-6">
          <ItineraBrand size="md" />
        </div>
        {children}
      </div>
    </main>
  )
}
