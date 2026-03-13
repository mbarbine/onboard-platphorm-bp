import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DOCS_DIR = process.cwd()

// Map slugs to filenames
const SLUG_TO_FILE: Record<string, string> = {
  'readme': 'README.md',
  'architecture': 'ARCHITECTURE.md',
  'api': 'API.md',
  'contributing': 'CONTRIBUTING.md',
  'changelog': 'CHANGELOG.md',
  'security': 'SECURITY.md',
  'code_of_conduct': 'CODE_OF_CONDUCT.md',
  'code-of-conduct': 'CODE_OF_CONDUCT.md',
  'license': 'LICENSE',
  'design': 'DESIGN.md',
  'platform': 'PLATFORM.md',
  'coding': 'CODING.md',
}

interface RouteParams {
  params: Promise<{ slug: string }>
}

// GET /api/v1/docs/:slug - Get specific documentation file
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'
  
  const fileName = SLUG_TO_FILE[slug.toLowerCase()]
  
  if (!fileName) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Documentation not found: ${slug}`,
        available: Object.keys(SLUG_TO_FILE),
      },
    }, { status: 404 })
  }
  
  const filePath = path.join(DOCS_DIR, fileName)
  
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const stats = await fs.stat(filePath)
    
    // Return raw markdown
    if (format === 'raw' || format === 'md' || format === 'markdown') {
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'X-Document-Name': fileName,
          'X-Last-Modified': stats.mtime.toISOString(),
        },
      })
    }
    
    // Return plain text
    if (format === 'text') {
      // Strip markdown formatting for plain text
      const plainText = content
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
      
      return new NextResponse(plainText, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
    
    // Extract title (first # heading)
    const titleMatch = content.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1] : fileName.replace('.md', '')
    
    // Extract description (first paragraph after title)
    const descMatch = content.match(/^#[^\n]+\n+([^#\n][^\n]+)/m)
    const description = descMatch ? descMatch[1].trim() : ''
    
    // Count sections
    const sections = content.match(/^#{2,3}\s+.+$/gm) || []
    
    // Word count
    const wordCount = content.split(/\s+/).length
    
    // Reading time (200 wpm)
    const readingTime = Math.ceil(wordCount / 200)
    
    return NextResponse.json({
      success: true,
      data: {
        slug,
        fileName,
        title,
        description,
        content,
        wordCount,
        readingTime,
        sectionCount: sections.length,
        sections: sections.map(s => s.replace(/^#{2,3}\s+/, '')),
        lastModified: stats.mtime.toISOString(),
        size: stats.size,
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'FILE_ERROR',
        message: `Could not read documentation: ${slug}`,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 })
  }
}
