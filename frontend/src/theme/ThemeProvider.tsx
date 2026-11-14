// 应用全局主题色彩与暗黑/明亮模式切换上下文模块
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from '../head'
import { gtthm, type ResolvedTheme, type ThemeMode } from '../tokens/tokens'

// 主题上下文值
type ThemeContextValue = {
  mode: ThemeMode
  tglmod: () => void
}

const THEME_STORAGE_KEY = 'lingomusic-theme-mode'
const LEGACY_THEME_STORAGE_KEY = 'iwmei-theme-mode'

const ThemeContext = createContext<ThemeContextValue | null>(null)


// 将主题对象转换为运行时CSS变量
function bldcssv(theme: ResolvedTheme): CSSProperties {
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
    '--system-success': '#0BAA65',
    '--window-close': '#E81123',
    '--terminal-bg': '#0A0F16',
    '--terminal-text': '#D4F8DD',
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


// 读取初始主题模式并迁移旧品牌存储键
function rdinimd(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  let saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (!saved) {
    const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
    if (legacy === 'light' || legacy === 'dark') {
      saved = legacy
      window.localStorage.setItem(THEME_STORAGE_KEY, legacy)
      window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY)
    }
  }
  if (saved === 'light' || saved === 'dark') {
    return saved
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}


// 主题上下文提供者
export function ThmPrv({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => rdinimd())

  // 切换主题模式并持久化
  const tglmod = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
      return next
    })
  }, [])

  const theme = useMemo(() => gtthm(mode), [mode])
  const style = useMemo(() => bldcssv(theme), [theme])

  return (
    <ThemeContext.Provider value={{ mode, tglmod }}>
      <div className={`theme-root theme-${mode}`} style={style}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}


// 读取主题上下文
export function useThm() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useThm must be used inside ThmPrv')
  }
  return ctx
}