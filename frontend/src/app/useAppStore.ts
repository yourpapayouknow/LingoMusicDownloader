// 前端应用状态与业务逻辑聚合store
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from '../head'
import logoImage from '../assets/logo.svg'
import { useThm } from '../theme/ThemeProvider'
import type { ToastItem, ToastTone } from '../ui/components'
import {
  srchapl, sbmtdwnld, gtstts, gthlth, svcks, fnllgn,
  wslprchk, wslstrt, wslstts, wrprprchk, wrprstrt, wrprstts, wrprint,
  gtstngs, svstngs, gthstry, dlthstry, gtrecmdtn, rprtsrch,
  gtlclurl, gtlclart, gtlcllrc, scnlcl, gtdirs, svdirs, rstdirs,
  type SearchResult, type HealthStatus,
  type Wsl2InstallPrecheckResponse, type Wsl2InstallStatusResponse,
  type WrapperSetupPrecheckResponse, type WrapperSetupStatusResponse,
  type DownloadItem, type DownloadQueueItem, type HistoryItem,
} from '../utils/api'
import { clswin, istri, opnapllgn, prbapllgn } from '../utils/tauri'
import {
  gtarturl,
  nrmlcdclbl,
  gtprntpth,
  prslrc,
  gterrmsg,
  type LrcLine,
} from '../utils/format'
import {
  SETTINGS_KEY_CODEC,
  SETTINGS_KEY_RESOLUTION,
  SETTINGS_KEY_METADATA_REGION,
  SETTINGS_KEY_USE_WRAPPER,
  SETTINGS_KEY_VOLUME,
  SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320,
  SETTINGS_KEY_TRANSCODE_AAC_TO_MP4,
  SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD,
  SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC,
  SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV,
  SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4,
  SETTINGS_KEY_INIT_GUIDE_DISMISSED,
  SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART,
} from './constants'
import { bldsrls } from './helpers'
import type { QueueItem, PlaylistEntry, SearchFilter, ConfirmPrompt } from './types'

export function useStor() {
  const { mode, tglmod } = useThm()

  // App Layout Navigation State
  const [activeTab, setActiveTab] = useState<'search' | 'download' | 'settings' | 'about'>('search')

  // Search Page State
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  
  // Search Recommendations
  const searchRecommendations = ['周杰伦', '陈奕迅', '林俊杰', '邓紫棋', 'Taylor Swift', '王菲']

  // 搜索结果筛选状态
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all')
  const [searchPerformed, setSearchPerformed] = useState(false)
  const searchInFlightRef = useRef(false)

  // 应用内确认弹窗状态
  const [confirmPrompt, setConfirmPrompt] = useState<ConfirmPrompt | null>(null)

  // Local & Polled Downloads Queue State
  const [downloadQueue, setDownloadQueue] = useState<QueueItem[]>([])

  const [openAlbums, setOpenAlbums] = useState<Record<string, boolean>>({})
  const [openHistoryAlbums, setOpenHistoryAlbums] = useState<Record<string, boolean>>({})

  const [downloaderInitialized, setDownloaderInitialized] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  
  // Backend States
  const [downloadHistory, setDownloadHistory] = useState<HistoryItem[]>([])
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [scanningLocal, setScanningLocal] = useState(false)
  const [deletingHistoryGroupId, setDeletingHistoryGroupId] = useState<string | null>(null)

  // Settings State (persisted in localStorage)
  const [codec, setCodec] = useState(() => localStorage.getItem(SETTINGS_KEY_CODEC) || 'aac-legacy')
  const [resolution, setResolution] = useState(() => localStorage.getItem(SETTINGS_KEY_RESOLUTION) || '1080p')
  const [metadataRegion, setMetadataRegion] = useState(() => localStorage.getItem(SETTINGS_KEY_METADATA_REGION) || 'auto')
  const [useWrapper, setUseWrapper] = useState(() => localStorage.getItem(SETTINGS_KEY_USE_WRAPPER) === 'true')
  const [transcodeAacToMp3_320, setTranscodeAacToMp3_320] = useState(() => localStorage.getItem(SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320) === 'true')
  const [transcodeAacToMp4, setTranscodeAacToMp4] = useState(() => localStorage.getItem(SETTINGS_KEY_TRANSCODE_AAC_TO_MP4) === 'true')
  const [transcodeAacToAacStandard, setTranscodeAacToAacStandard] = useState(() => localStorage.getItem(SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD) === 'true')
  const [transcodeAlacToFlac, setTranscodeAlacToFlac] = useState(() => localStorage.getItem(SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC) === 'true')
  const [transcodeAlacToWav, setTranscodeAlacToWav] = useState(() => localStorage.getItem(SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV) === 'true')
  const [transcodeAlacToMp4, setTranscodeAlacToMp4] = useState(() => localStorage.getItem(SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4) === 'true')
  const [cookieText, setCookieText] = useState('')
  const [cookieSaving, setCookieSaving] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [downloadDir, setDownloadDir] = useState('')
  const [convertedDir, setConvertedDir] = useState('')
  const [storageSaving, setStorageSaving] = useState(false)
  const [initGuideOpen, setInitGuideOpen] = useState(() => {
    return localStorage.getItem(SETTINGS_KEY_INIT_GUIDE_DISMISSED) !== 'true'
  })
  const userManuallyOpenedInitGuideRef = useRef(false)
  const [skipWrapperAutostart, setSkipWrapperAutostart] = useState(() => {
    return localStorage.getItem(SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART) === 'true'
  })
  const wrapperAutostartAttemptedRef = useRef(false)
  const [initGuideStep, setInitGuideStep] = useState<1 | 2>(1)
  const [initAgreementReachedEnd, setInitAgreementReachedEnd] = useState(false)
  const [initEnterConfirmOpen, setInitEnterConfirmOpen] = useState(false)
  const [initCookieLoggingIn, setInitCookieLoggingIn] = useState(false)
  const [wslInstallDialogOpen, setWslInstallDialogOpen] = useState(false)
  const [wslInstallLoading, setWslInstallLoading] = useState(false)
  const [wslInstallPrecheck, setWslInstallPrecheck] = useState<Wsl2InstallPrecheckResponse | null>(null)
  const [wslInstallStatusData, setWslInstallStatusData] = useState<Wsl2InstallStatusResponse | null>(null)
  const wslInstallPollTimerRef = useRef<number | null>(null)
  const wslInstallCompletedNotifiedRef = useRef(false)
  const [wrapperSetupDialogOpen, setWrapperSetupDialogOpen] = useState(false)
  const [wrapperSetupLoading, setWrapperSetupLoading] = useState(false)
  const [wrapperSetupPrecheck, setWrapperSetupPrecheck] = useState<WrapperSetupPrecheckResponse | null>(null)
  const [wrapperSetupStatusData, setWrapperSetupStatusData] = useState<WrapperSetupStatusResponse | null>(null)
  const wrapperSetupPollTimerRef = useRef<number | null>(null)
  const wrapperSetupCompletedNotifiedRef = useRef(false)
  const [wrapperInputDialogOpen, setWrapperInputDialogOpen] = useState(false)
  const [wrapperInputAppleId, setWrapperInputAppleId] = useState('')
  const [wrapperInputPassword, setWrapperInputPassword] = useState('')
  const [wrapperInput2fa, setWrapperInput2fa] = useState('')
  const [wrapperInputSubmitting, setWrapperInputSubmitting] = useState(false)
  const loginWindowSessionRef = useRef<{ label: string; close: () => Promise<void> } | null>(null)
  const loginFinalizeRef = useRef<(() => Promise<void>) | null>(null)
  const initAgreementScrollRef = useRef<HTMLDivElement | null>(null)

  // Terminal simulated output logs
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '[核心控制] LingoMusic Downloader 引擎启动...',
    '[本地服务] 调度核心已在端口 8000 成功侦听。',
    '[WSL子系统] 正在检测WSL解密容器环境...'
  ])
  const logsEndRef = useRef<HTMLDivElement | null>(null)

  // Global Toast Notifications State
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Download confirmation Dlg warning
  const [downloadConfirmOpen, setDownloadConfirmOpen] = useState(false)
  const [downloadConfirmTrack, setDownloadConfirmTrack] = useState<SearchResult | null>(null)

  // Lyrics toggle
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [lyricIndex, setLyricIndex] = useState(0)
  const [timedLyrics, setTimedLyrics] = useState<LrcLine[]>([])
  const [plainLyrics, setPlainLyrics] = useState<string[]>([])
  const [lyricsSource, setLyricsSource] = useState<'local' | 'preview' | 'none'>('none')
  const [playlistEntries, setPlaylistEntries] = useState<PlaylistEntry[]>([])
  const [currentPlaylistKey, setCurrentPlaylistKey] = useState('')

  // About page disclaimer language
  const [disclaimerLang, setDisclaimerLang] = useState<'zh' | 'en'>('zh')

  // Settings page Accordion active states
  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>({
    'status': true,
    'onboarding': false,
    'quality': false,
    'cookie': false,
    'logs': false
  })

  // Audio Player State
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastTimeUpdateRef = useRef(0)
  const lyricsStageRef = useRef<HTMLDivElement | null>(null)

  // 绑定音频元素引用
  const setaud = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el
  }, [])

  // 绑定歌词容器引用
  const setlyr = useCallback((el: HTMLDivElement | null) => {
    lyricsStageRef.current = el
  }, [])

  // 绑定协议滚动容器引用
  const setisc = useCallback((el: HTMLDivElement | null) => {
    initAgreementScrollRef.current = el
  }, [])

  // 绑定日志底部引用
  const setlge = useCallback((el: HTMLDivElement | null) => {
    logsEndRef.current = el
  }, [])
  const [playingTrack, setPlayingTrack] = useState<SearchResult | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem(SETTINGS_KEY_VOLUME)
    return saved ? Number(saved) : 0.8
  })
  const [isMuted, setIsMuted] = useState(false)
  const [isShuffle, setIsShuffle] = useState(false)
  const [isRepeat, setIsRepeat] = useState(false)
  const [lyricsStageHeight, setLyricsStageHeight] = useState(320)

  // Push Toast notification helper
  const pshtst = useCallback((title: string, description: string, tone: ToastTone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { id, title, description, tone }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 4000)
  }, [])

  const rmtst = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  // 追加终端日志并保留最近25条
  const apndlog = useCallback((message: string) => {
    const timeStr = new Date().toLocaleTimeString()
    setTerminalLogs((prev) => [...prev, `[${timeStr}] ${message}`].slice(-25))
  }, [])

  // 请求应用内确认弹窗
  const askConfirm = useCallback((prompt: ConfirmPrompt) => setConfirmPrompt(prompt), [])

  // 关闭应用内确认弹窗
  const closeConfirm = useCallback(() => setConfirmPrompt(null), [])

  // 执行确认动作并关闭弹窗
  const runConfirm = useCallback(async () => {
    const prompt = confirmPrompt
    setConfirmPrompt(null)
    if (prompt) await prompt.onConfirm()
  }, [confirmPrompt])

  // 刷新下载历史列表
  const rfrhst = useCallback(async () => {
    const rows = await gthstry()
    setDownloadHistory(rows)
  }, [])

  // 删除单条下载历史
  const dlhsttrk = useCallback((track: HistoryItem) => {
    askConfirm({
      title: '删除历史记录',
      description: `确定删除“${track.name}”？将同时尝试删除本地文件。`,
      confirmText: '删除',
      tone: 'error',
      onConfirm: async () => {
        try {
          await dlthstry(track.track_id, true)
          await rfrhst()
          pshtst('删除完成', `已删除：${track.name}`, 'success')
        } catch (err) {
          pshtst('删除失败', gterrmsg(err) || '删除历史记录失败', 'error')
        }
      },
    })
  }, [askConfirm, rfrhst, pshtst])

  // 切换Wrapper高品音质并回退不兼容编码
  const setwrpenb = useCallback((enabled: boolean) => {
    setUseWrapper(enabled)
    if (!enabled) {
      setCodec((prev) => (prev === 'alac' || prev === 'atmos' ? 'aac-legacy' : prev))
    }
  }, [])

  const repositoryUrl = 'https://github.com/yourpapayouknow/LingoMusicDownloader'

  const opnext = useCallback((url: string, label?: string) => {
    const targetLabel = label || url
    try {
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (!newWindow) {
        throw new Error('popup_blocked')
      }
      pshtst('已打开链接', `正在打开：${targetLabel}`, 'success')
    } catch {
      pshtst('打开失败', `无法打开链接：${targetLabel}`, 'error')
    }
  }, [pshtst])

  const initCookieConfigured = Boolean(healthStatus?.cookies_ok)
  const initWrapperConfigured = Boolean(healthStatus?.wrapper.all_ok)

  const chkagr = useCallback(() => {
    const element = initAgreementScrollRef.current
    if (!element) return
    const reached = element.scrollTop + element.clientHeight >= element.scrollHeight - 8
    if (reached) {
      setInitAgreementReachedEnd(true)
    }
  }, [])

  const hdlsgn = useCallback(() => {
    if (istri()) {
      clswin()
      return
    }
    window.close()
  }, [])

  const hdlckl = useCallback(async () => {
    if (initCookieLoggingIn) {
      const activeSession = loginWindowSessionRef.current
      if (activeSession) {
        pshtst('正在完成登录', '正在关闭登录窗口并继续校验，请稍候…', 'info')
        try {
          await activeSession.close()
        } catch (e) {
          console.warn('Close login window from action button failed', e)
          await loginFinalizeRef.current?.()
        }
      }
      return
    }

    const startedAtMs = Date.now()
    let finalized = false
    let probeInFlight = false
    let probeTimer: number | null = null
    let loginWindowSession: { label: string; close: () => Promise<void> } | null = null
    let liveCookieContent = ''
    let liveCookieCount = 0
    let observedPreLoginCookies = false

    const stpprb = () => {
      if (probeTimer !== null) {
        window.clearInterval(probeTimer)
        probeTimer = null
      }
    }

    // 窗口销毁前优先通过Tauri内存接口抓取最新Cookies
    const cptlvc = async (windowLabel: string) => {
      try {
        const probe = await prbapllgn(windowLabel)
        if (probe.cookiesCount > 0) {
          observedPreLoginCookies = true
        }
        if (probe.loginDetected && probe.cookiesContent?.trim()) {
          liveCookieContent = probe.cookiesContent
          liveCookieCount = probe.cookiesCount || liveCookieCount
        }
      } catch (e) {
        console.warn('Pre-close cookie capture failed', e)
      }
    }

    const fnlafw = async () => {
      if (finalized) return
      finalized = true
      stpprb()
      loginFinalizeRef.current = null
      loginWindowSessionRef.current = null

      const hasCapturedLive = Boolean(liveCookieContent.trim())
      // 若已通过内存抓取到Cookies则无需久等磁盘句柄释放
      await new Promise((resolve) => window.setTimeout(resolve, hasCapturedLive ? 100 : 900))
      try {
        let result: { success: boolean; message: string; cookies_count: number }
        const content = liveCookieContent.trim()
        if (content) {
          const saveResult = await svcks(content)
          result = {
            success: Boolean(saveResult.success),
            message: saveResult.message || '登录凭据已保存并完成初始化',
            cookies_count: liveCookieCount || content.split('\n').filter((line) => line.trim() && !line.startsWith('#')).length,
          }
        } else if (observedPreLoginCookies) {
          result = {
            success: false,
            message: '未检测到完整登录态（缺少登录令牌），请先在弹窗内完成账号登录再关闭。',
            cookies_count: 0,
          }
        } else {
          const finalizedResult = await fnllgn({
            profile_hint: 'apple-music-login',
            started_at_ms: startedAtMs,
          })
          result = {
            success: finalizedResult.success,
            message: finalizedResult.message,
            cookies_count: finalizedResult.cookies_count,
          }
        }

        try {
          const [statusData, health] = await Promise.all([gtstts(), gthlth()])
          setDownloaderInitialized(statusData.is_initialized)
          setHealthStatus(health)
        } catch (syncErr) {
          console.warn('Sync status after cookie login failed', syncErr)
        }

        if (result.success) {
          pshtst('登录成功', result.message || '登录凭据导出并初始化成功', 'success')
          apndlog(`[授权系统] 已自动导出并加载Apple Music Cookies (${result.cookies_count} 条)。`)
        } else {
          pshtst('登录未完成', result.message || '未检测到有效登录态', 'error')
        }
      } catch (err) {
        console.error(err)
        pshtst('登录校验失败', gterrmsg(err) || '无法导出登录凭据', 'error')
      } finally {
        setInitCookieLoggingIn(false)
      }
    }

    const prblgst = async () => {
      if (finalized || probeInFlight || !loginWindowSession) return
      probeInFlight = true
      try {
        const probe = await prbapllgn(loginWindowSession.label)
        if (probe.cookiesCount > 0) {
          observedPreLoginCookies = true
        }
        if (probe.loginDetected && probe.cookiesContent?.trim()) {
          liveCookieContent = probe.cookiesContent
          liveCookieCount = probe.cookiesCount || liveCookieCount
          pshtst('检测到登录', '已识别登录态，正在自动关闭窗口并完成校验...', 'success')
          try {
            await loginWindowSession?.close()
            window.setTimeout(() => {
              void fnlafw()
            }, 600)
          } catch (e) {
            console.warn('Auto close login window failed, fallback to finalize', e)
            void fnlafw()
          }
        }
      } catch {
        // Keep silent during probing; login may still be in progress.
      } finally {
        probeInFlight = false
      }
    }

    if (!istri()) {
      window.open('https://music.apple.com/cn/new', '_blank', 'noopener,noreferrer')
      pshtst('已打开网页', '请完成登录后手动导出登录凭据（当前为浏览器模式）', 'info')
      return
    }

    setInitCookieLoggingIn(true)
    try {
      loginWindowSession = await opnapllgn({
        dataDirectory: 'apple-music-login',
        onBeforeClose: cptlvc,
        onClosed: () => {
          void fnlafw()
        },
        onError: (message) => {
          finalized = true
          stpprb()
          loginFinalizeRef.current = null
          loginWindowSessionRef.current = null
          setInitCookieLoggingIn(false)
          pshtst('登录窗口异常', message, 'error')
        },
      })

      if (!loginWindowSession) {
        finalized = true
        stpprb()
        loginFinalizeRef.current = null
        loginWindowSessionRef.current = null
        setInitCookieLoggingIn(false)
        pshtst('启动失败', '当前运行环境不支持内置登录窗口', 'error')
        return
      }

      loginWindowSessionRef.current = loginWindowSession
      loginFinalizeRef.current = fnlafw
      pshtst('请先登录', '登录Apple Music后系统会尝试自动完成；若未自动关闭，可点击右上角 X 或“完成登录并继续”。', 'info')
      probeTimer = window.setInterval(() => {
        void prblgst()
      }, 1200)
      void prblgst()
    } catch (err) {
      console.error(err)
      finalized = true
      stpprb()
      loginFinalizeRef.current = null
      loginWindowSessionRef.current = null
      setInitCookieLoggingIn(false)
      pshtst('启动失败', gterrmsg(err) || '无法打开Apple Music登录窗口', 'error')
    }
  }, [apndlog, initCookieLoggingIn, pshtst])

  // 关闭初始化引导弹窗并持久化完成状态
  const dsmsgd = useCallback(() => {
    userManuallyOpenedInitGuideRef.current = false
    localStorage.setItem(SETTINGS_KEY_INIT_GUIDE_DISMISSED, 'true')
    setInitGuideOpen(false)
    svstngs({
      [SETTINGS_KEY_INIT_GUIDE_DISMISSED]: 'true'
    }).catch(console.error)
  }, [])

  // 确认进入主界面
  const hdlent = useCallback(() => {
    if (!initWrapperConfigured) {
      setInitEnterConfirmOpen(true)
      return
    }
    setSkipWrapperAutostart(false)
    localStorage.setItem(SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART, 'false')
    svstngs({ [SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART]: 'false' }).catch(console.error)
    dsmsgd()
  }, [initWrapperConfigured, dsmsgd])

  // 从设置界面手动打开初始化页面
  const hdlopn = useCallback(() => {
    userManuallyOpenedInitGuideRef.current = true
    setInitEnterConfirmOpen(false)
    setInitGuideStep(1)
    setInitAgreementReachedEnd(false)
    setInitGuideOpen(true)
    window.requestAnimationFrame(() => {
      const element = initAgreementScrollRef.current
      if (element) {
        element.scrollTop = 0
      }
    })
  }, [])

  const stpwslp = useCallback(() => {
    if (wslInstallPollTimerRef.current !== null) {
      window.clearInterval(wslInstallPollTimerRef.current)
      wslInstallPollTimerRef.current = null
    }
  }, [])

  const sncwsls = useCallback(async () => {
    const status = await wslstts()
    setWslInstallStatusData(status)

    if (status.completed) {
      stpwslp()
      setWslInstallLoading(false)

      if (!wslInstallCompletedNotifiedRef.current) {
        wslInstallCompletedNotifiedRef.current = true
        if (status.success_flag) {
          pshtst('安装完成', status.message || 'WSL2安装与配置已完成', 'success')
          try {
            const [statusData, health] = await Promise.all([gtstts(), gthlth()])
            setDownloaderInitialized(statusData.is_initialized)
            setHealthStatus(health)
          } catch (syncErr) {
            console.warn('Sync status after WSL2 install failed', syncErr)
          }
          window.setTimeout(() => {
            setWslInstallDialogOpen(false)
          }, 800)
        } else {
          pshtst('安装失败', status.message || 'WSL2安装流程失败，请查看日志', 'error')
        }
      }
    }

    return status
  }, [pshtst, stpwslp])

  const opnwsld = useCallback(async () => {
    setWslInstallDialogOpen(true)
    setWslInstallLoading(true)
    wslInstallCompletedNotifiedRef.current = false

    try {
      const [precheck, status] = await Promise.all([
        wslprchk(),
        wslstts(),
      ])
      setWslInstallPrecheck(precheck)
      setWslInstallStatusData(status)

      if (status.running && !status.completed) {
        stpwslp()
        wslInstallPollTimerRef.current = window.setInterval(() => {
          sncwsls().catch(console.error)
        }, 1200)
      }
    } catch (err) {
      console.error(err)
      pshtst('检查失败', gterrmsg(err) || '无法获取WSL2安装状态', 'error')
    } finally {
      setWslInstallLoading(false)
    }
  }, [pshtst, stpwslp, sncwsls])

  const hdlcfw2 = useCallback(async () => {
    if (wslInstallLoading) return
    if (wslInstallPrecheck?.already_installed) {
      pshtst('无需安装', wslInstallPrecheck.message || '检测到本机已安装WSL2', 'info')
      return
    }
    setWslInstallLoading(true)
    wslInstallCompletedNotifiedRef.current = false

    try {
      const startRes = await wslstrt({ required_gb: 15 })
      if (!startRes.success) {
        pshtst('无法安装', startRes.message || 'WSL2安装前检查未通过', 'error')
        setWslInstallLoading(false)
        return
      }

      if (startRes.status === 'success') {
        await sncwsls()
        setWslInstallLoading(false)
        return
      }

      await sncwsls()
      stpwslp()
      wslInstallPollTimerRef.current = window.setInterval(() => {
        sncwsls().catch(console.error)
      }, 1200)
    } catch (err) {
      console.error(err)
      pshtst('启动失败', gterrmsg(err) || '无法启动WSL2安装流程', 'error')
      setWslInstallLoading(false)
    }
  }, [wslInstallLoading, wslInstallPrecheck, pshtst, stpwslp, sncwsls])

  // 关闭WSL2安装弹窗（任务在后台继续）
  const hdlclws = useCallback(() => {
    setWslInstallDialogOpen(false)
  }, [])

  const stpwrpp = useCallback(() => {
    if (wrapperSetupPollTimerRef.current !== null) {
      window.clearInterval(wrapperSetupPollTimerRef.current)
      wrapperSetupPollTimerRef.current = null
    }
  }, [])

  const sncwrps = useCallback(async () => {
    const status = await wrprstts()
    setWrapperSetupStatusData(status)

    if (status.awaiting_input) {
      setWrapperInputDialogOpen(true)
    } else if (!status.running) {
      setWrapperInputDialogOpen(false)
    }

    if (status.completed) {
      stpwrpp()
      setWrapperSetupLoading(false)
      setWrapperInputSubmitting(false)

      if (!wrapperSetupCompletedNotifiedRef.current) {
        wrapperSetupCompletedNotifiedRef.current = true
        if (status.success_flag) {
          setSkipWrapperAutostart(false)
          localStorage.setItem(SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART, 'false')
          svstngs({ [SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART]: 'false' }).catch(console.error)
          pshtst('解密组件已就绪', status.message || '解密组件正在运行', 'success')
          try {
            const [statusData, health] = await Promise.all([gtstts(), gthlth()])
            setDownloaderInitialized(statusData.is_initialized)
            setHealthStatus(health)
          } catch (syncErr) {
            console.warn('Sync status after Wrapper setup failed', syncErr)
          }
          window.setTimeout(() => {
            setWrapperInputDialogOpen(false)
            setWrapperSetupDialogOpen(false)
          }, 800)
        } else {
          pshtst('解密组件流程失败', status.message || '请查看日志并重试', 'error')
        }
      }
    }

    return status
  }, [pshtst, stpwrpp])

  const opnwrpd = useCallback(async () => {
    setWrapperSetupDialogOpen(true)
    setWrapperSetupLoading(true)
    wrapperSetupCompletedNotifiedRef.current = false

    try {
      const [precheck, status] = await Promise.all([
        wrprprchk(),
        wrprstts(),
      ])
      setWrapperSetupPrecheck(precheck)
      setWrapperSetupStatusData(status)
      setWrapperInputDialogOpen(Boolean(status.awaiting_input))

      if (status.running || status.awaiting_input) {
        stpwrpp()
        wrapperSetupPollTimerRef.current = window.setInterval(() => {
          sncwrps().catch(console.error)
        }, 1100)
      }
    } catch (err) {
      console.error(err)
      pshtst('检查失败', gterrmsg(err) || '无法获取解密组件状态', 'error')
    } finally {
      setWrapperSetupLoading(false)
    }
  }, [pshtst, stpwrpp, sncwrps])

  // 启动Wrapper服务并启动状态轮询监控
  const trgwrps = useCallback(async (forceRestart: boolean = false, isSilent: boolean = false) => {
    if (wrapperSetupLoading) return false
    setWrapperSetupLoading(true)
    wrapperSetupCompletedNotifiedRef.current = false

    try {
      const startRes = await wrprstrt({ force_restart: forceRestart })
      if (!startRes.success) {
        if (!isSilent) {
          pshtst(forceRestart ? '无法重启' : '无法启动', startRes.message || '解密组件启动前检查未通过', 'error')
        }
        setWrapperSetupLoading(false)
        return false
      }

      await sncwrps()
      if (startRes.status !== 'success') {
        stpwrpp()
        wrapperSetupPollTimerRef.current = window.setInterval(() => {
          sncwrps().catch(console.error)
        }, 1100)
      } else {
        setWrapperSetupLoading(false)
      }
      return true
    } catch (err) {
      console.error(err)
      if (!isSilent) {
        pshtst(forceRestart ? '重启失败' : '启动失败', gterrmsg(err) || '无法启动解密组件流程', 'error')
      }
      setWrapperSetupLoading(false)
      return false
    }
  }, [wrapperSetupLoading, pshtst, stpwrpp, sncwrps])

  // 确认启动Wrapper服务
  const hdlcfws = useCallback(async () => {
    await trgwrps(false, false)
  }, [trgwrps])

  // 确认重启解密组件服务
  const hdlrsws = useCallback(async () => {
    await trgwrps(true, false)
  }, [trgwrps])

  // 关闭Wrapper弹窗（任务在后台继续）
  const hdlclwd = useCallback(() => {
    setWrapperInputDialogOpen(false)
    setWrapperSetupDialogOpen(false)
  }, [])

  const hdlswrp = useCallback(async () => {
    const inputType = wrapperSetupStatusData?.input_type
    if (!inputType) return
    if (wrapperInputSubmitting) return

    try {
      setWrapperInputSubmitting(true)

      if (inputType === 'credentials') {
        const appleId = wrapperInputAppleId.trim()
        const password = wrapperInputPassword.trim()
        if (!appleId || !password) {
          pshtst('输入不完整', '请输入Apple ID与密码', 'error')
          setWrapperInputSubmitting(false)
          return
        }

        const res = await wrprint({
          input_type: 'credentials',
          apple_id: appleId,
          password,
        })
        if (!res.success) {
          pshtst('提交失败', res.message || '账号密码提交失败', 'error')
          setWrapperInputSubmitting(false)
          return
        }

        setWrapperInputDialogOpen(false)
        setWrapperInput2fa('')
      } else {
        const code = wrapperInput2fa.trim()
        if (!code) {
          pshtst('输入不完整', '请输入两步验证码', 'error')
          setWrapperInputSubmitting(false)
          return
        }

        const res = await wrprint({
          input_type: '2fa',
          code,
        })
        if (!res.success) {
          pshtst('提交失败', res.message || '两步验证码提交失败', 'error')
          setWrapperInputSubmitting(false)
          return
        }

        setWrapperInputDialogOpen(false)
      }

      await sncwrps()
      stpwrpp()
      wrapperSetupPollTimerRef.current = window.setInterval(() => {
        sncwrps().catch(console.error)
      }, 1100)
    } catch (err) {
      console.error(err)
      pshtst('提交失败', gterrmsg(err) || '无法提交解密组件输入', 'error')
    } finally {
      setWrapperInputSubmitting(false)
    }
  }, [
    wrapperSetupStatusData,
    wrapperInputSubmitting,
    wrapperInputAppleId,
    wrapperInputPassword,
    wrapperInput2fa,
    pshtst,
    sncwrps,
    stpwrpp
  ])

  useEffect(() => {
    if (!initGuideOpen || initGuideStep !== 1) return

    const element = initAgreementScrollRef.current
    if (!element) return

    const onScroll = () => chkagr()
    element.addEventListener('scroll', onScroll)
    const raf = window.requestAnimationFrame(onScroll)

    return () => {
      element.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(raf)
    }
  }, [initGuideOpen, initGuideStep, chkagr])

  useEffect(() => {
    if (!initGuideOpen) return

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [initGuideOpen])

  useEffect(() => {
    return () => {
      stpwslp()
      stpwrpp()
    }
  }, [stpwslp, stpwrpp])

  const bldprvp = useCallback((track: SearchResult): PlaylistEntry | null => {
    const previewUrl = track.attributes.previews?.[0]?.url as string | undefined
    if (!previewUrl) return null
    return {
      key: `preview:${track.id}`,
      source: 'preview',
      title: track.attributes.name,
      artistName: track.attributes.artistName || '未知歌手',
      artworkUrl: track.attributes.artwork?.url || logoImage,
      previewUrl,
      searchTrackId: track.id,
    }
  }, [])

  const addplen = useCallback((entry: PlaylistEntry, setCurrent: boolean = true) => {
    setPlaylistEntries((prev) => {
      const existingIndex = prev.findIndex((item) => item.key === entry.key)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = { ...next[existingIndex], ...entry }
        return next
      }
      return [...prev, entry]
    })
    if (setCurrent) {
      setCurrentPlaylistKey(entry.key)
    }
  }, [])

  const addstpl = useCallback((track: SearchResult, setCurrent: boolean = true) => {
    const entry = bldprvp(track)
    if (!entry) return
    addplen(entry, setCurrent)
  }, [bldprvp, addplen])

  const addlcpl = useCallback((
    trackId: string,
    metadata: { name: string; artistName: string; artworkUrl?: string },
    setCurrent: boolean = true
  ) => {
    addplen({
      key: `local:${trackId}`,
      source: 'local',
      title: metadata.name,
      artistName: metadata.artistName || '未知歌手',
      artworkUrl: metadata.artworkUrl || logoImage,
      trackId,
    }, setCurrent)
  }, [addplen])

  // 防抖持久化设置到本地缓存与后端
  useEffect(() => {
    if (!settingsLoaded) return
    localStorage.setItem(SETTINGS_KEY_METADATA_REGION, metadataRegion)
    const timer = window.setTimeout(() => {
      svstngs({
        [SETTINGS_KEY_CODEC]: codec,
        [SETTINGS_KEY_RESOLUTION]: resolution,
        [SETTINGS_KEY_METADATA_REGION]: metadataRegion,
        [SETTINGS_KEY_USE_WRAPPER]: useWrapper,
        [SETTINGS_KEY_VOLUME]: volume,
        [SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320]: transcodeAacToMp3_320,
        [SETTINGS_KEY_TRANSCODE_AAC_TO_MP4]: transcodeAacToMp4,
        [SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD]: transcodeAacToAacStandard,
        [SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC]: transcodeAlacToFlac,
        [SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV]: transcodeAlacToWav,
        [SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4]: transcodeAlacToMp4,
      }).catch(console.error)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [
    codec,
    resolution,
    metadataRegion,
    useWrapper,
    volume,
    transcodeAacToMp3_320,
    transcodeAacToMp4,
    transcodeAacToAacStandard,
    transcodeAlacToFlac,
    transcodeAlacToWav,
    transcodeAlacToMp4,
    settingsLoaded
  ])

  // 同步音量到音频元素
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
      audioRef.current.muted = isMuted
    }
  }, [isMuted, volume])

  // Poll Downloads Status & Backend Health
  const ftsthlth = useCallback(async () => {
    try {
      const statusData = await gtstts()
      setDownloaderInitialized(statusData.is_initialized)

      const health = await gthlth()
      setHealthStatus(health)

      // 同步初始化与登录就绪状态
      if (!userManuallyOpenedInitGuideRef.current && (statusData.is_initialized || health.cookies_ok)) {
        if (localStorage.getItem(SETTINGS_KEY_INIT_GUIDE_DISMISSED) !== 'true') {
          localStorage.setItem(SETTINGS_KEY_INIT_GUIDE_DISMISSED, 'true')
          svstngs({ [SETTINGS_KEY_INIT_GUIDE_DISMISSED]: 'true' }).catch(console.error)
        }
        setInitGuideOpen(false)
      }

      // Sync active downloading queue from backend
      if (statusData.downloads) {
        const activeQueue: QueueItem[] = []
        Object.entries(statusData.downloads).forEach(([url, item]: [string, DownloadQueueItem]) => {
          const rawItems = Array.isArray(item.items) ? item.items : []
          const children: Array<{
            trackId: string
            name: string
            artistName?: string
            albumName?: string
            artworkUrl?: string
            file_path?: string
            status: 'pending' | 'downloading' | 'completed' | 'error'
            error?: string
          }> = rawItems.map((child: DownloadItem, idx: number) => ({
            trackId: String(child?.track_id || `${url}-${idx}`),
            name: (child?.name as string | undefined) || `曲目 ${idx + 1}`,
            artistName: child?.artist_name as string | undefined,
            albumName: child?.album_name as string | undefined,
            artworkUrl: child?.artwork_url as string | undefined,
            file_path: child?.file_path as string | undefined,
            status: (child?.status as 'pending' | 'downloading' | 'completed' | 'error' | undefined) || 'pending',
            error: child?.error as string | undefined,
          }))

          const firstMediaItem = children[0]
          const sourceLower = url.toLowerCase()
          const isCollectionByUrl = sourceLower.includes('/album/') || sourceLower.includes('/playlist/')
          const isAlbumTask = children.length > 1 || isCollectionByUrl
          const isMvTask = !isAlbumTask && sourceLower.includes('/music-video/')

          const hasError = children.some((child) => child.status === 'error')
          const allCompleted = children.length > 0 && children.every((child) => child.status === 'completed')
          const backendTaskStatus = String(item?.status || '').toLowerCase()
          let normalizedStatus: QueueItem['status'] = 'downloading'
          if (backendTaskStatus === 'error') {
            normalizedStatus = 'error'
          } else if (backendTaskStatus === 'completed') {
            normalizedStatus = 'completed'
          } else if (hasError) {
            normalizedStatus = 'error'
          } else if (allCompleted) {
            normalizedStatus = 'completed'
          }

          const albumName = firstMediaItem?.albumName
          const trackName = firstMediaItem?.name
          const artistName = firstMediaItem?.artistName
          const cover = gtarturl(firstMediaItem?.artworkUrl, 150)

          let displayTitle = `任务 (${firstMediaItem?.trackId || 'Unknown'})`
          if (isAlbumTask) {
            displayTitle = albumName || trackName || `专辑任务（${children.length} 首）`
          } else if (trackName) {
            displayTitle = artistName ? `${artistName} - ${trackName}` : trackName
          }

          const qualityStr = isAlbumTask ? '专辑' : (isMvTask ? 'MV' : nrmlcdclbl(item.codec))
          const taskId = isAlbumTask
            ? `album:${encodeURIComponent(url)}`
            : String(firstMediaItem?.trackId || url.split('/').pop()?.split('?')[0] || 'Unknown')

          activeQueue.push({
            id: taskId,
            title: displayTitle,
            cover,
            quality: qualityStr,
            status: normalizedStatus,
            type: isAlbumTask ? 'album' : (isMvTask ? 'mv' : 'track'),
            trackId: firstMediaItem?.trackId,
            trackName,
            artistName,
            albumName,
            tracks: isAlbumTask ? children.map((child) => ({
              trackId: child.trackId,
              name: child.name,
              artistName: child.artistName,
              file_path: child.file_path,
              cover: child.artworkUrl ? gtarturl(child.artworkUrl, 96) : cover,
              status: child.status,
              error: child.error,
            })) : undefined,
            errorDetails: item.error || children.find((child) => child.error)?.error || '',
            sourceUrl: url,
            file_path: firstMediaItem?.file_path || item.file_path || ''
          })
        })
        setDownloadQueue(activeQueue)
      }
    } catch (err) {
      console.warn('Backend polling failed. Is backend running?', err)
    }
  }, [])

  useEffect(() => {
    // Initial fetch
    ftsthlth()
    
    // Fetch Settings
    gtstngs().then(settings => {
      if (settings[SETTINGS_KEY_CODEC]) setCodec(String(settings[SETTINGS_KEY_CODEC]))
      if (settings[SETTINGS_KEY_RESOLUTION]) setResolution(String(settings[SETTINGS_KEY_RESOLUTION]))
      if (settings[SETTINGS_KEY_METADATA_REGION]) {
        const regionVal = String(settings[SETTINGS_KEY_METADATA_REGION])
        setMetadataRegion(regionVal)
        localStorage.setItem(SETTINGS_KEY_METADATA_REGION, regionVal)
      }
      if (settings[SETTINGS_KEY_USE_WRAPPER] !== undefined) setUseWrapper(settings[SETTINGS_KEY_USE_WRAPPER] === 'true' || settings[SETTINGS_KEY_USE_WRAPPER] === true)
      if (settings[SETTINGS_KEY_VOLUME]) {
        const v = parseFloat(String(settings[SETTINGS_KEY_VOLUME]))
        setVolume(v)
        setIsMuted(v === 0)
      }
      if (settings[SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320] !== undefined) {
        setTranscodeAacToMp3_320(settings[SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320] === 'true' || settings[SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320] === true)
      }
      if (settings[SETTINGS_KEY_TRANSCODE_AAC_TO_MP4] !== undefined) {
        setTranscodeAacToMp4(settings[SETTINGS_KEY_TRANSCODE_AAC_TO_MP4] === 'true' || settings[SETTINGS_KEY_TRANSCODE_AAC_TO_MP4] === true)
      }
      if (settings[SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD] !== undefined) {
        setTranscodeAacToAacStandard(settings[SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD] === 'true' || settings[SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD] === true)
      }
      if (settings[SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC] !== undefined) {
        setTranscodeAlacToFlac(settings[SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC] === 'true' || settings[SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC] === true)
      }
      if (settings[SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV] !== undefined) {
        setTranscodeAlacToWav(settings[SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV] === 'true' || settings[SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV] === true)
      }
      if (settings[SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4] !== undefined) {
        setTranscodeAlacToMp4(settings[SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4] === 'true' || settings[SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4] === true)
      }
      if (settings[SETTINGS_KEY_INIT_GUIDE_DISMISSED] !== undefined) {
        const isDismissed = settings[SETTINGS_KEY_INIT_GUIDE_DISMISSED] === 'true' || settings[SETTINGS_KEY_INIT_GUIDE_DISMISSED] === true
        if (isDismissed) {
          localStorage.setItem(SETTINGS_KEY_INIT_GUIDE_DISMISSED, 'true')
          if (!userManuallyOpenedInitGuideRef.current) {
            setInitGuideOpen(false)
          }
        }
      }
      if (settings[SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART] !== undefined) {
        const skipped = settings[SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART] === 'true' || settings[SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART] === true
        setSkipWrapperAutostart(skipped)
        localStorage.setItem(SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART, skipped ? 'true' : 'false')
      }
      setSettingsLoaded(true)
    }).catch(err => {
      console.error(err)
      setSettingsLoaded(true)
    })

    // Fetch Recommendations
    gtrecmdtn().then(res => setRecommendations(res.recommendations || [])).catch(console.error)
    
    // Fetch History
    gthstry().then(res => {
      setDownloadHistory(res)
    }).catch(console.error)

    // Fetch Storage Paths
    gtdirs().then(res => {
      setDownloadDir(res.download_dir)
      setConvertedDir(res.converted_dir)
    }).catch(console.error)

    // Poll every 3 seconds
    const interval = setInterval(ftsthlth, 3000)
    return () => clearInterval(interval)
  }, [ftsthlth])

  // 监控启动流程并在未跳过时默认自动启动Wrapper服务
  useEffect(() => {
    if (!settingsLoaded || initGuideOpen) return
    if (wrapperAutostartAttemptedRef.current) return
    if (skipWrapperAutostart) return
    if (healthStatus?.wrapper.all_ok) return

    wrapperAutostartAttemptedRef.current = true
    void trgwrps(false, false)
  }, [settingsLoaded, initGuideOpen, skipWrapperAutostart, healthStatus?.wrapper.all_ok, trgwrps])

  useEffect(() => {
    if (!lyricsOpen || !lyricsStageRef.current) return

    const element = lyricsStageRef.current
    const updhgt = () => {
      setLyricsStageHeight(element.getBoundingClientRect().height || 320)
    }
    updhgt()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updhgt)
      return () => window.removeEventListener('resize', updhgt)
    }

    const observer = new ResizeObserver(() => updhgt())
    observer.observe(element)
    return () => observer.disconnect()
  }, [lyricsOpen])

  // Local LRC highlight sync
  useEffect(() => {
    if (lyricsSource !== 'local' || timedLyrics.length === 0) return
    let nextIndex = 0
    while (nextIndex + 1 < timedLyrics.length && timedLyrics[nextIndex + 1].time <= playbackTime + 0.02) {
      nextIndex += 1
    }
    setLyricIndex((prev) => (prev === nextIndex ? prev : nextIndex))
  }, [playbackTime, timedLyrics, lyricsSource])

  // Scroll terminal logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [terminalLogs])

  
  // Play Preview Action
  const pltrkpr = useCallback((track: SearchResult, options?: { syncPlaylist?: boolean }) => {
    const previewUrl = track.attributes.previews?.[0]?.url
    if (!previewUrl) {
      pshtst('无法播放', '该结果暂无在线预览音轨，点击“下载”可获取完整品质音频', 'error')
      return
    }

    const shouldSyncPlaylist = options?.syncPlaylist !== false
    if (shouldSyncPlaylist) {
      addstpl(track, true)
    }

    setPlayingTrack(track)
    setLyricIndex(0)
    setTimedLyrics([])
    setPlainLyrics([])
    setLyricsSource('preview')
    if (audioRef.current) {
      audioRef.current.src = previewUrl
      audioRef.current.load()
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Audio play failed:', err)
          pshtst('播放失败', '预览加载错误，请检查网络连接', 'error')
        })
    }
  }, [pshtst, addstpl])

  // Player controls
  const hdlplps = () => {
    if (!playingTrack) {
      if (searchResults.length > 0) {
        pltrkpr(searchResults[0])
      } else {
        pshtst('提示', '请先在搜索曲库中选择歌曲进行试听', 'info')
      }
      return
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.error('Play failed:', err)
          })
      }
    }
  }

  // 全局快捷键：空格播放/暂停，Esc关闭浮动面板
  const playRef = useRef(hdlplps)
  useEffect(() => {
    playRef.current = hdlplps
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        playRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (lyricsOpen) setLyricsOpen(false)
      else if (playlistOpen) setPlaylistOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lyricsOpen, playlistOpen])

  const rsvadpk = (direction: -1 | 1): string | null => {
    if (playlistEntries.length === 0) return null

    const currentIndex = playlistEntries.findIndex((entry) => entry.key === currentPlaylistKey)
    if (currentIndex === -1) {
      return direction > 0 ? playlistEntries[0]?.key || null : playlistEntries[playlistEntries.length - 1]?.key || null
    }

    if (isShuffle && playlistEntries.length > 1) {
      const candidateIndexes = playlistEntries
        .map((_, idx) => idx)
        .filter((idx) => idx !== currentIndex)
      const nextIndex = candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)]
      return playlistEntries[nextIndex]?.key || null
    }

    let targetIndex = currentIndex + direction
    if (targetIndex < 0) targetIndex = playlistEntries.length - 1
    if (targetIndex >= playlistEntries.length) targetIndex = 0
    return playlistEntries[targetIndex]?.key || null
  }

  const hdlprv = () => {
    const playlistKey = rsvadpk(-1)
    if (playlistKey) {
      plplkey(playlistKey)
      return
    }

    if (!playingTrack || searchResults.length === 0) return
    const currentIndex = searchResults.findIndex((t) => t.id === playingTrack.id)
    if (currentIndex > 0) {
      pltrkpr(searchResults[currentIndex - 1])
    } else {
      pltrkpr(searchResults[searchResults.length - 1])
    }
  }

  const hdlnxt = () => {
    const playlistKey = rsvadpk(1)
    if (playlistKey) {
      plplkey(playlistKey)
      return
    }

    if (!playingTrack || searchResults.length === 0) return
    const currentIndex = searchResults.findIndex((t) => t.id === playingTrack.id)
    if (currentIndex >= 0 && currentIndex < searchResults.length - 1) {
      pltrkpr(searchResults[currentIndex + 1])
    } else {
      pltrkpr(searchResults[0])
    }
  }

  const hdlprgc = (e: ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value)
    setPlaybackTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const hdlvolc = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setVolume(val)
    if (val > 0) {
      setIsMuted(false)
    }
  }

  const tglmut = () => {
    setIsMuted(!isMuted)
  }

  // Audio lifecycle bindings
  const onatmu = () => {
    // 限制进度刷新频率，避免播放时每秒触发4次全树重渲染
    const now = Date.now()
    if (now - lastTimeUpdateRef.current < 250) {
      return
    }
    lastTimeUpdateRef.current = now
    if (audioRef.current) {
      setPlaybackTime(audioRef.current.currentTime)
    }
  }

  const onatlm = () => {
    if (audioRef.current) {
      setPlaybackDuration(audioRef.current.duration)
    }
  }

  const onated = () => {
    setIsPlaying(false)
    setPlaybackTime(0)
    if (isRepeat) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().then(() => setIsPlaying(true))
      }
    } else {
      hdlnxt()
    }
  }

  // Search Action
  const trgsrch = async (keywordOverride?: string) => {
    const keyword = (keywordOverride ?? searchKeyword).trim()
    if (!keyword || searchInFlightRef.current) return
    if (keywordOverride) setSearchKeyword(keyword)

    searchInFlightRef.current = true
    setSearchLoading(true)
    setSearchError('')
    setSearchPerformed(false)
    try {
      const response = await srchapl(keyword)
      rprtsrch(keyword).catch(console.error)
      let list: SearchResult[] = []

      if (response.success && response.results) {
        list = bldsrls(response.results)
      }
      setSearchResults(list)
      setSearchPerformed(true)
      apndlog(`[搜索请求] 关键字: "${keyword}"，检索出 ${list.length} 个结果`)
    } catch (err) {
      console.error(err)
      setSearchError(gterrmsg(err) || '搜索接口异常，请确认后端服务是否运行')
      pshtst('搜索失败', gterrmsg(err) || '调用代理搜索失败', 'error')
    } finally {
      searchInFlightRef.current = false
      setSearchLoading(false)
    }
  }

  // Trigger Confirmation Dlg
  const opndwcf = (track: SearchResult) => {
    setDownloadConfirmTrack(track)
    setDownloadConfirmOpen(true)
  }

  // Confirm Download and Submit to backend/local Queue
  const hdlcfdw = async () => {
    if (!downloadConfirmTrack) return
    const track = downloadConfirmTrack
    const title = track.attributes.name
    const trackUrl = track.attributes.url

    setDownloadConfirmOpen(false)
    setDownloadConfirmTrack(null)

    // Append to log console
    apndlog(`[核心调度] 发送下载任务 -> url: ${trackUrl.slice(0, 45)}...`)

    // Submit to backend API
    try {
      await sbmtdwnld(trackUrl, codec, resolution, useWrapper, metadataRegion)
      pshtst('下载已提交', `任务已发送至后台排队：${title}`, 'success')
      // Trigger instant poll to show the new item
      setTimeout(ftsthlth, 500)
    } catch (err) {
      console.error('Backend download submission failed:', err)
      pshtst('任务提交失败', `无法将 “${title}” 提交至后台：${gterrmsg(err) || err}`, 'error')
      apndlog(`[核心调度] 任务提交异常: ${gterrmsg(err) || '后端连接失败'}`)
    }
  }

  // Delete Error item from local list
  const dlquim = (id: string) => {
    setDownloadQueue((prev) => prev.filter((item) => item.id !== id))
    pshtst('清理成功', '已移除下载失败任务', 'info')
  }

  const hdlclhg = useCallback((
    groupId: string,
    groupTitle: string,
    tracks: HistoryItem[]
  ) => {
    if (!tracks.length || deletingHistoryGroupId) return

    const description = tracks.length > 1
      ? `确定删除专辑“${groupTitle}”及其 ${tracks.length} 首曲目？将同时尝试删除本地文件。`
      : `确定删除“${groupTitle}”？将同时尝试删除本地文件。`

    askConfirm({
      title: tracks.length > 1 ? '删除专辑记录' : '删除历史记录',
      description,
      confirmText: '删除',
      tone: 'error',
      onConfirm: async () => {
        setDeletingHistoryGroupId(groupId)
        try {
          const results = await Promise.allSettled(
            tracks.map((track) => dlthstry(track.track_id, true))
          )
          const successCount = results.filter((item) => item.status === 'fulfilled').length
          const failedCount = results.length - successCount

          await rfrhst()
          setOpenHistoryAlbums((prev) => ({ ...prev, [groupId]: false }))

          if (failedCount > 0) {
            pshtst('删除完成', `已删除 ${successCount} 首，失败 ${failedCount} 首`, 'info')
          } else {
            pshtst('删除完成', `已删除 ${successCount} 首曲目`, 'success')
          }
        } catch (err) {
          console.error(err)
          pshtst('删除失败', gterrmsg(err) || '整专删除失败，请稍后重试', 'error')
        } finally {
          setDeletingHistoryGroupId((current) => (current === groupId ? null : current))
        }
      },
    })
  }, [deletingHistoryGroupId, askConfirm, rfrhst, pshtst])

  const ldlclrc = useCallback(async (trackId: string) => {
    try {
      const res = await gtlcllrc(trackId)
      const parsed = prslrc(res.content || '')
      if (parsed.timed.length > 0) {
        setTimedLyrics(parsed.timed)
        setPlainLyrics([])
        setLyricsSource('local')
        setLyricIndex(0)
        return
      }
      if (parsed.plain.length > 0) {
        setTimedLyrics([])
        setPlainLyrics(parsed.plain)
        setLyricsSource('local')
        setLyricIndex(0)
        return
      }
      setTimedLyrics([])
      setPlainLyrics([])
      setLyricsSource('none')
    } catch {
      setTimedLyrics([])
      setPlainLyrics([])
      setLyricsSource('none')
    }
  }, [])

  const stlclpl = useCallback((
    trackId: string,
    metadata: { name: string; artistName: string; artworkUrl?: string },
    notify: boolean = false,
    syncPlaylist: boolean = true
  ) => {
    if (!audioRef.current) return

    const localUrl = gtlclurl(trackId)
    const fakeTrack: SearchResult = {
      id: trackId,
      type: 'songs',
      attributes: {
        name: metadata.name,
        artistName: metadata.artistName,
        url: localUrl,
        artwork: {
          url: metadata.artworkUrl || logoImage,
          width: 150,
          height: 150
        }
      }
    }

    if (syncPlaylist) {
      addlcpl(trackId, metadata, true)
    }

    setPlayingTrack(fakeTrack)
    setLyricIndex(0)
    setPlaybackTime(0)
    setPlaybackDuration(0)
    setLyricsSource('none')
    ldlclrc(trackId).catch(() => undefined)

    audioRef.current.pause()
    audioRef.current.src = localUrl
    audioRef.current.load()
    audioRef.current.play()
      .then(() => {
        setIsPlaying(true)
        if (notify) {
          pshtst('正在播放', `正在播放本地文件：${metadata.artistName} - ${metadata.name}`, 'success')
        }
      })
      .catch((err) => {
        console.error('Local audio play failed:', err)
        pshtst('播放失败', '本地音频加载失败，请确认文件存在且可访问', 'error')
      })
  }, [pshtst, ldlclrc, addlcpl])

  // Play local downloaded audio
  const pllcltr = (item: QueueItem) => {
    const trackId = item.trackId || item.id
    if (!trackId || trackId === 'Unknown') {
      pshtst('播放失败', '该下载项缺少曲目编号，暂时无法本地播放', 'error')
      return
    }
    const trackName = item.trackName || item.title
    const artistName = item.artistName || '未知歌手'
    stlclpl(trackId, { name: trackName, artistName, artworkUrl: item.cover }, true)
  }

  const plplkey = useCallback((playlistKey: string) => {
    const entry = playlistEntries.find((item) => item.key === playlistKey)
    if (!entry) return

    setCurrentPlaylistKey(entry.key)
    if (entry.source === 'local') {
      if (!entry.trackId) {
        pshtst('播放失败', '播放列表中的本地曲目缺少曲目编号', 'error')
        return
      }
      stlclpl(
        entry.trackId,
        { name: entry.title, artistName: entry.artistName, artworkUrl: entry.artworkUrl },
        false,
        false
      )
      return
    }

    if (!entry.previewUrl) {
      pshtst('播放失败', '播放列表中的试听链接不可用', 'error')
      return
    }

    const previewTrack: SearchResult = {
      id: entry.searchTrackId || entry.key.replace('preview:', ''),
      type: 'songs',
      attributes: {
        name: entry.title,
        artistName: entry.artistName,
        url: entry.previewUrl,
        artwork: {
          url: entry.artworkUrl || logoImage,
          width: 150,
          height: 150
        },
        previews: [{ url: entry.previewUrl }]
      }
    }
    pltrkpr(previewTrack, { syncPlaylist: false })
  }, [playlistEntries, pshtst, stlclpl, pltrkpr])

  const rmplent = useCallback((playlistKey: string) => {
    setPlaylistEntries((prev) => {
      const removeIndex = prev.findIndex((item) => item.key === playlistKey)
      if (removeIndex === -1) return prev

      const next = prev.filter((item) => item.key !== playlistKey)
      if (currentPlaylistKey === playlistKey) {
        if (next.length === 0) {
          setCurrentPlaylistKey('')
        } else {
          const fallbackIndex = Math.min(removeIndex, next.length - 1)
          setCurrentPlaylistKey(next[fallbackIndex].key)
        }
      }
      return next
    })
  }, [currentPlaylistKey])

  const clrplen = useCallback(() => {
    setPlaylistEntries([])
    setCurrentPlaylistKey('')
    pshtst('播放列表', '已清空当前播放列表', 'info')
  }, [pshtst])

  const hdladqp = useCallback((item: QueueItem) => {
    const trackId = item.trackId || item.id
    if (!trackId || trackId === 'Unknown') {
      pshtst('添加失败', '该本地曲目缺少曲目编号，无法加入播放列表', 'error')
      return
    }

    const trackName = item.trackName || item.title
    const artistName = item.artistName || '未知歌手'
    addlcpl(trackId, { name: trackName, artistName, artworkUrl: item.cover }, false)
    pshtst('已添加', `已加入播放列表：${trackName}`, 'success')
  }, [addlcpl, pshtst])

  const hdladhp = useCallback((track: HistoryItem) => {
    addlcpl(
      track.track_id,
      {
        name: track.name,
        artistName: track.artist_name || '未知歌手',
        artworkUrl: track.artwork_url || gtlclart(track.track_id),
      },
      false
    )
    pshtst('已添加', `已加入播放列表：${track.name}`, 'success')
  }, [addlcpl, pshtst])

  // 保存下载与转换目录
  const svstordirs = useCallback(async () => {
    const dl = downloadDir.trim()
    const cv = convertedDir.trim()
    if (!dl || !cv) {
      pshtst('保存失败', '下载目录与转换目录不能为空', 'error')
      return
    }
    setStorageSaving(true)
    try {
      const res = await svdirs(dl, cv)
      setDownloadDir(res.download_dir)
      setConvertedDir(res.converted_dir)
      pshtst('保存成功', '存储位置已更新，仅影响后续下载与转码', 'success')
    } catch (err) {
      pshtst('保存失败', gterrmsg(err) || '无法保存存储位置', 'error')
    } finally {
      setStorageSaving(false)
    }
  }, [downloadDir, convertedDir, pshtst])

  // 恢复默认下载与转换目录
  const rststordirs = useCallback(async () => {
    setStorageSaving(true)
    try {
      const res = await rstdirs()
      setDownloadDir(res.download_dir)
      setConvertedDir(res.converted_dir)
      pshtst('已恢复默认', '下载与转换目录已恢复默认位置', 'success')
    } catch (err) {
      pshtst('恢复失败', gterrmsg(err) || '无法恢复默认存储位置', 'error')
    } finally {
      setStorageSaving(false)
    }
  }, [pshtst])

  // Save cookies action
  const trgsvck = async () => {
    if (!cookieText.trim()) return
    setCookieSaving(true)
    try {
      const res = await svcks(cookieText)
      if (res.success) {
        pshtst('授权成功', '登录凭据更新并重载成功！', 'success')
        setCookieText('')
        ftsthlth()
        
        apndlog(`[授权系统] 登录凭据文件加载成功，重置曲库连接。`)
      } else {
        pshtst('解析失败', res.message || '格式解析异常，请检查Cookies.txt', 'error')
      }
    } catch (err) {
      console.error(err)
      pshtst('文件写入失败', gterrmsg(err) || '无法写入 cookies.txt', 'error')
    } finally {
      setCookieSaving(false)
    }
  }

  // Scan local download folder and backfill DB history
  const trglscn = async () => {
    if (scanningLocal) return
    setScanningLocal(true)
    try {
      const res = await scnlcl()
      const summary = `扫描 ${res.scanned_files} 首，新增 ${res.inserted}，更新 ${res.updated}，跳过 ${res.skipped}，失败 ${res.failed}`
      pshtst('扫描完成', summary, res.failed > 0 ? 'info' : 'success')
      gthstry().then((rows) => setDownloadHistory(rows)).catch(console.error)
    } catch (err) {
      console.error(err)
      pshtst('扫描失败', gterrmsg(err) || '无法扫描本地曲库', 'error')
    } finally {
      setScanningLocal(false)
    }
  }

  // Search recommendation click helper
  const hdlrcck = (keyword: string) => {
    void trgsrch(keyword)
  }

  // Filter result logic
  const filteredSearchResults = searchFilter === 'all'
    ? searchResults
    : searchResults.filter((item) => item.type === searchFilter)

  const historyAlbumGroups: Array<{
    id: string
    title: string
    artistName: string
    cover: string
    folderPath: string
    tracks: HistoryItem[]
  }> = useMemo(() => {
    const groups = new Map<string, {
      id: string
      title: string
      artistName: string
      cover: string
      folderPath: string
      tracks: HistoryItem[]
    }>()

    for (const item of downloadHistory) {
      const albumName = (item.album_name || '').trim()
      const artistName = (item.artist_name || '未知歌手').trim()
      const isAlbumGroup = albumName.length > 0
      const key = isAlbumGroup
        ? `${artistName}::${albumName}`
        : `single::${item.track_id}`

      if (!groups.has(key)) {
        groups.set(key, {
          id: `history:${key}`,
          title: isAlbumGroup ? albumName : item.name,
          artistName,
          cover: item.artwork_url ? gtarturl(item.artwork_url, 96) : logoImage,
          folderPath: gtprntpth(item.file_path),
          tracks: []
        })
      }

      const group = groups.get(key)!
      group.tracks.push(item)
      if (!group.folderPath) {
        group.folderPath = gtprntpth(item.file_path)
      }
      if ((group.cover === logoImage || !group.cover) && item.artwork_url) {
        group.cover = gtarturl(item.artwork_url, 96)
      }
    }

    return Array.from(groups.values())
  }, [downloadHistory])

  
  // Calculate downloading badge count
  const downloadingCount = downloadQueue.filter((d) => d.status === 'downloading').length

  // Accordion toggle helper
  const tglacd = (key: string) => {
    setAccordionOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const displayLyricsLines = (() => {
    if (lyricsSource === 'preview') return []
    if (lyricsSource === 'local') {
      if (timedLyrics.length > 0) return timedLyrics.map((item) => item.text)
      if (plainLyrics.length > 0) return plainLyrics
    }
    return []
  })().map((line) => {
    const text = (line || '').trim()
    return text || '...'
  })

  const activeDisplayLyricIndex = displayLyricsLines.length > 0
    ? Math.min(Math.max(lyricIndex, 0), displayLyricsLines.length - 1)
    : 0
  const lyricLineHeight = lyricsStageHeight <= 280 ? 52 : 58
  const lyricCenterOffset = Math.max(0, (lyricsStageHeight - lyricLineHeight) / 2)
  const lyricTrackOffset = lyricCenterOffset - (activeDisplayLyricIndex * lyricLineHeight)

  return {
    accordionOpen,
    activeDisplayLyricIndex,
    activeTab,
    addlcpl,
    addplen,
    addstpl,
    bldprvp,
    chkagr,
    clrplen,
    codec,
    cookieSaving,
    cookieText,
    currentPlaylistKey,
    dlquim,
    deletingHistoryGroupId,
    disclaimerLang,
    dsmsgd,
    displayLyricsLines,
    downloadConfirmOpen,
    downloadConfirmTrack,
    downloadHistory,
    downloadQueue,
    downloaderInitialized,
    downloadingCount,
    ftsthlth,
    filteredSearchResults,
    hdladhp,
    hdladqp,
    hdlclwd,
    hdlclws,
    hdlcfdw,
    hdlcfw2,
    hdlcfws,
    hdlclhg,
    hdlsgn,
    hdlckl,
    hdlent,
    hdlnxt,
    hdlopn,
    hdlplps,
    hdlprv,
    hdlprgc,
    hdlrcck,
    hdlrsws,
    hdlswrp,
    hdlvolc,
    healthStatus,
    historyAlbumGroups,
    initAgreementReachedEnd,
    initCookieConfigured,
    initCookieLoggingIn,
    initEnterConfirmOpen,
    initGuideOpen,
    initGuideStep,
    initWrapperConfigured,
    isMuted,
    isPlaying,
    isRepeat,
    isShuffle,
    ldlclrc,
    lyricCenterOffset,
    lyricIndex,
    lyricLineHeight,
    lyricTrackOffset,
    lyricsOpen,
    lyricsSource,
    lyricsStageHeight,
    metadataRegion,
    mode,
    onated,
    onatlm,
    onatmu,
    openAlbums,
    opndwcf,
    opnext,
    openHistoryAlbums,
    opnwrpd,
    opnwsld,
    plainLyrics,
    pllcltr,
    plplkey,
    pltrkpr,
    playbackDuration,
    playbackTime,
    playingTrack,
    playlistEntries,
    playlistOpen,
    pshtst,
    recommendations,
    rmplent,
    rmtst,
    repositoryUrl,
    resolution,
    rsvadpk,
    scanningLocal,
    searchError,
    searchKeyword,
    searchLoading,
    searchRecommendations,
    searchResults,
    setAccordionOpen,
    setActiveTab,
    setCodec,
    setCookieSaving,
    setCookieText,
    setCurrentPlaylistKey,
    setDeletingHistoryGroupId,
    setDisclaimerLang,
    setDownloadConfirmOpen,
    setDownloadConfirmTrack,
    setDownloadHistory,
    setDownloadQueue,
    setDownloaderInitialized,
    setHealthStatus,
    setInitAgreementReachedEnd,
    setInitCookieLoggingIn,
    setInitEnterConfirmOpen,
    setInitGuideOpen,
    setInitGuideStep,
    setIsMuted,
    setIsPlaying,
    setIsRepeat,
    setIsShuffle,
    setLyricIndex,
    setLyricsOpen,
    setLyricsSource,
    setLyricsStageHeight,
    setMetadataRegion,
    setOpenAlbums,
    setOpenHistoryAlbums,
    setPlainLyrics,
    setPlaybackDuration,
    setPlaybackTime,
    setPlayingTrack,
    setPlaylistEntries,
    setPlaylistOpen,
    setRecommendations,
    setResolution,
    setScanningLocal,
    setSearchError,
    setSearchKeyword,
    setSearchLoading,
    setSearchResults,
    setSettingsLoaded,
    setSkipWrapperAutostart,
    setTerminalLogs,
    setTimedLyrics,
    setToasts,
    setTranscodeAacToAacStandard,
    setTranscodeAacToMp3_320,
    setTranscodeAacToMp4,
    setTranscodeAlacToFlac,
    setTranscodeAlacToMp4,
    setTranscodeAlacToWav,
    setUseWrapper,
    setVolume,
    setWrapperInput2fa,
    setWrapperInputAppleId,
    setWrapperInputDialogOpen,
    setWrapperInputPassword,
    setWrapperInputSubmitting,
    setWrapperSetupDialogOpen,
    setWrapperSetupLoading,
    setWrapperSetupPrecheck,
    setWrapperSetupStatusData,
    setWslInstallDialogOpen,
    setWslInstallLoading,
    setWslInstallPrecheck,
    setWslInstallStatusData,
    settingsLoaded,
    skipWrapperAutostart,
    stlclpl,
    stpwrpp,
    stpwslp,
    sncwrps,
    sncwsls,
    terminalLogs,
    timedLyrics,
    toasts,
    tglacd,
    tglmod,
    tglmut,
    transcodeAacToAacStandard,
    transcodeAacToMp3_320,
    transcodeAacToMp4,
    transcodeAlacToFlac,
    transcodeAlacToMp4,
    transcodeAlacToWav,
    trglscn,
    trgsvck,
    trgsrch,
    trgwrps,
    useWrapper,
    volume,
    wrapperInput2fa,
    wrapperInputAppleId,
    wrapperInputDialogOpen,
    wrapperInputPassword,
    wrapperInputSubmitting,
    wrapperSetupDialogOpen,
    wrapperSetupLoading,
    wrapperSetupPrecheck,
    wrapperSetupStatusData,
    wslInstallDialogOpen,
    wslInstallLoading,
    wslInstallPrecheck,
    setaud,
    setlyr,
    setisc,
    setlge,
    askConfirm,
    closeConfirm,
    runConfirm,
    confirmPrompt,
    searchFilter,
    setSearchFilter,
    searchPerformed,
    dlhsttrk,
    rfrhst,
    setwrpenb,
    downloadDir,
    convertedDir,
    setDownloadDir,
    setConvertedDir,
    storageSaving,
    svstordirs,
    rststordirs,
    wslInstallStatusData,
  }
}

export type AppStore = ReturnType<typeof useStor>
