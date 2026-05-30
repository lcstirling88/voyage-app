import { requireTripAccess } from '@/lib/session'
import { TopBar } from '@/components/TopBar'
import { BottomNav } from '@/components/BottomNav'

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
    <main className="min-h-dvh">
      <TopBar trip={trip} />
      {/* Bottom padding clears the fixed mobile BottomNav (incl. safe-area
          inset). Removed at lg+ where the bar is hidden. */}
      <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
      <BottomNav tripSlug={tripSlug} />
    </main>
  )
}
