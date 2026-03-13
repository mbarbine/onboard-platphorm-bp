import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') || 'OpenDocs'
  const description = searchParams.get('description') || 'MCP-Enabled Documentation Platform'
  const emoji = searchParams.get('emoji') || '📄'
  const category = searchParams.get('category') || ''

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#09090b',
          padding: '60px 80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              fontSize: '48px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              borderRadius: '12px',
              padding: '12px 20px',
            }}
          >
            {emoji}
          </div>
          {category && (
            <div
              style={{
                fontSize: '24px',
                color: '#a1a1aa',
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              {category}
            </div>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxWidth: '900px',
          }}
        >
          <div
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: '#fafafa',
              lineHeight: 1.1,
              letterSpacing: '-2px',
            }}
          >
            {title.length > 60 ? title.substring(0, 60) + '...' : title}
          </div>
          {description && (
            <div
              style={{
                fontSize: '28px',
                color: '#a1a1aa',
                lineHeight: 1.4,
              }}
            >
              {description.length > 120 ? description.substring(0, 120) + '...' : description}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
            <span style={{ fontSize: '24px', color: '#fafafa', fontWeight: 600 }}>
              OpenDocs
            </span>
          </div>
          <div
            style={{
              fontSize: '20px',
              color: '#71717a',
            }}
          >
            docs.platphormnews.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
