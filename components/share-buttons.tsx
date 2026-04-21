'use client'

import { useState, useId } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Share2, Copy, Check, Mail, ExternalLink } from 'lucide-react'

interface ShareButtonsProps {
  url: string
  title: string
  description?: string
  compact?: boolean
}

interface ShareLink {
  name: string
  icon: string
  url: string
  color?: string
}

export function ShareButtons({ url, title, description = '', compact = false }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const shareLinks: ShareLink[] = [
    {
      name: 'Twitter',
      icon: '𝕏',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      color: 'hover:bg-black hover:text-white',
    },
    {
      name: 'LinkedIn',
      icon: '💼',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      color: 'hover:bg-blue-600 hover:text-white',
    },
    {
      name: 'Facebook',
      icon: '📘',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      color: 'hover:bg-blue-500 hover:text-white',
    },
    {
      name: 'Reddit',
      icon: '🔴',
      url: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
      color: 'hover:bg-orange-600 hover:text-white',
    },
  ]

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const emailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(description ? `${description}\n\n${url}` : url)}`

  if (compact) {
    return (
      <TooltipProvider delayDuration={300}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {shareLinks.map((link) => (
              <DropdownMenuItem key={link.name} asChild>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <span>{link.icon}</span>
                  {link.name}
                </a>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem asChild>
              <a href={emailUrl} className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyToClipboard} className="flex items-center gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-sm text-muted-foreground mr-1">Share:</span>
        
        {shareLinks.map((link) => (
          <Tooltip key={link.name}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${link.color}`}
                asChild
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Share on ${link.name}`}
                >
                  <span className="text-base">{link.icon}</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share on {link.name}</TooltipContent>
          </Tooltip>
        ))}
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              asChild
            >
              <a href={emailUrl} aria-label="Share via email">
                <Mail className="h-4 w-4" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share via email</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={copyToClipboard}
              aria-label={copied ? 'Copied!' : 'Copy link'}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? 'Copied!' : 'Copy link'}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

// Full share dialog for more detailed sharing
export function ShareDialog({ url, title, description = '' }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)
  const inputId = useId()
  const shareOnId = useId()

  const shareLinks: ShareLink[] = [
    { name: 'Twitter / X', icon: '𝕏', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}` },
    { name: 'LinkedIn', icon: '💼', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { name: 'Facebook', icon: '📘', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { name: 'Reddit', icon: '🔴', url: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
    { name: 'WhatsApp', icon: '💬', url: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { name: 'Telegram', icon: '📨', url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  ]

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Failed to copy')
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor={inputId} className="text-sm font-medium">Share link</label>
        <div className="flex gap-2">
          <input
            id={inputId}
            type="text"
            value={url}
            readOnly
            className="flex-1 px-3 py-2 text-sm border rounded-lg bg-muted"
          />
          <Button onClick={copyToClipboard} variant="outline" className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div id={shareOnId} className="text-sm font-medium">Share on</div>
        <div role="group" aria-labelledby={shareOnId} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {shareLinks.map((link) => (
            <Button
              key={link.name}
              variant="outline"
              className="gap-2 justify-start"
              asChild
            >
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <span>{link.icon}</span>
                <span className="truncate">{link.name}</span>
                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
              </a>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
