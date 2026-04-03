import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccessibleThemeSwitcher } from '@/components/accessible-theme-switcher'
import { useTheme } from 'next-themes'

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}))

// We need a stable matchMedia for animations/hooks that might rely on it
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

describe('AccessibleThemeSwitcher', () => {
  const mockSetTheme = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      themes: ['light', 'dark', 'system'],
      systemTheme: 'light',
    })

    // Clear localStorage
    window.localStorage.clear()

    // Mock classList for document.documentElement
    document.documentElement.classList.remove = vi.fn()
    document.documentElement.classList.add = vi.fn()
  })

  it('renders the trigger button', () => {
    render(<AccessibleThemeSwitcher />)
    const button = screen.getByRole('button', { name: /open theme settings/i })
    expect(button).toBeInTheDocument()
  })

  it('opens and closes the panel when clicking the trigger button', async () => {
    const user = userEvent.setup()
    render(<AccessibleThemeSwitcher />)

    const trigger = screen.getByRole('button', { name: /open theme settings/i })

    // Panel should be hidden initially
    const panel = screen.getByRole('dialog', { name: /theme settings/i, hidden: true })
    expect(panel).toHaveClass('opacity-0')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    // Click to open
    await user.click(trigger)
    expect(panel).toHaveClass('opacity-100')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-label', 'Close theme settings')

    // Click to close (using close button in header, using aria-label)
    const closeBtn = screen.getByRole('button', { name: 'Close' })
    await user.click(closeBtn)
    expect(panel).toHaveClass('opacity-0')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('displays theme options and calls setTheme when clicked', async () => {
    const user = userEvent.setup()
    render(<AccessibleThemeSwitcher />)

    // Open panel
    await user.click(screen.getByRole('button', { name: /open theme settings/i }))

    // Find theme buttons by role
    const themeRadios = screen.getAllByRole('radio')

    // Check specific theme options
    const systemThemeBtn = themeRadios.find(el => el.textContent?.includes('System'))
    const lightThemeBtn = themeRadios.find(el => el.textContent?.includes('Light'))
    const darkThemeBtn = themeRadios.find(el => el.textContent?.includes('Dark'))

    expect(systemThemeBtn).toBeDefined()
    expect(lightThemeBtn).toBeDefined()
    expect(darkThemeBtn).toBeDefined()

    // Verify current selected theme ('light' is selected per mock setup)
    expect(lightThemeBtn).toHaveAttribute('aria-checked', 'true')
    expect(darkThemeBtn).toHaveAttribute('aria-checked', 'false')

    // Click dark theme
    await user.click(darkThemeBtn!)
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('toggles accessibility options and handles high contrast mode', async () => {
    const user = userEvent.setup()
    render(<AccessibleThemeSwitcher />)

    // Open panel
    await user.click(screen.getByRole('button', { name: /open theme settings/i }))

    // Expand high contrast section
    const a11yToggle = screen.getByRole('button', { name: /high contrast/i })
    expect(a11yToggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(a11yToggle)
    expect(a11yToggle).toHaveAttribute('aria-expanded', 'true')

    // Find high contrast options
    const radios = screen.getAllByRole('radio')
    const hcLight = radios.find(el => el.textContent?.includes('High Contrast Light'))
    const hcDark = radios.find(el => el.textContent?.includes('High Contrast Dark'))

    expect(hcLight).toBeDefined()
    expect(hcDark).toBeDefined()

    // Select high contrast light
    await user.click(hcLight!)

    // It should store the preference in localStorage
    expect(window.localStorage.getItem('onboard-high-contrast')).toBe('high-contrast-light')

    // Selecting high contrast should disable theme options
    const updatedRadios = screen.getAllByRole('radio')
    const lightThemeBtn = updatedRadios.find(el => el.textContent?.includes('Light') && !el.textContent?.includes('High Contrast'))
    expect(lightThemeBtn).toHaveAttribute('aria-checked', 'false') // Because high contrast is active
  })

  it('toggles accent color options and handles accent color changes', async () => {
    const user = userEvent.setup()
    render(<AccessibleThemeSwitcher />)

    // Open panel
    await user.click(screen.getByRole('button', { name: /open theme settings/i }))

    // Expand accent colors section
    const accentToggle = screen.getByRole('button', { name: /accent color/i })
    expect(accentToggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(accentToggle)
    expect(accentToggle).toHaveAttribute('aria-expanded', 'true')

    // Check for some accent color buttons (using aria-label)
    const violetBtn = screen.getByRole('radio', { name: 'Violet' })
    const amberBtn = screen.getByRole('radio', { name: 'Amber' })

    expect(violetBtn).toBeInTheDocument()
    expect(amberBtn).toBeInTheDocument()

    // Select an accent color
    await user.click(violetBtn)

    // It should store the preference in localStorage
    expect(window.localStorage.getItem('onboard-accent')).toBe('violet')
  })

  it('hides accent color options when high contrast mode is active', async () => {
    const user = userEvent.setup()

    // Mock local storage to pretend high contrast is active
    window.localStorage.setItem('onboard-high-contrast', 'high-contrast-dark')

    render(<AccessibleThemeSwitcher />)

    // Open panel
    await user.click(screen.getByRole('button', { name: /open theme settings/i }))

    // Ensure high contrast is shown as active
    // Open a11y toggle first to see it
    const a11yToggle = screen.getByRole('button', { name: /high contrast/i })
    await user.click(a11yToggle)

    const radios = screen.getAllByRole('radio')
    const hcDark = radios.find(el => el.textContent?.includes('High Contrast Dark'))
    expect(hcDark).toHaveAttribute('aria-checked', 'true')

    // Accent color toggle should NOT be visible
    const accentToggle = screen.queryByRole('button', { name: /accent color/i })
    expect(accentToggle).not.toBeInTheDocument()
  })
})
