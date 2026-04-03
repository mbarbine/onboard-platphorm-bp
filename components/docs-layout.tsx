'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Book,
  Search,
  Menu,
  X,
  ChevronRight,
  FileText,
  Code,
  Terminal,
  Zap,
  Sun,
  Moon,
  ExternalLink,
  Github,
  Info,
  Settings,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { AccessibleThemeSwitcher } from '@/components/accessible-theme-switcher'
import { SITE_NAME, GITHUB_REPO } from '@/lib/site-config'

interface NavItem {
  title: string
  href: string
  icon?: React.ReactNode
  items?: NavItem[]
}

interface Category {
  slug: string
  name: string
  description: string | null
  icon: string | null
  document_count: number
}

interface DocsLayoutProps {
  children: React.ReactNode
  categories?: Category[]
}

const defaultNavItems: NavItem[] = [
  {
    title: 'Docs',
    href: '/docs',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    title: 'API Reference',
    href: '/docs/api',
    icon: <Code className="h-4 w-4" />,
  },
  {
    title: 'MCP Integration',
    href: '/docs/mcp',
    icon: <Zap className="h-4 w-4" />,
  },
  {
    title: 'Submit Content',
    href: '/submit',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
  },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard Next.js hydration guard
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="h-9 w-9"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

function SearchCommand() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard Next.js hydration guard
    setIsMac(navigator.platform?.toUpperCase().includes('MAC') || navigator.userAgent?.includes('Mac'))
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open])

  if (open) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="fixed left-1/2 top-1/4 w-full max-w-lg -translate-x-1/2 rounded-lg border bg-card p-4 shadow-lg">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documentation..."
              aria-label="Search documentation"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 focus-visible:ring-0"
              autoFocus
            />
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close search">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {query && (
            <div className="mt-4 space-y-2">
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                className="flex items-center gap-2 rounded-md p-2 hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                <Search className="h-4 w-4" />
                <span>Search for &quot;{query}&quot;</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:w-64"
      onClick={() => setOpen(true)}
    >
      <Search className="mr-2 h-4 w-4" />
      <span className="hidden sm:inline">Search docs...</span>
      <span className="inline sm:hidden">Search...</span>
      <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 sm:flex">
        <span className="text-xs">{isMac ? '⌘' : 'Ctrl'}</span>K
      </kbd>
    </Button>
  )
}

function Sidebar({
  items,
  categories,
}: {
  items: NavItem[]
  categories?: Category[]
}) {
  const pathname = usePathname()

  return (
    <TooltipProvider delayDuration={300}>
      <ScrollArea className="h-full py-6 pr-4">
        <div className="space-y-6">
        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.icon}
              {item.title}
            </Link>
          ))}
        </div>

        {categories && categories.length > 0 && (
          <div className="space-y-2">
            <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Categories
            </h4>
            <div className="space-y-1">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/docs/category/${cat.slug}`}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                    pathname === `/docs/category/${cat.slug}`
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className="h-3 w-3" />
                    {cat.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {cat.document_count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Resources
          </h4>
          <div className="space-y-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/api/docs"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Terminal className="h-4 w-4" />
                  API Docs
                  <ExternalLink className="ml-auto h-3 w-3" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                OpenAPI specification for all REST endpoints
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/llms.txt"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Zap className="h-4 w-4" />
                  llms.txt
                  <ExternalLink className="ml-auto h-3 w-3" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                LLM discovery file for AI agents
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        </div>
      </ScrollArea>
    </TooltipProvider>
  )
}

export function DocsLayout({ children, categories }: DocsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background">
        {/* Skip to content link for keyboard users */}
        <a 
          href="#main-content" 
          className="skip-to-content"
        >
          Skip to main content
        </a>
        
        {/* Header */}
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 md:px-6">
          <div className="flex items-center gap-2 md:gap-4">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="p-4 border-b">
                  <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Book className="h-5 w-5" />
                    {SITE_NAME}
                  </Link>
                </div>
                <Sidebar items={defaultNavItems} categories={categories} />
              </SheetContent>
            </Sheet>

            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Book className="h-5 w-5 text-primary" />
              <span className="hidden sm:inline">{SITE_NAME}</span>
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:flex">
              <SearchCommand />
            </div>
            <Button variant="ghost" size="icon" className="md:hidden" asChild>
              <Link href="/search">
                <Search className="h-5 w-5" />
                <span className="sr-only">Search</span>
              </Link>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" asChild>
                  <Link href={GITHUB_REPO} target="_blank" rel="noopener">
                    <Github className="h-5 w-5" />
                    <span className="sr-only">Clone on GitHub</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clone this repo on GitHub</TooltipContent>
            </Tooltip>
            <AccessibleThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r md:block">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden pl-4">
            <Sidebar items={defaultNavItems} categories={categories} />
          </div>
        </aside>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-hidden" tabIndex={-1}>
            <div className="container max-w-4xl py-8 px-4 md:px-8">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
