import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function Home() {
  const session = await auth()
  if (!session?.user) redirect('/signin')

  // If they have any trips, jump into the most imminent one. Otherwise go to the list (where they can create one).
  const nextTrip = await prisma.trip.findFirst({
    where: { memberships: { some: { userId: session.user.id } } },
    orderBy: { startDate: 'asc' },
  })
  if (nextTrip) redirect(`/trips/${nextTrip.slug}/overview`)
  redirect('/trips')
}
