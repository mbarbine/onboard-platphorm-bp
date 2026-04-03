import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocaleSwitcher } from '@/components/locale-switcher'
import * as navigation from 'next/navigation'
import { locales, localeNames } from '@/lib/i18n'

// Mock next/navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}))

// Mock UI components to simplify testing
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: any) => (
    <button onClick={onClick} className={className} data-testid="locale-item">
      {children}
    </button>
  ),
}))

describe('LocaleSwitcher', () => {
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()

    // Setup default mock returns
    vi.mocked(navigation.useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    } as any)

    vi.mocked(navigation.usePathname).mockReturnValue('/current-path')
    vi.mocked(navigation.useSearchParams).mockReturnValue(new URLSearchParams('?foo=bar') as any)
  })

  it('renders the globe icon button', () => {
    render(<LocaleSwitcher />)

    const button = screen.getByRole('button', { name: /change language/i })
    expect(button).toBeInTheDocument()
  })

  it('renders all available locales in the dropdown', () => {
    render(<LocaleSwitcher />)

    // Check if all locales from i18n are rendered
    locales.forEach((locale) => {
      expect(screen.getByText(localeNames[locale])).toBeInTheDocument()
    })
  })

  it('highlights the current locale', () => {
    render(<LocaleSwitcher currentLocale="fr" />)

    // Check if 'fr' is highlighted
    const frMenuItem = screen.getByText(localeNames['fr'])
    expect(frMenuItem).toHaveClass('bg-accent')

    // Check if another locale is NOT highlighted
    const enMenuItem = screen.getByText(localeNames['en'])
    expect(enMenuItem).not.toHaveClass('bg-accent')
  })

  it('calls router.push with correct URL when a new locale is selected', async () => {
    const user = userEvent.setup()
    render(<LocaleSwitcher currentLocale="en" />)

    // Click on French locale
    const frMenuItem = screen.getByText(localeNames['fr'])
    await user.click(frMenuItem)

    // verify router.push was called with the updated search params
    expect(mockPush).toHaveBeenCalledWith('/current-path?foo=bar&locale=fr')
  })

  it('replaces existing locale parameter in URL', async () => {
    const user = userEvent.setup()
    vi.mocked(navigation.useSearchParams).mockReturnValue(new URLSearchParams('?locale=es&foo=bar') as any)

    render(<LocaleSwitcher currentLocale="es" />)

    // Click on German locale
    const deMenuItem = screen.getByText(localeNames['de'])
    await user.click(deMenuItem)

    // verify router.push was called and replaced the old locale
    expect(mockPush).toHaveBeenCalledWith('/current-path?locale=de&foo=bar')
  })
})
