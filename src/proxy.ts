// Next 16+ renamed "middleware" → "proxy". Functionality is identical.
// Auth.js exports a request handler we can use as the proxy directly; the
// authorized() callback in lib/auth.ts decides which routes require a session.

export { auth as proxy } from '@/lib/auth'

export const config = {
  // Run on everything except Next internals + static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|.*\\.png$|.*\\.svg$).*)'],
}
