// Tauri helper utilities

export function minimizeWindow() {
  if (isTauri()) {
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().minimize().catch(console.error)
    })
  } else {
    console.log('Tauri minimize window (mock)')
  }
}

export function maximizeWindow() {
  if (isTauri()) {
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().toggleMaximize().catch(console.error)
    })
  } else {
    console.log('Tauri toggle maximize window (mock)')
  }
}

export function closeWindow() {
  if (isTauri()) {
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().close().catch(console.error)
    })
  } else {
    console.log('Tauri close window (mock)')
  }
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__
}

const APPLE_MUSIC_LOGIN_URL = 'https://music.apple.com/cn/new'

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

export async function openAppleMusicLoginWindow(
  options: OpenAppleMusicLoginOptions = {}
): Promise<AppleMusicLoginWindowSession | null> {
  if (!isTauri()) return null

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

    // Some runtimes may miss the synthetic created event timing.
    // Use a short timeout fallback to avoid hanging the login flow forever.
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
      const payload = (event as any)?.payload
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

export async function probeAppleMusicLoginWindowCookies(
  windowLabel: string
): Promise<AppleMusicLoginProbeResult> {
  if (!isTauri()) {
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
