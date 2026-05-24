import { signIn } from '@/lib/auth'
import { Mail } from 'lucide-react'

export const metadata = { title: 'Sign in · Voyage' }

export default function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="min-h-screen grid place-items-center bg-paper px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-full bg-ink grid place-items-center mx-auto mb-4">
            <span className="font-display text-paper-pure text-2xl leading-none">V</span>
          </div>
          <h1 className="h-display text-5xl">Sign in.</h1>
          <p className="text-ink-muted text-sm mt-2">
            We&apos;ll email you a magic link. No passwords, ever.
          </p>
        </div>

        <ErrorBanner searchParams={searchParams} />

        <form
          action={async (formData) => {
            'use server'
            await signIn('resend', { email: formData.get('email'), redirectTo: '/' })
          }}
          className="border border-line rounded-2xl bg-paper-pure p-6 space-y-4"
        >
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Email</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoFocus
              className="input mt-1.5"
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" className="btn-ink w-full justify-center">
            <Mail className="w-4 h-4" /> Send magic link
          </button>
        </form>

        <p className="text-xs text-ink-muted text-center mt-6 max-w-sm mx-auto">
          By signing in you accept that this is an early product and we&apos;re still working out the edges.
        </p>
      </div>
    </main>
  )
}

async function ErrorBanner({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  if (!error) return null
  const message =
    error === 'EmailSignin' ? "Couldn't send the email — check the address and try again."
    : error === 'Configuration' ? 'Server is missing the email-sending config. Tell Liam.'
    : `Sign-in error: ${error}`
  return (
    <div className="border border-rust bg-sakura-soft rounded-lg p-4 text-sm mb-4">
      {message}
    </div>
  )
}
