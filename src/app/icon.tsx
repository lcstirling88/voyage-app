import { ImageResponse } from 'next/og'

export function generateImageMetadata() {
  return [
    { id: 'small',    contentType: 'image/png', size: { width: 192, height: 192 } },
    { id: 'large',    contentType: 'image/png', size: { width: 512, height: 512 } },
    { id: 'maskable', contentType: 'image/png', size: { width: 512, height: 512 } },
  ]
}

export default function Icon({ id }: { id: string }) {
  const size = id === 'small' ? 192 : 512
  // maskable needs a "safe zone" inset so Android can crop it into any shape
  const isMaskable = id === 'maskable'
  const fontSize = isMaskable ? Math.round(size * 0.42) : Math.round(size * 0.62)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0F1413',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FBF8F1',
          fontSize,
          fontFamily: 'Georgia, serif',
          fontWeight: 600,
          letterSpacing: -8,
        }}
      >
        V
      </div>
    ),
    { width: size, height: size },
  )
}
