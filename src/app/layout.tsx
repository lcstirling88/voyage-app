import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'opsz'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Itinera — the art of the journey',
  description: 'Travel itineraries that build themselves. Forward a booking email; Itinera files it.',
  applicationName: 'Itinera',
  appleWebApp: {
    capable: true,
    title: 'Itinera',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#0F1413',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // NOTE: do NOT pin <html> to height:100% (e.g. `h-full`). In an installed
    // PWA (iOS standalone), a fixed-height root clips the document and content
    // below the first viewport becomes unscrollable. Let the body grow with the
    // dynamic viewport instead (min-h-dvh) so long pages scroll fully.
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
