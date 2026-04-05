'use client'

import { useMemo, useState } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface MarkdownRendererProps {
  content: string
  className?: string
  showTableOfContents?: boolean
}

interface TOCItem {
  id: string
  text: string
  level: number
}

// Parse emoji shortcodes
function parseEmojiShortcodes(text: string): string {
  const shortcodeMap: Record<string, string> = {
    ':rocket:': '🚀', ':star:': '⭐', ':fire:': '🔥', ':check:': '✅', ':x:': '❌',
    ':warning:': '⚠️', ':info:': 'ℹ️', ':bulb:': '💡', ':book:': '📖', ':code:': '💻',
    ':gear:': '⚙️', ':link:': '🔗', ':search:': '🔍', ':sparkles:': '✨', ':zap:': '⚡',
    ':robot:': '🤖', ':heart:': '❤️', ':thumbsup:': '👍', ':eyes:': '👀', ':tada:': '🎉',
    ':memo:': '📝', ':hammer:': '🔨', ':wrench:': '🔧', ':key:': '🔑', ':lock:': '🔒',
    ':globe:': '🌐', ':package:': '📦', ':100:': '💯', ':trophy:': '🏆', ':gift:': '🎁',
  }
  
  let result = text
  for (const [shortcode, emoji] of Object.entries(shortcodeMap)) {
    result = result.split(shortcode).join(emoji)
  }
  return result
}

// Extract table of contents
function extractTOC(content: string): TOCItem[] {
  const items: TOCItem[] = []
  const headerRegex = /^(#{1,3})\s+(.+)$/gm
  let match
  
  while ((match = headerRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    items.push({ id, text, level })
  }
  
  return items
}

// Enhanced markdown parser
function parseMarkdown(content: string): string {
  let html = parseEmojiShortcodes(content)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Tables
  html = html.replace(/\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g, (_, header, body) => {
    const headers = header.split('|').filter(Boolean).map((h: string) => 
      `<th class="border border-border px-4 py-2 text-left font-semibold bg-muted">${h.trim()}</th>`
    ).join('')
    const rows = body.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter(Boolean).map((c: string) => 
        `<td class="border border-border px-4 py-2">${c.trim()}</td>`
      ).join('')
      return `<tr>${cells}</tr>`
    }).join('')
    return `<div class="overflow-x-auto my-6"><table class="w-full border-collapse"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`
  })

  // Code blocks with language and copy button placeholder
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang || 'text'
    const escapedCode = code.trim()
    return `<div class="relative group my-4">
      <div class="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <span class="text-xs text-muted-foreground">${langLabel}</span>
        <button class="copy-code-btn p-1 rounded hover:bg-muted focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-ring" data-code="${encodeURIComponent(escapedCode)}" aria-label="Copy code">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 text-zinc-100"><code class="language-${langLabel} text-sm font-mono">${escapedCode}</code></pre>
    </div>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-primary">$1</code>')

  // Task lists
  html = html.replace(/^\s*-\s*\[x\]\s+(.+)$/gm, '<li class="flex items-center gap-2"><span class="text-green-500">✅</span><span class="line-through text-muted-foreground">$1</span></li>')
  html = html.replace(/^\s*-\s*\[\s*\]\s+(.+)$/gm, '<li class="flex items-center gap-2"><span class="text-muted-foreground">⬜</span><span>$1</span></li>')

  // Callout boxes
  html = html.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:>.*\n?)*)/gim, (_, type, content) => {
    const typeConfig: Record<string, { icon: string, bg: string, border: string }> = {
      'NOTE': { icon: 'ℹ️', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-500' },
      'TIP': { icon: '💡', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-500' },
      'IMPORTANT': { icon: '❗', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-500' },
      'WARNING': { icon: '⚠️', bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-500' },
      'CAUTION': { icon: '🛑', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-500' },
    }
    const config = typeConfig[type.toUpperCase()] || typeConfig['NOTE']
    const cleanContent = content.replace(/^>\s*/gm, '').trim()
    return `<div class="my-4 p-4 rounded-lg border-l-4 ${config.bg} ${config.border}">
      <div class="flex items-center gap-2 font-semibold mb-2">${config.icon} ${type}</div>
      <div class="text-sm">${cleanContent}</div>
    </div>`
  })

  // Headers with anchors
  html = html.replace(/^### (.+)$/gm, (_, text) => {
    const id = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `<h3 id="${id}" class="group text-lg font-semibold mt-8 mb-4 scroll-mt-20">
      <a href="#${id}" class="no-underline hover:underline">${text}</a>
      <span class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ml-2 text-muted-foreground">#</span>
    </h3>`
  })
  html = html.replace(/^## (.+)$/gm, (_, text) => {
    const id = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `<h2 id="${id}" class="group text-xl font-semibold mt-10 mb-4 border-b pb-2 scroll-mt-20">
      <a href="#${id}" class="no-underline hover:underline">${text}</a>
      <span class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ml-2 text-muted-foreground">#</span>
    </h2>`
  })
  html = html.replace(/^# (.+)$/gm, (_, text) => {
    const id = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `<h1 id="${id}" class="group text-3xl font-bold mt-10 mb-6 scroll-mt-20">
      <a href="#${id}" class="no-underline hover:underline">${text}</a>
      <span class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ml-2 text-muted-foreground">#</span>
    </h1>`
  })

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="font-bold"><em>$1</em></strong>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
  html = html.replace(/__([^_]+)__/g, '<strong class="font-semibold">$1</strong>')
  html = html.replace(/_([^_]+)_/g, '<em class="italic">$1</em>')

  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, '<del class="line-through text-muted-foreground">$1</del>')

  // URL sanitizer to prevent XSS
  const sanitizeUrl = (url: string) => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return '#'

    // Decode HTML entities
    let decodedUrl = trimmedUrl
      .replace(/&amp;/gi, '&')
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&#([0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/&colon;/gi, ':')
      .replace(/&tab;/gi, '\t')
      .replace(/&newline;/gi, '\n')

    // Try to decode URL encodings
    try {
      decodedUrl = decodeURIComponent(decodedUrl)
    } catch {
      // Ignore malformed URI components
    }

    // Remove all whitespace and control characters that might bypass parser
    const cleanUrl = decodedUrl.replace(/[\x00-\x20\x7F-\x9F]/g, '')

    try {
      // Attempt to parse the URL to reliably get the protocol
      // Fallback to dummy base for relative URLs
      const parsedUrl = new URL(cleanUrl, 'http://dummy-base.local')
      const protocol = parsedUrl.protocol.toLowerCase()

      if (
        protocol === 'javascript:' ||
        protocol === 'vbscript:' ||
        (protocol === 'data:' && (
          parsedUrl.pathname.toLowerCase().startsWith('text/html') ||
          parsedUrl.pathname.toLowerCase().startsWith('text/javascript') ||
          parsedUrl.pathname.toLowerCase().startsWith('image/svg+xml') ||
          parsedUrl.pathname.toLowerCase().startsWith('application/xhtml+xml') ||
          parsedUrl.pathname.toLowerCase().startsWith('application/xml')
        ))
      ) {
        return '#'
      }
    } catch {
      // If native parsing fails, fallback to strict string checks on the cleaned URL
      const lowerClean = cleanUrl.toLowerCase()
      if (
        lowerClean.startsWith('javascript:') ||
        lowerClean.startsWith('vbscript:') ||
        lowerClean.startsWith('data:text/html') ||
        lowerClean.startsWith('data:text/javascript') ||
        lowerClean.startsWith('data:image/svg+xml') ||
        lowerClean.startsWith('data:application/xhtml+xml') ||
        lowerClean.startsWith('data:application/xml')
      ) {
        return '#'
      }
    }

    return url
  }

  // Images with lazy loading
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    return `<img src="${sanitizeUrl(src)}" alt="${alt}" class="rounded-lg my-4 max-w-full" loading="lazy" />`
  })

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    const safeHref = sanitizeUrl(href)
    const isExternal = safeHref.startsWith('http')
    return `<a href="${safeHref}" class="text-primary underline underline-offset-4 hover:text-primary/80"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}${isExternal ? ' ↗' : ''}</a>`
  })

  // Lists
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li class="ml-4">$1</li>')
  html = html.replace(/(<li class="ml-4">.*<\/li>\n?)+/g, '<ul class="list-disc space-y-2 my-4 pl-4">$&</ul>')

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>')

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-primary/50 pl-4 italic my-4 text-muted-foreground">$1</blockquote>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-8 border-border" />')
  html = html.replace(/^\*\*\*$/gm, '<hr class="my-8 border-border" />')

  // Footnotes
  html = html.replace(/\[\^(\d+)\]/g, '<sup class="text-primary cursor-pointer hover:underline">[$1]</sup>')

  // Keyboard shortcuts
  html = html.replace(/\[\[kbd:([^\]]+)\]\]/g, '<kbd class="px-2 py-1 rounded bg-muted border text-xs font-mono">$1</kbd>')

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p class="my-4 leading-7">')
  html = '<p class="my-4 leading-7">' + html + '</p>'

  // Clean up
  html = html.replace(/<p class="my-4 leading-7">\s*<\/p>/g, '')
  html = html.replace(/<p class="my-4 leading-7">(\s*<(h[1-6]|ul|ol|pre|blockquote|hr|div|table))/g, '$1')
  html = html.replace(/(<\/(h[1-6]|ul|ol|pre|blockquote|div|table)>)\s*<\/p>/g, '$1')

  return html
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy} aria-label={copied ? 'Copied!' : 'Copy code'}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Copied!' : 'Copy code'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function TableOfContents({ items }: { items: TOCItem[] }) {
  if (items.length === 0) return null

  return (
    <nav className="hidden xl:block fixed right-8 top-32 w-64 max-h-[calc(100vh-10rem)] overflow-y-auto">
      <div className="text-sm font-semibold mb-3">On this page</div>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
            <a
              href={`#${item.id}`}
              className="text-muted-foreground hover:text-foreground transition-colors block py-1"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function MarkdownRenderer({ content, className, showTableOfContents = false }: MarkdownRendererProps) {
  const { html, toc } = useMemo(() => {
    const rawHtml = parseMarkdown(content)
    return {
      html: DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['svg', 'path'],
        ADD_ATTR: ['stroke-linecap', 'stroke-linejoin', 'stroke-width', 'd', 'target']
      }),
      toc: extractTOC(content),
    }
  }, [content])

  return (
    <>
      {showTableOfContents && <TableOfContents items={toc} />}
      <div
        className={cn('prose prose-neutral dark:prose-invert max-w-none', className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  )
}
