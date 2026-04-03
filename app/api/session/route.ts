import logger from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateSession, saveDraftToSession, getDraftFromSession, updateSessionPreferences } from '@/lib/fingerprint'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getOrCreateSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({
      session_id: session.id,
      fingerprint: session.fingerprint_ja4,
      locale: session.locale,
      geo: {
        country: session.geo_country,
        region: session.geo_region,
        city: session.geo_city,
      },
      preferences: session.preferences,
      draft_content: session.draft_content,
      expires_at: session.expires_at,
    })
  } catch (error) {
    logger.error('[v0] Session GET error', { error: error instanceof Error ? error : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getOrCreateSession()
    if (!session) {
      return NextResponse.json({ error: 'Failed to get session' }, { status: 500 })
    }

    const body = await request.json()
    const { action, key, data } = body

    switch (action) {
      case 'save_draft':
        if (!key || !data) {
          return NextResponse.json({ error: 'Missing key or data' }, { status: 400 })
        }
        await saveDraftToSession(session.id, key, data)
        return NextResponse.json({ success: true, message: 'Draft saved' })

      case 'get_draft':
        if (!key) {
          return NextResponse.json({ error: 'Missing key' }, { status: 400 })
        }
        const draft = await getDraftFromSession(session.id, key)
        return NextResponse.json({ draft })

      case 'update_preferences':
        if (!data) {
          return NextResponse.json({ error: 'Missing data' }, { status: 400 })
        }
        await updateSessionPreferences(session.id, data)
        return NextResponse.json({ success: true, message: 'Preferences updated' })

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    logger.error('[v0] Session POST error', { error: error instanceof Error ? error : String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
