import { redirect } from 'next/navigation'
import { auth } from './auth'
import { prisma } from './db'

/**
 * Server-only helper: returns the signed-in user, or redirects to /signin.
 * Use at the top of any server component / action that requires auth.
 */
export async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')
  return session.user
}

/**
 * Returns the user only if a trip exists and they're a member.
 * Otherwise redirects to /trips (or /signin if not authed at all).
 */
export async function requireTripAccess(tripSlug: string) {
  const user = await requireUser()
  const membership = await prisma.membership.findFirst({
    where: { user: { id: user.id }, trip: { slug: tripSlug } },
    include: { trip: true },
  })
  if (!membership) redirect('/trips')
  return { user, trip: membership.trip, role: membership.role }
}
