// Full Markdown support with emoji processing
// Supports GFM (GitHub Flavored Markdown) + custom extensions

export interface MarkdownOptions {
  enableEmoji?: boolean
  enableGFM?: boolean
  enableSyntaxHighlight?: boolean
  enableTableOfContents?: boolean
  enableAnchors?: boolean
}

export interface TableOfContentsItem {
  id: string
  text: string
  level: number
}

// Common emoji shortcodes
const emojiShortcodes: Record<string, string> = {
  ':smile:': '😊', ':grin:': '😀', ':joy:': '😂', ':heart:': '❤️',
  ':thumbsup:': '👍', ':thumbsdown:': '👎', ':clap:': '👏', ':fire:': '🔥',
  ':rocket:': '🚀', ':star:': '⭐', ':sparkles:': '✨', ':zap:': '⚡',
  ':check:': '✅', ':x:': '❌', ':warning:': '⚠️', ':info:': 'ℹ️',
  ':question:': '❓', ':exclamation:': '❗', ':bulb:': '💡', ':memo:': '📝',
  ':book:': '📖', ':bookmark:': '🔖', ':link:': '🔗', ':lock:': '🔒',
  ':unlock:': '🔓', ':key:': '🔑', ':gear:': '⚙️', ':wrench:': '🔧',
  ':hammer:': '🔨', ':tools:': '🛠️', ':package:': '📦', ':inbox:': '📥',
  ':outbox:': '📤', ':email:': '📧', ':phone:': '📱', ':computer:': '💻',
  ':desktop:': '🖥️', ':globe:': '🌐', ':cloud:': '☁️', ':sun:': '☀️',
  ':moon:': '🌙', ':rainbow:': '🌈', ':umbrella:': '☔', ':snowflake:': '❄️',
  ':coffee:': '☕', ':pizza:': '🍕', ':beer:': '🍺', ':cake:': '🎂',
  ':gift:': '🎁', ':balloon:': '🎈', ':tada:': '🎉', ':trophy:': '🏆',
  ':medal:': '🏅', ':crown:': '👑', ':gem:': '💎', ':money:': '💰',
  ':chart:': '📊', ':graph:': '📈', ':calendar:': '📅', ':clock:': '🕐',
  ':hourglass:': '⏳', ':timer:': '⏱️', ':alarm:': '⏰', ':bell:': '🔔',
  ':speaker:': '🔊', ':mute:': '🔇', ':microphone:': '🎤', ':headphones:': '🎧',
  ':camera:': '📷', ':video:': '📹', ':movie:': '🎬', ':art:': '🎨',
  ':music:': '🎵', ':guitar:': '🎸', ':piano:': '🎹', ':drum:': '🥁',
  ':soccer:': '⚽', ':basketball:': '🏀', ':football:': '🏈', ':baseball:': '⚾',
  ':tennis:': '🎾', ':golf:': '⛳', ':ski:': '⛷️', ':swim:': '🏊',
  ':bike:': '🚴', ':run:': '🏃', ':walk:': '🚶', ':car:': '🚗',
  ':bus:': '🚌', ':train:': '🚆', ':plane:': '✈️', ':ship:': '🚢',
  ':satellite:': '🛰️', ':ufo:': '🛸', ':robot:': '🤖',
  ':alien:': '👽', ':ghost:': '👻', ':skull:': '💀', ':poop:': '💩',
  ':cat:': '🐱', ':dog:': '🐶', ':mouse:': '🐭', ':rabbit:': '🐰',
  ':fox:': '🦊', ':bear:': '🐻', ':panda:': '🐼', ':koala:': '🐨',
  ':tiger:': '🐯', ':lion:': '🦁', ':cow:': '🐮', ':pig:': '🐷',
  ':frog:': '🐸', ':monkey:': '🐵', ':chicken:': '🐔', ':penguin:': '🐧',
  ':bird:': '🐦', ':eagle:': '🦅', ':duck:': '🦆', ':owl:': '🦉',
  ':butterfly:': '🦋', ':bee:': '🐝', ':bug:': '🐛', ':snail:': '🐌',
  ':octopus:': '🐙', ':crab:': '🦀', ':fish:': '🐟', ':whale:': '🐋',
  ':dolphin:': '🐬', ':shark:': '🦈', ':turtle:': '🐢', ':snake:': '🐍',
  ':dragon:': '🐲', ':unicorn:': '🦄', ':horse:': '🐴', ':deer:': '🦌',
  ':tree:': '🌳', ':palm:': '🌴', ':cactus:': '🌵', ':flower:': '🌸',
  ':rose:': '🌹', ':sunflower:': '🌻', ':herb:': '🌿', ':leaf:': '🍃',
  ':apple:': '🍎', ':orange:': '🍊', ':lemon:': '🍋', ':banana:': '🍌',
  ':grape:': '🍇', ':strawberry:': '🍓', ':cherry:': '🍒', ':peach:': '🍑',
  ':mango:': '🥭', ':pineapple:': '🍍', ':coconut:': '🥥', ':avocado:': '🥑',
  ':eggplant:': '🍆', ':potato:': '🥔', ':carrot:': '🥕', ':corn:': '🌽',
  ':pepper:': '🌶️', ':cucumber:': '🥒', ':broccoli:': '🥦', ':mushroom:': '🍄',
  ':bread:': '🍞', ':croissant:': '🥐', ':cheese:': '🧀', ':egg:': '🥚',
  ':bacon:': '🥓', ':steak:': '🥩', ':drumstick:': '🍗', ':burger:': '🍔',
  ':fries:': '🍟', ':hotdog:': '🌭', ':taco:': '🌮', ':burrito:': '🌯',
  ':sushi:': '🍣', ':ramen:': '🍜', ':rice:': '🍚', ':curry:': '🍛',
  ':icecream:': '🍦', ':donut:': '🍩', ':cookie:': '🍪', ':chocolate:': '🍫',
  ':candy:': '🍬', ':popcorn:': '🍿', ':wine:': '🍷', ':cocktail:': '🍸',
  ':100:': '💯', ':1st:': '🥇', ':2nd:': '🥈', ':3rd:': '🥉',
  ':new:': '🆕', ':free:': '🆓', ':up:': '🆙', ':cool:': '🆒',
  ':ok:': '🆗', ':sos:': '🆘', ':no:': '🚫', ':stop:': '🛑',
  ':recycle:': '♻️', ':atom:': '⚛️', ':infinity:': '♾️', ':peace:': '☮️',
  ':yin_yang:': '☯️', ':cross:': '✝️', ':star_david:': '✡️', ':om:': '🕉️',
  ':wave:': '👋', ':point_up:': '☝️', ':point_down:': '👇', ':point_left:': '👈',
  ':point_right:': '👉', ':ok_hand:': '👌', ':v:': '✌️', ':crossed_fingers:': '🤞',
  ':love_you:': '🤟', ':metal:': '🤘', ':call:': '🤙', ':fist:': '✊',
  ':punch:': '👊', ':handshake:': '🤝', ':pray:': '🙏', ':muscle:': '💪',
  ':brain:': '🧠', ':eyes:': '👀', ':eye:': '👁️', ':ear:': '👂',
  ':nose:': '👃', ':lips:': '👄', ':tongue:': '👅', ':foot:': '🦶',
  ':leg:': '🦵', ':bone:': '🦴', ':tooth:': '🦷', ':baby:': '👶',
  ':boy:': '👦', ':girl:': '👧', ':man:': '👨', ':woman:': '👩',
  ':person:': '🧑', ':family:': '👨‍👩‍👧‍👦', ':couple:': '👫', ':kiss:': '💏',
  ':developer:': '👨‍💻', ':scientist:': '👨‍🔬', ':teacher:': '👨‍🏫', ':artist:': '👨‍🎨',
  ':cook:': '👨‍🍳', ':doctor:': '👨‍⚕️', ':farmer:': '👨‍🌾', ':astronaut:': '👨‍🚀',
}

// Convert emoji shortcodes to unicode
export function processEmoji(text: string): string {
  let result = text
  for (const [code, emoji] of Object.entries(emojiShortcodes)) {
    result = result.split(code).join(emoji)
  }
  return result
}

// Extract table of contents from markdown
export function extractTableOfContents(markdown: string): TableOfContentsItem[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const items: TableOfContentsItem[] = []
  let match
  
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    
    items.push({ id, text, level })
  }
  
  return items
}

// Escape HTML in text
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, char => htmlEscapes[char])
}

// Parse inline markdown (bold, italic, code, links, etc.)
function parseInline(text: string, enableEmoji: boolean = true): string {
  let result = escapeHtml(text)
  
  // Process emoji shortcodes first
  if (enableEmoji) {
    result = processEmoji(result)
  }
  
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

  // Images: ![alt](src)
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, src) => `<img src="${sanitizeUrl(src)}" alt="${alt}" loading="lazy" class="rounded-lg max-w-full" />`
  )
  
  // Links: [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, href) => `<a href="${sanitizeUrl(href)}" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">${text}</a>`
  )
  
  // Bold: **text** or __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  
  // Italic: *text* or _text_
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  result = result.replace(/_([^_]+)_/g, '<em>$1</em>')
  
  // Strikethrough: ~~text~~
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  
  // Inline code: `code`
  result = result.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-muted font-mono text-sm">$1</code>'
  )
  
  // Keyboard: [[key]]
  result = result.replace(
    /\[\[([^\]]+)\]\]/g,
    '<kbd class="px-2 py-1 rounded bg-muted border font-mono text-xs">$1</kbd>'
  )
  
  return result
}

// Parse markdown to HTML
export function parseMarkdown(
  markdown: string, 
  options: MarkdownOptions = {}
): string {
  const {
    enableEmoji = true,
    enableGFM = true,
    enableAnchors = true,
  } = options
  
  const lines = markdown.split('\n')
  const html: string[] = []
  let inCodeBlock = false
  let codeBlockLang = ''
  let codeBlockContent: string[] = []
  let inList = false
  let listType: 'ul' | 'ol' = 'ul'
  let inBlockquote = false
  let blockquoteContent: string[] = []
  let inTable = false
  let tableRows: string[][] = []
  let tableAlignments: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre class="rounded-lg bg-muted p-4 overflow-x-auto"><code class="language-${codeBlockLang || 'text'} font-mono text-sm">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`)
        codeBlockContent = []
        codeBlockLang = ''
        inCodeBlock = false
      } else {
        inCodeBlock = true
        codeBlockLang = line.slice(3).trim()
      }
      continue
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }
    
    // Tables (GFM)
    if (enableGFM && line.includes('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c !== '')
      
      if (cells.length > 0) {
        // Check if this is a separator row
        const isSeparator = cells.every(c => /^:?-+:?$/.test(c))
        
        if (isSeparator && tableRows.length === 1) {
          // This is the header separator, extract alignments
          tableAlignments = cells.map(c => {
            if (c.startsWith(':') && c.endsWith(':')) return 'center'
            if (c.endsWith(':')) return 'right'
            return 'left'
          })
          inTable = true
        } else if (inTable || tableRows.length === 0) {
          tableRows.push(cells)
          if (!inTable && tableRows.length === 1) {
            // Might be start of a table, wait for separator
            continue
          }
        }
        continue
      }
    }
    
    // End table if we hit a non-table line
    if (inTable && tableRows.length > 0) {
      html.push(renderTable(tableRows, tableAlignments))
      tableRows = []
      tableAlignments = []
      inTable = false
    }
    
    // Blockquotes
    if (line.startsWith('>')) {
      blockquoteContent.push(line.slice(1).trim())
      inBlockquote = true
      continue
    } else if (inBlockquote) {
      html.push(`<blockquote class="border-l-4 border-primary pl-4 my-4 italic text-muted-foreground">${parseInline(blockquoteContent.join('\n'), enableEmoji)}</blockquote>`)
      blockquoteContent = []
      inBlockquote = false
    }
    
    // Lists
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/)
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/)
    
    if (ulMatch) {
      if (!inList) {
        html.push('<ul class="list-disc pl-6 my-4 space-y-2">')
        inList = true
        listType = 'ul'
      }
      html.push(`<li>${parseInline(ulMatch[2], enableEmoji)}</li>`)
      continue
    } else if (olMatch) {
      if (!inList) {
        html.push('<ol class="list-decimal pl-6 my-4 space-y-2">')
        inList = true
        listType = 'ol'
      }
      html.push(`<li>${parseInline(olMatch[3], enableEmoji)}</li>`)
      continue
    } else if (inList && line.trim() === '') {
      html.push(listType === 'ul' ? '</ul>' : '</ol>')
      inList = false
    }
    
    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      const sizes = ['text-4xl', 'text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base']
      const anchor = enableAnchors 
        ? `<a href="#${id}" class="opacity-0 group-hover:opacity-100 ml-2 text-muted-foreground hover:text-primary">#</a>`
        : ''
      html.push(`<h${level} id="${id}" class="group ${sizes[level - 1]} font-bold mt-8 mb-4">${parseInline(text, enableEmoji)}${anchor}</h${level}>`)
      continue
    }
    
    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      html.push('<hr class="my-8 border-border" />')
      continue
    }
    
    // Task lists (GFM)
    if (enableGFM) {
      const taskMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/)
      if (taskMatch) {
        const checked = taskMatch[2].toLowerCase() === 'x'
        html.push(`<div class="flex items-center gap-2 my-1">
          <input type="checkbox" ${checked ? 'checked' : ''} disabled class="rounded" />
          <span${checked ? ' class="line-through text-muted-foreground"' : ''}>${parseInline(taskMatch[3], enableEmoji)}</span>
        </div>`)
        continue
      }
    }
    
    // Empty line
    if (line.trim() === '') {
      if (inList) {
        html.push(listType === 'ul' ? '</ul>' : '</ol>')
        inList = false
      }
      continue
    }
    
    // Regular paragraph
    html.push(`<p class="my-4 leading-relaxed">${parseInline(line, enableEmoji)}</p>`)
  }
  
  // Close any open elements
  if (inList) {
    html.push(listType === 'ul' ? '</ul>' : '</ol>')
  }
  if (inBlockquote && blockquoteContent.length > 0) {
    html.push(`<blockquote class="border-l-4 border-primary pl-4 my-4 italic text-muted-foreground">${parseInline(blockquoteContent.join('\n'), enableEmoji)}</blockquote>`)
  }
  if (inTable && tableRows.length > 0) {
    html.push(renderTable(tableRows, tableAlignments))
  }
  if (inCodeBlock && codeBlockContent.length > 0) {
    html.push(`<pre class="rounded-lg bg-muted p-4 overflow-x-auto"><code class="font-mono text-sm">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`)
  }
  
  return html.join('\n')
}

function renderTable(rows: string[][], alignments: string[]): string {
  if (rows.length === 0) return ''
  
  const headerRow = rows[0]
  const bodyRows = rows.slice(1)
  
  const alignClass = (i: number) => {
    const align = alignments[i] || 'left'
    if (align === 'center') return 'text-center'
    if (align === 'right') return 'text-right'
    return 'text-left'
  }
  
  let html = '<div class="overflow-x-auto my-4"><table class="w-full border-collapse">'
  
  // Header
  html += '<thead><tr class="border-b">'
  for (let i = 0; i < headerRow.length; i++) {
    html += `<th class="p-3 font-semibold ${alignClass(i)}">${parseInline(headerRow[i])}</th>`
  }
  html += '</tr></thead>'
  
  // Body
  if (bodyRows.length > 0) {
    html += '<tbody>'
    for (const row of bodyRows) {
      html += '<tr class="border-b">'
      for (let i = 0; i < row.length; i++) {
        html += `<td class="p-3 ${alignClass(i)}">${parseInline(row[i])}</td>`
      }
      html += '</tr>'
    }
    html += '</tbody>'
  }
  
  html += '</table></div>'
  return html
}

// Convert HTML to plain text (for descriptions, etc.)
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// Get a plain text excerpt
export function getExcerpt(markdown: string, maxLength: number = 200): string {
  const html = parseMarkdown(markdown, { enableEmoji: false })
  const text = htmlToPlainText(html)
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3).trim() + '...'
}
