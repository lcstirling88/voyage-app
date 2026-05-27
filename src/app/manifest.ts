import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Itinera',
    short_name: 'Itinera',
    description: 'Travel itineraries that build themselves.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F6F2E9',
    theme_color: '#0F1413',
    categories: ['travel', 'productivity', 'lifestyle'],
    icons: [
      { src: '/icon/small',  sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/large',  sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
