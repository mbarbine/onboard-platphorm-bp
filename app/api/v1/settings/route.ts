import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import crypto from 'crypto'
import { SITE_NAME, BASE_URL, GITHUB_REPO } from '@/lib/site-config'

const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001'

// Default values for comparison
const DEFAULTS: Record<string, string> = {
  auto_approve_submissions: 'false',
  admin_password_hash: '""',
  base_url: '"https://docs.platphormnews.com"',
  default_locale: '"en"',
  site_name: JSON.stringify(SITE_NAME),
  github_repo: JSON.stringify(GITHUB_REPO),
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

export async function GET() {
  try {
    const settings = await sql`
      SELECT key, value FROM settings 
      WHERE tenant_id = ${DEFAULT_TENANT}
    `
    
    const integrations = await sql`
      SELECT id, name, base_url, api_path, mcp_path, enabled, settings
      FROM integrations
      WHERE tenant_id = ${DEFAULT_TENANT}
      ORDER BY name ASC
    `
    
    const settingsObj: Record<string, unknown> = {}
    for (const row of settings) {
      try {
        settingsObj[row.key] = JSON.parse(row.value as string)
      } catch {
        settingsObj[row.key] = row.value
      }
    }
    
    // Check if password is set (don't send the actual hash)
    settingsObj.password_is_set = settingsObj.admin_password_hash !== ''
    delete settingsObj.admin_password_hash
    
    return NextResponse.json({
      success: true,
      data: {
        settings: settingsObj,
        integrations,
        defaults: Object.fromEntries(
          Object.entries(DEFAULTS).map(([k, v]) => [k, JSON.parse(v)])
        ),
      },
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { settings, integrations, admin_password, new_admin_password } = body
    
    // Check if any defaults have changed
    let hasChangedDefaults = false
    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        if (key === 'admin_password_hash') continue
        const defaultVal = DEFAULTS[key]
        if (defaultVal && JSON.stringify(value) !== defaultVal) {
          hasChangedDefaults = true
          break
        }
      }
    }
    
    // If defaults changed, verify admin password
    if (hasChangedDefaults) {
      const currentHash = await sql`
        SELECT value FROM settings 
        WHERE tenant_id = ${DEFAULT_TENANT} AND key = 'admin_password_hash'
      `
      
      const storedHash = currentHash[0]?.value ? JSON.parse(currentHash[0].value as string) : ''
      
      // If password is set, verify it
      if (storedHash && storedHash !== '') {
        if (!admin_password || !verifyPassword(admin_password, storedHash)) {
          return NextResponse.json(
            { success: false, error: 'Admin password required to save changes' },
            { status: 401 }
          )
        }
      }
    }
    
    // Update settings
    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        if (key === 'password_is_set') continue
        
        await sql`
          INSERT INTO settings (tenant_id, key, value, updated_at)
          VALUES (${DEFAULT_TENANT}, ${key}, ${JSON.stringify(value)}, NOW())
          ON CONFLICT (tenant_id, key) 
          DO UPDATE SET value = ${JSON.stringify(value)}, updated_at = NOW()
        `
      }
    }
    
    // Update admin password if new one provided
    if (new_admin_password) {
      const newHash = hashPassword(new_admin_password)
      await sql`
        INSERT INTO settings (tenant_id, key, value, updated_at)
        VALUES (${DEFAULT_TENANT}, 'admin_password_hash', ${JSON.stringify(newHash)}, NOW())
        ON CONFLICT (tenant_id, key) 
        DO UPDATE SET value = ${JSON.stringify(newHash)}, updated_at = NOW()
      `
    }
    
    // Update integrations
    if (integrations && Array.isArray(integrations)) {
      for (const integration of integrations) {
        await sql`
          UPDATE integrations 
          SET base_url = ${integration.base_url},
              api_path = ${integration.api_path || '/api'},
              mcp_path = ${integration.mcp_path || '/api/mcp'},
              enabled = ${integration.enabled},
              settings = ${JSON.stringify(integration.settings || {})},
              updated_at = NOW()
          WHERE id = ${integration.id} AND tenant_id = ${DEFAULT_TENANT}
        `
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
    })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
