import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS home-screen icon. Apple ignores the manifest's icons and uses this one.
export default function AppleIcon() {
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
          fontSize: 110,
          fontFamily: 'Georgia, serif',
          fontWeight: 600,
          letterSpacing: -6,
        }}
      >
        V
      </div>
    ),
    { ...size },
  )
}
