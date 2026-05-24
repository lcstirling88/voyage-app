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
  title: 'Voyage — travel, considered',
  description: 'Travel itineraries that build themselves. Forward a booking email; Voyage files it.',
  applicationName: 'Voyage',
  appleWebApp: {
    capable: true,
    title: 'Voyage',
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
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
