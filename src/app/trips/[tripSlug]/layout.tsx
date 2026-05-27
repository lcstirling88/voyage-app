import { requireTripAccess } from '@/lib/session'
import { TopBar } from '@/components/TopBar'

/**
 * Trip layout — no sidebar. The previous left rail (trip switcher, feature
 * menu, profile footer) has been replaced by the app-tile grid on the
 * Overview page, which is the "home screen" of each trip. Navigation flows:
 *
 *   • Within a trip: tiles on Overview → feature page; breadcrumb back to
 *     Overview via the TopBar.
 *   • Switching trips: breadcrumb "Trips" → /trips list.
 *   • Sign-out / profile: the welcome page (/) carries the global nav.
 */
export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tripSlug: string }>
}) {
  const { tripSlug } = await params
  const { trip } = await requireTripAccess(tripSlug)

  return (
    <main className="min-h-screen">
      <TopBar trip={trip} />
      {children}
    </main>
  )
}
