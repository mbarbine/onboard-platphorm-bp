'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { STORAGE_PREFIX } from '@/lib/site-config'
import { cn } from '@/lib/utils'
import { Sun, Moon, Monitor, Palette, Check, X, Eye } from 'lucide-react'

// WCAG 2.2 compliant color themes with sufficient contrast ratios
const THEME_PRESETS = [
  {
    id: 'system',
    name: { en: 'System', es: 'Sistema', fr: 'Système', de: 'System', ja: 'システム', zh: '系统', ar: 'النظام', pt: 'Sistema' },
    icon: Monitor,
    description: { en: 'Match your device settings', es: 'Coincidir con la configuración del dispositivo', fr: 'Correspondre aux paramètres de votre appareil', de: 'Geräteeinstellungen anpassen' },
  },
  {
    id: 'light',
    name: { en: 'Light', es: 'Claro', fr: 'Clair', de: 'Hell', ja: 'ライト', zh: '浅色', ar: 'فاتح', pt: 'Claro' },
    icon: Sun,
    description: { en: 'Clean white background', es: 'Fondo blanco limpio', fr: 'Fond blanc propre', de: 'Sauberer weißer Hintergrund' },
  },
  {
    id: 'dark',
    name: { en: 'Dark', es: 'Oscuro', fr: 'Sombre', de: 'Dunkel', ja: 'ダーク', zh: '深色', ar: 'داكن', pt: 'Escuro' },
    icon: Moon,
    description: { en: 'Easy on the eyes', es: 'Fácil para los ojos', fr: 'Facile pour les yeux', de: 'Augenfreundlich' },
  },
]

// High contrast themes for accessibility (WCAG AAA compliant)
const ACCESSIBILITY_PRESETS = [
  {
    id: 'high-contrast-light',
    name: { en: 'High Contrast Light', es: 'Alto contraste claro', fr: 'Contraste élevé clair', de: 'Hoher Kontrast Hell' },
    description: { en: 'Maximum readability - black on white', es: 'Máxima legibilidad - negro sobre blanco' },
    bg: '#ffffff',
    fg: '#000000',
    accent: '#0000EE',
  },
  {
    id: 'high-contrast-dark',
    name: { en: 'High Contrast Dark', es: 'Alto contraste oscuro', fr: 'Contraste élevé sombre', de: 'Hoher Kontrast Dunkel' },
    description: { en: 'Maximum readability - white on black', es: 'Máxima legibilidad - blanco sobre negro' },
    bg: '#000000',
    fg: '#ffffff',
    accent: '#ffff00',
  },
]

// Accent color presets - all tested for WCAG AA contrast
const ACCENT_COLORS = [
  { id: 'blue', name: { en: 'Blue', es: 'Azul' }, hue: 221, color: '#3b82f6' },
  { id: 'emerald', name: { en: 'Emerald', es: 'Esmeralda' }, hue: 160, color: '#10b981' },
  { id: 'violet', name: { en: 'Violet', es: 'Violeta' }, hue: 270, color: '#8b5cf6' },
  { id: 'rose', name: { en: 'Rose', es: 'Rosa' }, hue: 350, color: '#f43f5e' },
  { id: 'amber', name: { en: 'Amber', es: 'Ámbar' }, hue: 45, color: '#f59e0b' },
  { id: 'cyan', name: { en: 'Cyan', es: 'Cian' }, hue: 190, color: '#06b6d4' },
]

interface AccessibleThemeSwitcherProps {
  locale?: string
}

export function AccessibleThemeSwitcher({ locale = 'en' }: AccessibleThemeSwitcherProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [showAccessibility, setShowAccessibility] = useState(false)
  const [showColors, setShowColors] = useState(false)
  const [selectedAccent, setSelectedAccent] = useState('blue')
  const [highContrastMode, setHighContrastMode] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstFocusableRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard Next.js hydration guard
    setMounted(true)
    // Load saved preferences
    const savedAccent = localStorage.getItem(`${STORAGE_PREFIX}-accent`)
    const savedHighContrast = localStorage.getItem(`${STORAGE_PREFIX}-high-contrast`)
    if (savedAccent) setSelectedAccent(savedAccent)
    if (savedHighContrast) setHighContrastMode(savedHighContrast)
  }, [])

  // Apply accent color CSS variable
  useEffect(() => {
    if (!mounted) return
    const accent = ACCENT_COLORS.find(c => c.id === selectedAccent)
    if (accent) {
      document.documentElement.style.setProperty('--accent-hue', accent.hue.toString())
    }
    localStorage.setItem(`${STORAGE_PREFIX}-accent`, selectedAccent)
  }, [selectedAccent, mounted])

  // Apply high contrast mode
  useEffect(() => {
    if (!mounted) return
    if (highContrastMode) {
      document.documentElement.setAttribute('data-high-contrast', highContrastMode)
      localStorage.setItem(`${STORAGE_PREFIX}-high-contrast`, highContrastMode)
    } else {
      document.documentElement.removeAttribute('data-high-contrast')
      localStorage.removeItem(`${STORAGE_PREFIX}-high-contrast`)
    }
  }, [highContrastMode, mounted])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return
    
    if (e.key === 'Escape') {
      setIsOpen(false)
      setShowAccessibility(false)
      setShowColors(false)
      triggerRef.current?.focus()
    }
    
    if (e.key === 'Tab' && panelRef.current) {
      const focusableElements = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }
  }, [isOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowAccessibility(false)
        setShowColors(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus first element when panel opens
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      setTimeout(() => firstFocusableRef.current?.focus(), 100)
    }
  }, [isOpen])

  const t = (obj: Record<string, string>) => obj[locale] || obj.en

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    setHighContrastMode(null)
    // Announce to screen readers
    announceToScreenReader(`Theme changed to ${newTheme}`)
  }

  const handleHighContrastChange = (mode: string) => {
    setHighContrastMode(mode)
    setTheme(mode.includes('dark') ? 'dark' : 'light')
    announceToScreenReader(`High contrast mode enabled: ${mode}`)
  }

  const handleAccentChange = (accentId: string) => {
    setSelectedAccent(accentId)
    const accent = ACCENT_COLORS.find(c => c.id === accentId)
    if (accent) {
      announceToScreenReader(`Accent color changed to ${t(accent.name)}`)
    }
  }

  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div')
    announcement.setAttribute('role', 'status')
    announcement.setAttribute('aria-live', 'polite')
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message
    document.body.appendChild(announcement)
    setTimeout(() => announcement.remove(), 1000)
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="Loading theme options">
        <Sun className="h-5 w-5" />
      </Button>
    )
  }

  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun

  return (
    <div className="relative">
      {/* Trigger Button */}
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={isOpen ? 'Close theme settings' : 'Open theme settings'}
        className="relative"
      >
        {highContrastMode ? (
          <Eye className="h-5 w-5" />
        ) : (
          <CurrentIcon className="h-5 w-5" />
        )}
        {selectedAccent !== 'blue' && !highContrastMode && (
          <span 
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background"
            style={{ backgroundColor: ACCENT_COLORS.find(c => c.id === selectedAccent)?.color }}
            aria-hidden="true"
          />
        )}
      </Button>

      {/* Slide-out Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Theme settings"
        aria-modal="true"
        className={cn(
          'absolute right-0 top-full mt-2 z-50',
          'w-72 rounded-lg border bg-popover p-0 shadow-lg',
          'transform transition-all duration-200 ease-out origin-top-right',
          isOpen 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="text-sm font-semibold">
            {locale === 'es' ? 'Apariencia' : locale === 'fr' ? 'Apparence' : 'Appearance'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setIsOpen(false)
              setShowAccessibility(false)
              setShowColors(false)
            }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Main Theme Options */}
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {locale === 'es' ? 'Tema' : locale === 'fr' ? 'Thème' : 'Theme'}
            </label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme selection">
              {THEME_PRESETS.map((preset, idx) => {
                const Icon = preset.icon
                const isSelected = theme === preset.id && !highContrastMode
                return (
                  <button
                    key={preset.id}
                    ref={idx === 0 ? firstFocusableRef : undefined}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleThemeChange(preset.id)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all',
                      'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                      isSelected 
                        ? 'border-primary bg-accent' 
                        : 'border-transparent'
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="text-xs font-medium">{t(preset.name)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Accessibility Section Toggle */}
          <button
            onClick={() => setShowAccessibility(!showAccessibility)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border p-3 transition-colors',
              'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring',
              showAccessibility && 'bg-accent'
            )}
            aria-expanded={showAccessibility}
          >
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">
                {locale === 'es' ? 'Alto contraste' : locale === 'fr' ? 'Contraste élevé' : 'High Contrast'}
              </span>
            </div>
            {highContrastMode && <Check className="h-4 w-4 text-primary" aria-label="Active" />}
          </button>

          {/* Accessibility Options */}
          {showAccessibility && (
            <div 
              className="space-y-2 pl-2 animate-in slide-in-from-top-2 duration-200"
              role="group"
              aria-label="High contrast options"
            >
              {ACCESSIBILITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  role="radio"
                  aria-checked={highContrastMode === preset.id}
                  onClick={() => handleHighContrastChange(preset.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border-2 p-2.5 transition-all',
                    'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring',
                    highContrastMode === preset.id 
                      ? 'border-primary' 
                      : 'border-transparent'
                  )}
                >
                  <div 
                    className="h-6 w-6 rounded border-2 flex items-center justify-center"
                    style={{ 
                      backgroundColor: preset.bg, 
                      borderColor: preset.fg,
                      color: preset.fg 
                    }}
                    aria-hidden="true"
                  >
                    <span className="text-xs font-bold">A</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">{t(preset.name)}</div>
                    <div className="text-xs text-muted-foreground">{t(preset.description)}</div>
                  </div>
                  {highContrastMode === preset.id && (
                    <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                  )}
                </button>
              ))}
              {highContrastMode && (
                <button
                  onClick={() => setHighContrastMode(null)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1"
                >
                  {locale === 'es' ? 'Desactivar alto contraste' : 'Disable high contrast'}
                </button>
              )}
            </div>
          )}

          {/* Accent Color Section */}
          {!highContrastMode && (
            <>
              <button
                onClick={() => setShowColors(!showColors)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border p-3 transition-colors',
                  'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring',
                  showColors && 'bg-accent'
                )}
                aria-expanded={showColors}
              >
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" aria-hidden="true" />
                  <span className="text-sm font-medium">
                    {locale === 'es' ? 'Color de acento' : locale === 'fr' ? 'Couleur d\'accent' : 'Accent Color'}
                  </span>
                </div>
                <div 
                  className="h-4 w-4 rounded-full border"
                  style={{ backgroundColor: ACCENT_COLORS.find(c => c.id === selectedAccent)?.color }}
                  aria-hidden="true"
                />
              </button>

              {showColors && (
                <div 
                  className="grid grid-cols-6 gap-2 pl-2 animate-in slide-in-from-top-2 duration-200"
                  role="radiogroup"
                  aria-label="Accent color selection"
                >
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color.id}
                      role="radio"
                      aria-checked={selectedAccent === color.id}
                      aria-label={t(color.name)}
                      onClick={() => handleAccentChange(color.id)}
                      className={cn(
                        'h-8 w-8 rounded-full border-2 transition-all',
                        'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                        selectedAccent === color.id 
                          ? 'border-foreground scale-110' 
                          : 'border-transparent'
                      )}
                      style={{ backgroundColor: color.color }}
                    >
                      {selectedAccent === color.id && (
                        <Check className="h-4 w-4 mx-auto text-white drop-shadow-sm" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - Keyboard hints */}
        <div className="border-t p-2 text-center">
          <p className="text-[10px] text-muted-foreground">
            <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">Tab</kbd>
            {' '}{locale === 'es' ? 'navegar' : 'navigate'}{' '}
            <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">Esc</kbd>
            {' '}{locale === 'es' ? 'cerrar' : 'close'}
          </p>
        </div>
      </div>
    </div>
  )
}
