import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/components/theme-provider'

// Mock next-themes
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children, ...props }: any) => (
    <div data-testid="next-themes-provider" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
}))

describe('ThemeProvider', () => {
  it('renders children correctly', () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Test Child</div>
      </ThemeProvider>
    )

    expect(screen.getByTestId('child')).toBeDefined()
    expect(screen.getByText('Test Child')).toBeDefined()
  })

  it('passes additional props to NextThemesProvider', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
        <div>Child</div>
      </ThemeProvider>
    )

    const provider = screen.getByTestId('next-themes-provider')
    const props = JSON.parse(provider.getAttribute('data-props') || '{}')

    expect(props.attribute).toBe('class')
    expect(props.defaultTheme).toBe('system')
    expect(props.enableSystem).toBe(true)
  })
})
