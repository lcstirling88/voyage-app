import { redirect } from 'next/navigation'

export default async function TripIndex({ params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params
  redirect(`/trips/${tripSlug}/overview`)
}
