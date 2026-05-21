import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { getTheme, type ResolvedTheme, type ThemeMode } from '../tokens/tokens'

type ThemeContextValue = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
  theme: ResolvedTheme
}

const THEME_STORAGE_KEY = 'iwmei-theme-mode'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function buildCssVariables(theme: ResolvedTheme): CSSProperties {
  // Single source of truth: React theme object -> runtime CSS custom properties.
  return {
    '--bg-base': theme.color.bgBase,
    '--bg-surface': theme.color.bgSurface,
    '--text-primary': theme.color.textPrimary,
    '--text-secondary': theme.color.textSecondary,
    '--component-wrapped-bg': theme.color.componentWrappedBg,
    '--component-wrapped-text': theme.color.componentWrappedText,
    '--action-primary': theme.color.actionPrimary,
    '--action-primary-hover': theme.color.actionPrimaryHover,
    '--text-on-action': theme.color.textOnAction,
    '--system-error': theme.color.systemError,
    '--panel-blur': theme.effect.panelBlur,
    '--panel-opacity': String(theme.effect.panelOpacity),
    '--glow-shadow': theme.effect.glowShadow,
    '--surface-shadow': theme.effect.surfaceShadow,
    '--soft-shadow': theme.effect.softShadow,
    '--glass-tint': theme.effect.glassTint,
    '--focus-glow': theme.effect.focusGlow,
    '--transition-quick': theme.effect.transitionQuick,
    '--transition-normal': theme.effect.transitionNormal,
    '--transition-slow': theme.effect.transitionSlow,
    '--padding-compact': theme.layout.paddingCompact,
    '--padding-normal': theme.layout.paddingNormal,
    '--padding-loose': theme.layout.paddingLoose,
    '--radius-control': theme.layout.radiusControl,
    '--radius-container': theme.layout.radiusContainer,
    '--radius-full': theme.layout.radiusFull,
  } as CSSProperties
}

function readInitialMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') {
    return saved
  }

  // First launch fallback uses system preference.
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readInitialMode())

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode)
    window.localStorage.setItem(THEME_STORAGE_KEY, nextMode)
  }, [])

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark')
  }, [mode, setMode])

  const theme = useMemo(() => getTheme(mode), [mode])
  const style = useMemo(() => buildCssVariables(theme), [theme])

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode, theme }}>
      <div className={`theme-root theme-${mode}`} style={style}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }
  return ctx
}
