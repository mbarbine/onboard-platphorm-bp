import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useIsMobile } from '@/hooks/use-mobile'

describe('useIsMobile', () => {
  const originalInnerWidth = window.innerWidth
  const MOBILE_BREAKPOINT = 768

  beforeEach(() => {
    // Reset innerWidth before each test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
  })

  it('should return true when window width is less than MOBILE_BREAKPOINT', () => {
    window.innerWidth = 500

    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaMock,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('should return false when window width is greater than or equal to MOBILE_BREAKPOINT', () => {
    window.innerWidth = 800

    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaMock,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('should update value on matchMedia change event', () => {
    window.innerWidth = 800

    let changeCallback: () => void = () => {}
    const addEventListenerMock = vi.fn().mockImplementation((event, callback) => {
      if (event === 'change') {
        changeCallback = callback
      }
    })

    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: addEventListenerMock,
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaMock,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    // Simulate resizing to mobile
    act(() => {
      window.innerWidth = 500
      changeCallback()
    })

    expect(result.current).toBe(true)

    // Simulate resizing to desktop
    act(() => {
      window.innerWidth = 1000
      changeCallback()
    })

    expect(result.current).toBe(false)
  })

  it('should clean up event listener on unmount', () => {
    window.innerWidth = 800

    const removeEventListenerMock = vi.fn()
    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerMock,
      dispatchEvent: vi.fn(),
    }))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaMock,
    })

    const { unmount } = renderHook(() => useIsMobile())

    expect(removeEventListenerMock).not.toHaveBeenCalled()
    unmount()
    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
