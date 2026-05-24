import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './db'

const fromEmail = process.env.AUTH_RESEND_FROM ?? 'Voyage <onboarding@resend.dev>'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: fromEmail,
    }),
  ],
  pages: {
    signIn: '/signin',
    verifyRequest: '/signin/check-email',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) session.user.id = user.id
      return session
    },
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname
      const isAuthed = !!auth?.user
      // Public routes
      if (path === '/' || path.startsWith('/signin') || path.startsWith('/api/auth') || path.startsWith('/api/email/inbound')) {
        return true
      }
      // Everything else under /trips needs a session
      if (path.startsWith('/trips')) return isAuthed
      return true
    },
  },
})

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
