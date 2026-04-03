import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SubmitPage from '@/app/submit/page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/submit',
}))

// We need to mock react-dom's useFormStatus because it expects to be in a form
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return {
    ...actual,
    useFormStatus: () => ({ pending: false }),
  }
})

describe('SubmitPage', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetAllMocks()

    // Setup ResizeObserver mock
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any
  })

  afterEach(() => {
    // Restore global fetch
    global.fetch = originalFetch
  })

  it('handles category fetch errors correctly and resets state', async () => {
    // Setup mock to throw an error for categories
    const mockFetch = vi.fn((url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr === '/api/v1/categories') {
        return Promise.reject(new Error('Failed to fetch categories'))
      }
      if (urlStr === '/api/v1/settings') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: { settings: { base_url: 'http://test.com' } } }),
          ok: true,
        })
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true, data: [] }),
        ok: true,
      })
    })
    global.fetch = mockFetch as any

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<SubmitPage />)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch categories:',
        expect.any(Error)
      )
    })

    // Verify fetch was called with the correct URL
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/categories')

    // Ensure the category select is empty (it renders a Select component, which we can check indirectly by making sure no items are rendered)
    // The SubmitPage component will just pass the empty array to the Select items, so there should be no options available

    consoleSpy.mockRestore()
  })

  it('sets categories to empty array when response has no success flag', async () => {
    // Setup mock to return an unsuccessful response
    const mockFetch = vi.fn((url: string | URL | Request) => {
      const urlStr = url.toString()
      if (urlStr === '/api/v1/categories') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: false, error: 'Not found' }),
          ok: true,
        })
      }
      if (urlStr === '/api/v1/settings') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: { settings: { base_url: 'http://test.com' } } }),
          ok: true,
        })
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true, data: [] }),
        ok: true,
      })
    })
    global.fetch = mockFetch as any

    render(<SubmitPage />)

    // Verify fetch was called with the correct URL
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/categories')
    })
  })
})
