import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DOCS_DIR = process.cwd()

// Available documentation files
const DOC_FILES = [
  'README.md',
  'ARCHITECTURE.md',
  'API.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTORS.md',
  'LOGGING.md',
  'VERSION.md',
  'DESIGN.md',
  'PLATFORM.md',
  'CODING.md',
] as const

type DocFile = typeof DOC_FILES[number]

interface DocMetadata {
  name: string
  slug: string
  path: string
  url: string
  description: string
  category: string
}

const DOC_METADATA: Record<string, Omit<DocMetadata, 'name' | 'slug' | 'path' | 'url'>> = {
  'README.md': { description: 'Project overview and quick start guide', category: 'overview' },
  'ARCHITECTURE.md': { description: 'System design and data flow', category: 'technical' },
  'API.md': { description: 'REST and MCP API reference', category: 'api' },
  'CONTRIBUTING.md': { description: 'Contribution guidelines', category: 'community' },
  'CHANGELOG.md': { description: 'Version history and release notes', category: 'releases' },
  'SECURITY.md': { description: 'Security policy and reporting', category: 'security' },
  'CODE_OF_CONDUCT.md': { description: 'Community guidelines', category: 'community' },
  'CONTRIBUTORS.md': { description: 'Project contributors', category: 'community' },
  'LOGGING.md': { description: 'Logging strategies and standards', category: 'development' },
  'VERSION.md': { description: 'Version information and compatibility', category: 'releases' },
  'DESIGN.md': { description: 'UI/UX design system and visual language', category: 'design' },
  'PLATFORM.md': { description: 'Platform architecture and infrastructure overview', category: 'technical' },
  'CODING.md': { description: 'Coding standards and development practices', category: 'development' },
}

// GET /api/v1/docs - List all available documentation
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const format = searchParams.get('format') || 'json'
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://docs.platphormnews.com'
  
  const docs: DocMetadata[] = []
  
  for (const file of DOC_FILES) {
    const filePath = path.join(DOCS_DIR, file)
    try {
      await fs.access(filePath)
      const slug = file.replace('.md', '').toLowerCase()
      const meta = DOC_METADATA[file] || { description: '', category: 'other' }
      
      if (category && meta.category !== category) continue
      
      docs.push({
        name: file,
        slug,
        path: `/${file}`,
        url: `${baseUrl}/api/v1/docs/${slug}`,
        ...meta,
      })
    } catch {
      // File doesn't exist, skip
    }
  }
  
  if (format === 'text') {
    const text = docs.map(d => `${d.name}: ${d.url}`).join('\n')
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  
  return NextResponse.json({
    success: true,
    data: docs,
    meta: {
      total: docs.length,
      categories: [...new Set(docs.map(d => d.category))],
    },
  })
}
