// Tauri原生窗口与独立登录WebView管理器
export interface AppleMusicLoginWindowSession {
  label: string
  close: () => Promise<void>
}

export interface AppleMusicLoginProbeResult {
  success: boolean
  message: string
  cookiesCount: number
  hasMediaUserToken: boolean
  loginDetected: boolean
  cookiesContent: string
}

export interface OpenAppleMusicLoginOptions {
  dataDirectory?: string
  onClosed?: () => void
  onError?: (message: string) => void
}

const APPLE_MUSIC_LOGIN_URL = 'https://music.apple.com/cn/new'


// 判断当前运行环境是否为Tauri原生应用
export function istri(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
}


// 最小化当前原生窗口
export function minwin(): void {
  if (istri()) {
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().minimize().catch(console.error)
    })
  } else {
    console.log('Tauri minimize window (mock)')
  }
}


// 最大化或还原当前原生窗口
export function maxwin(): void {
  if (istri()) {
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().toggleMaximize().catch(console.error)
    })
  } else {
    console.log('Tauri toggle maximize window (mock)')
  }
}


// 关闭当前原生窗口
export function clswin(): void {
  if (istri()) {
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().close().catch(console.error)
    })
  } else {
    console.log('Tauri close window (mock)')
  }
}


// 创建并打开Apple Music登录独立WebView窗口
export async function opnapllgn(
  options: OpenAppleMusicLoginOptions = {}
): Promise<AppleMusicLoginWindowSession | null> {
  if (!istri()) return null

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const label = `apple-login-${Date.now()}`
  const loginWindow = new WebviewWindow(label, {
    title: 'Apple Music 登录',
    url: APPLE_MUSIC_LOGIN_URL,
    width: 1120,
    height: 820,
    minWidth: 920,
    minHeight: 680,
    resizable: true,
    center: true,
    focus: true,
    decorations: true,
    closable: true,
    minimizable: true,
    maximizable: true,
    dataDirectory: options.dataDirectory || 'apple-music-login',
  })

  const created = await new Promise<{ ok: boolean; message?: string }>((resolve) => {
    let settled = false
    const safeResolve = (value: { ok: boolean; message?: string }) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const timeoutId = window.setTimeout(() => {
      safeResolve({ ok: true })
    }, 1800)

    loginWindow.once('tauri://created', () => {
      window.clearTimeout(timeoutId)
      safeResolve({ ok: true })
    }).catch(() => {
      window.clearTimeout(timeoutId)
      safeResolve({ ok: false, message: '登录窗口创建监听失败' })
    })
    loginWindow.once('tauri://error', (event) => {
      window.clearTimeout(timeoutId)
      const payload = (event as { payload?: unknown })?.payload
      safeResolve({
        ok: false,
        message: typeof payload === 'string' ? payload : '登录窗口创建失败',
      })
    }).catch(() => resolve({ ok: false, message: '登录窗口创建失败' }))
  })

  if (!created.ok) {
    options.onError?.(created.message || '登录窗口创建失败')
    return null
  }

  let finalized = false
  const notifyClosed = () => {
    if (finalized) return
    finalized = true
    options.onClosed?.()
  }

  loginWindow.once('tauri://destroyed', notifyClosed)

  return {
    label,
    close: () => loginWindow.close(),
  }
}


// 检测登录窗口WebView中的Apple认证Cookies
export async function prbapllgn(
  windowLabel: string
): Promise<AppleMusicLoginProbeResult> {
  if (!istri()) {
    return {
      success: false,
      message: '当前环境不支持内置登录窗口 Cookie 检测',
      cookiesCount: 0,
      hasMediaUserToken: false,
      loginDetected: false,
      cookiesContent: '',
    }
  }

  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<AppleMusicLoginProbeResult>('probe_apple_music_login_cookies', {
    windowLabel,
  })
}


// 兼容性别名导出
export const isTauri = istri
export const minimizeWindow = minwin
export const maximizeWindow = maxwin
export const closeWindow = clswin
export const openAppleMusicLoginWindow = opnapllgn
export const probeAppleMusicLoginWindowCookies = prbapllgn
