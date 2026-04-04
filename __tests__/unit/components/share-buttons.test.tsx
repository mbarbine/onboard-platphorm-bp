import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ShareButtons, ShareDialog } from '@/components/share-buttons'

// Mock Tooltip components
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: any) => {
    // If asChild is true, we should pass down children but maybe we don't need to intercept
    // React testing library allows firing events on the underlying element.
    return <>{children}</>
  },
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock DropdownMenu components
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children, asChild }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({ children, onClick, asChild, className }: any) => {
    if (asChild) {
      return <div onClick={onClick} className={className} data-testid="dropdown-item">{children}</div>
    }
    return <button onClick={onClick} className={className} data-testid="dropdown-item">{children}</button>
  },
}))

describe('ShareButtons', () => {
  const url = 'https://example.com/test'
  const title = 'Test Title'
  const description = 'Test Description'

  let writeTextMock: any

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined)

    // Completely replace navigator.clipboard object
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    })

    // Mock document.execCommand
    document.execCommand = vi.fn().mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders correctly with default non-compact mode', () => {
    render(<ShareButtons url={url} title={title} description={description} />)

    // Links should be present
    const twitterLink = screen.getByRole('link', { name: /share on twitter/i })
    expect(twitterLink).toHaveAttribute('href', expect.stringContaining('twitter.com'))

    const linkedInLink = screen.getByRole('link', { name: /share on linkedin/i })
    expect(linkedInLink).toHaveAttribute('href', expect.stringContaining('linkedin.com'))

    const facebookLink = screen.getByRole('link', { name: /share on facebook/i })
    expect(facebookLink).toHaveAttribute('href', expect.stringContaining('facebook.com'))

    const redditLink = screen.getByRole('link', { name: /share on reddit/i })
    expect(redditLink).toHaveAttribute('href', expect.stringContaining('reddit.com'))

    const emailLink = screen.getByRole('link', { name: /share via email/i })
    expect(emailLink).toHaveAttribute('href', expect.stringContaining('mailto:'))
  })

  it('copies link to clipboard when clicking copy button', async () => {
    render(<ShareButtons url={url} title={title} />)

    // We specifically look for the button containing "Copy link" text (inside visually hidden or tooltip)
    // Actually the button contains either <Copy /> or <Check /> and text might be in TooltipContent
    // The button has aria-label "Copy link"
    const copyButton = screen.getByRole('button', { name: 'Copy link' })

    fireEvent.click(copyButton)

    expect(writeTextMock).toHaveBeenCalledWith(url)

    // We wait for the aria-label to change if copied or just wait for mock
    await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled()
    })
  })

  it('falls back to execCommand if clipboard API fails', async () => {
    writeTextMock.mockRejectedValue(new Error('Clipboard error'))

    render(<ShareButtons url={url} title={title} />)

    const copyButton = screen.getByRole('button', { name: 'Copy link' })

    fireEvent.click(copyButton)

    await waitFor(() => {
        expect(document.execCommand).toHaveBeenCalledWith('copy')
    })
  })

  it('renders correctly in compact mode', () => {
    render(<ShareButtons url={url} title={title} compact={true} />)

    const shareButton = screen.getByRole('button', { name: /share/i })
    expect(shareButton).toBeInTheDocument()

    const copyButton = screen.getByText(/copy link/i)
    expect(copyButton).toBeInTheDocument()
  })
})

describe('ShareDialog', () => {
  const url = 'https://example.com/dialog'
  const title = 'Dialog Title'

  let writeTextMock: any

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all share links', () => {
    render(<ShareDialog url={url} title={title} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(6) // Twitter, LinkedIn, Facebook, Reddit, WhatsApp, Telegram
  })

  it('copies link to clipboard', async () => {
    render(<ShareDialog url={url} title={title} />)

    // The button has text "Copy" initially, changing to "Copied!"
    const copyButton = screen.getByRole('button', { name: /copy/i })

    fireEvent.click(copyButton)

    expect(writeTextMock).toHaveBeenCalledWith(url)

    const copiedText = await screen.findByText('Copied!')
    expect(copiedText).toBeInTheDocument()
  })
})
