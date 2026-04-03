import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocsLayout } from '@/components/docs-layout'
import { SITE_NAME } from '@/lib/site-config'

const mockUsePathname = vi.hoisted(() => vi.fn())
const mockUseTheme = vi.hoisted(() => vi.fn())
const mockSetTheme = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}))

vi.mock('next-themes', () => ({
  useTheme: mockUseTheme,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className, onClick, target, rel }: any) => (
    <a href={href} className={className} onClick={onClick} target={target} rel={rel} data-testid="mock-link">
      {children}
    </a>
  ),
}))

// Mock window.matchMedia if not already mocked in setup
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const mockCategories = [
  { slug: 'api', name: 'API Docs', description: 'API reference', icon: null, document_count: 5 },
  { slug: 'guides', name: 'Guides', description: 'User guides', icon: null, document_count: 2 },
]

describe('DocsLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePathname.mockReturnValue('/docs')
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: mockSetTheme })
  })

  it('renders children content correctly', () => {
    render(
      <DocsLayout>
        <div data-testid="child-content">Test Content</div>
      </DocsLayout>
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('renders the header with SITE_NAME', () => {
    render(
      <DocsLayout>
        <div>Content</div>
      </DocsLayout>
    )

    // Two SITE_NAME elements typically (one mobile, one desktop depending on responsive hiding, but checking if it's there is enough)
    const siteNames = screen.getAllByText(SITE_NAME)
    expect(siteNames.length).toBeGreaterThan(0)
  })

  it('includes skip to main content link for accessibility', () => {
    render(
      <DocsLayout>
        <div>Content</div>
      </DocsLayout>
    )

    const skipLink = screen.getByText('Skip to main content')
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('renders default sidebar items', () => {
    render(
      <DocsLayout>
        <div>Content</div>
      </DocsLayout>
    )

    // These should exist in the sidebar
    expect(screen.getAllByText('Docs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('API Reference').length).toBeGreaterThan(0)
  })

  it('renders categories in sidebar when provided', () => {
    render(
      <DocsLayout categories={mockCategories}>
        <div>Content</div>
      </DocsLayout>
    )

    expect(screen.getAllByText('Categories').length).toBeGreaterThan(0)
    expect(screen.getAllByText('API Docs').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Guides').length).toBeGreaterThan(0)

    // Category document counts should also be visible
    expect(screen.getAllByText('5').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  it('opens and closes search dialog', async () => {
    render(
      <DocsLayout>
        <div>Content</div>
      </DocsLayout>
    )

    const user = userEvent.setup()

    // Search for the search button text or aria-label
    // There are a few search buttons, let's find the main one
    const searchButtons = screen.getAllByRole('button', { name: /search/i })

    // Click the desktop search button to open the command palette
    await user.click(searchButtons[0])

    // The search input inside the dialog should appear
    const searchInput = screen.getByPlaceholderText('Search documentation...')
    expect(searchInput).toBeInTheDocument()

    // Close it
    const closeButton = screen.getByLabelText('Close search')
    await user.click(closeButton)

    // Search input should be gone
    expect(screen.queryByPlaceholderText('Search documentation...')).not.toBeInTheDocument()
  })
})
