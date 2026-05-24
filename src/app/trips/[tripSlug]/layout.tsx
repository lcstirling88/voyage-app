import { prisma } from '@/lib/db'
import { requireTripAccess } from '@/lib/session'
import { Sidebar } from '@/components/Sidebar'
import { TopBar } from '@/components/TopBar'
import { SidebarStateProvider } from '@/components/SidebarStateProvider'

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tripSlug: string }>
}) {
  const { tripSlug } = await params
  const { trip, user } = await requireTripAccess(tripSlug)

  const emailCount = await prisma.incomingEmail.count({
    where: { tripId: trip.id, processed: false },
  })

  return (
    <SidebarStateProvider>
      <div className="lg:flex min-h-screen">
        <Sidebar trip={trip} emailCount={emailCount} currentUserId={user.id} />
        <main className="flex-1 min-w-0">
          <TopBar trip={trip} />
          {children}
        </main>
      </div>
    </SidebarStateProvider>
  )
}
