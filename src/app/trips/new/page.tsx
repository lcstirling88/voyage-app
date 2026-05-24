import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { NewTripFormClient } from '@/components/NewTripFormClient'

export default function NewTripPage() {
  return (
    <main className="min-h-screen">
      <div className="hero-light border-b border-line">
        <div className="px-6 sm:px-10 py-8 sm:py-10 max-w-3xl">
          <Link href="/trips" className="text-xs text-ink-muted inline-flex items-center gap-1 ulink mb-6">
            <ChevronLeft className="w-3 h-3" /> Back to trips
          </Link>
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">New trip</div>
          <h1 className="h-display text-4xl sm:text-6xl mt-2">Start somewhere.</h1>
          <p className="text-ink-muted mt-3 max-w-xl text-sm sm:text-base">
            Just a name, a destination, and rough dates. The rest fills itself in as you forward emails.
          </p>
        </div>
      </div>

      <div className="px-4 sm:px-10 py-8 sm:py-12 max-w-3xl">
        <NewTripFormClient />
      </div>
    </main>
  )
}
