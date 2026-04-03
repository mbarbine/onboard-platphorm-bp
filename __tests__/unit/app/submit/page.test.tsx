import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SubmitPage from '@/app/submit/page'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock ui components that might be causing issues
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/docs-layout', () => ({
  DocsLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="docs-layout">{children}</div>,
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SubmitPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Default fetch mocks
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/session') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'test-session',
            fingerprint: 'test-fingerprint',
            locale: 'en',
            geo: {},
            preferences: {},
            draft_content: {},
          }),
        })
      }
      if (url === '/api/v1/categories') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { flat: [{ slug: 'guides', name: 'Guides', description: null, icon: null, document_count: 0 }] },
          }),
        })
      }
      if (url === '/api/v1/settings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { settings: { base_url: 'https://test.com' } },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    })
  })

  it('displays network error message when url ingestion fetch fails', async () => {
    // Setup fetch to reject for the ingest endpoint, but succeed for others
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/session') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }
      if (url === '/api/v1/categories') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { flat: [] } }) })
      }
      if (url === '/api/v1/settings') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: { settings: {} } }) })
      }
      if (url === '/api/v1/ingest') {
        return Promise.reject(new Error('Network failure'))
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    render(<SubmitPage />)

    // Wait for the UI to settle
    await waitFor(() => {
      expect(screen.getByText('Submit Content')).toBeInTheDocument()
    })

    // Find the URL input and submit button
    const urlInput = screen.getByLabelText(/URL to Ingest/i)
    const ingestButton = screen.getByRole('button', { name: /Ingest Content/i })

    // Fill and submit
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } })
    fireEvent.click(ingestButton)

    // Verify error state
    expect(await screen.findByText('Network error. Please try again.')).toBeInTheDocument()
  })
})
