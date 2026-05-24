import Link from 'next/link'
import { Mail } from 'lucide-react'

export const metadata = { title: 'Check your email · Voyage' }

export default function CheckEmailPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-paper px-6">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-sage grid place-items-center mx-auto mb-6">
          <Mail className="w-5 h-5 text-paper-pure" />
        </div>
        <h1 className="h-display text-4xl">Check your email.</h1>
        <p className="text-ink-muted mt-4">
          We just sent you a magic link. Click it to sign in. It might land in promotions or spam —
          if you don&apos;t see it in a minute, check there.
        </p>
        <Link href="/signin" className="text-xs text-ink-muted ulink mt-8 inline-block">
          ← back to sign-in
        </Link>
      </div>
    </main>
  )
}
