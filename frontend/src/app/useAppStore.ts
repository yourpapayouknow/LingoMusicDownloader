// 前端应用状态与业务逻辑聚合store
import { useCallback, useEffect, useMemo, useRef, useState } from '../head'
import logoImage from '../assets/lingomusiclogo-sm.png'
import { useTheme } from '../theme/ThemeProvider'
import type { ToastItem, ToastTone } from '../ui/components'
import {
  srchapl, sbmtdwnld, gtstts, gthlth, svcks, fnllgn,
  wslprchk, wslstrt, wslstts, wrprprchk, wrprstrt, wrprstts, wrprint,
  gtstngs, svstngs, gthstry, dlthstry, gtrecmdtn, rprtsrch,
  gtlclurl, gtlclart, gtlcllrc, scnlcl,
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
  MOCK_LYRICS,
} from './constants'
import { bldsrls } from './helpers'
import type { QueueItem, PlaylistEntry } from './types'

export function useAppStore() {
  const { mode, toggleMode } = useTheme()

  // App Layout Navigation State
  const [activeTab, setActiveTab] = useState<'search' | 'download' | 'settings' | 'about'>('search')

  // Search Page State
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  
  // Search Recommendations
  const searchRecommendations = ['周杰伦', '陈奕迅', '林俊杰', '邓紫棋', 'Taylor Swift', '王菲']

  // Search Filter State
  const [filterType, setFilterType] = useState({
    all: true,
    song: false,
    album: false,
    artist: false,
    mv: false
  })

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
    '[WSL子系统] 正在检测 WSL 解密容器环境...'
  ])
  const logsEndRef = useRef<HTMLDivElement | null>(null)

  // Global Toast Notifications State
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Download confirmation Dialog warning
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
  const setAudioEl = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el
  }, [])

  // 绑定歌词容器引用
  const setLyricsStageEl = useCallback((el: HTMLDivElement | null) => {
    lyricsStageRef.current = el
  }, [])

  // 绑定协议滚动容器引用
  const setInitScrollEl = useCallback((el: HTMLDivElement | null) => {
    initAgreementScrollRef.current = el
  }, [])

  // 绑定日志底部引用
  const setLogsEndEl = useCallback((el: HTMLDivElement | null) => {
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
  const pushToast = useCallback((title: string, description: string, tone: ToastTone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { id, title, description, tone }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const repositoryUrl = 'https://github.com/yourpapayouknow/LingoMusicDownloader'

  const openExternalLink = useCallback((url: string, label?: string) => {
    const targetLabel = label || url
    try {
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (!newWindow) {
        throw new Error('popup_blocked')
      }
      pushToast('已打开链接', `正在打开：${targetLabel}`, 'success')
    } catch {
      pushToast('打开失败', `无法打开链接：${targetLabel}`, 'error')
    }
  }, [pushToast])

  const initCookieConfigured = Boolean(healthStatus?.cookies_ok)
  const initWrapperConfigured = Boolean(healthStatus?.wrapper.all_ok)

  const checkInitAgreementScroll = useCallback(() => {
    const element = initAgreementScrollRef.current
    if (!element) return
    const reached = element.scrollTop + element.clientHeight >= element.scrollHeight - 8
    if (reached) {
      setInitAgreementReachedEnd(true)
    }
  }, [])

  const handleDisagreeAndExit = useCallback(() => {
    if (istri()) {
      clswin()
      return
    }
    window.close()
  }, [])

  const handleInitCookieLogin = useCallback(async () => {
    if (initCookieLoggingIn) {
      const activeSession = loginWindowSessionRef.current
      if (activeSession) {
        pushToast('正在完成登录', '正在关闭登录窗口并继续校验，请稍候…', 'info')
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

    const stopProbe = () => {
      if (probeTimer !== null) {
        window.clearInterval(probeTimer)
        probeTimer = null
      }
    }

    // 窗口销毁前优先通过Tauri内存接口抓取最新Cookies
    const captureLiveCookiesBeforeClose = async (windowLabel: string) => {
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

    const finalizeAfterWindowClosed = async () => {
      if (finalized) return
      finalized = true
      stopProbe()
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
            message: saveResult.message || 'Cookies 已保存并完成初始化',
            cookies_count: liveCookieCount || content.split('\n').filter((line) => line.trim() && !line.startsWith('#')).length,
          }
        } else if (observedPreLoginCookies) {
          result = {
            success: false,
            message: '未检测到完整 Apple Music 登录态（缺少 media-user-token），请先在弹窗内完成账号登录再关闭。',
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
          pushToast('登录成功', result.message || 'Cookies 导出并初始化成功', 'success')
          const timeStr = new Date().toLocaleTimeString()
          setTerminalLogs(prev => [
            ...prev,
            `[${timeStr}] [授权系统] 已自动导出并加载 Apple Music Cookies (${result.cookies_count} 条)。`
          ].slice(-25))
        } else {
          pushToast('登录未完成', result.message || '未检测到有效登录态', 'error')
        }
      } catch (err) {
        console.error(err)
        pushToast('登录校验失败', gterrmsg(err) || '无法导出登录 Cookies', 'error')
      } finally {
        setInitCookieLoggingIn(false)
      }
    }

    const probeLoginState = async () => {
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
          pushToast('检测到登录', '已识别 Apple 登录态，正在自动关闭窗口并完成校验...', 'success')
          try {
            await loginWindowSession?.close()
            window.setTimeout(() => {
              void finalizeAfterWindowClosed()
            }, 600)
          } catch (e) {
            console.warn('Auto close login window failed, fallback to finalize', e)
            void finalizeAfterWindowClosed()
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
      pushToast('已打开网页', '请完成登录后手动导出 Cookies（当前为浏览器模式）', 'info')
      return
    }

    setInitCookieLoggingIn(true)
    try {
      loginWindowSession = await opnapllgn({
        dataDirectory: 'apple-music-login',
        onBeforeClose: captureLiveCookiesBeforeClose,
        onClosed: () => {
          void finalizeAfterWindowClosed()
        },
        onError: (message) => {
          finalized = true
          stopProbe()
          loginFinalizeRef.current = null
          loginWindowSessionRef.current = null
          setInitCookieLoggingIn(false)
          pushToast('登录窗口异常', message, 'error')
        },
      })

      if (!loginWindowSession) {
        finalized = true
        stopProbe()
        loginFinalizeRef.current = null
        loginWindowSessionRef.current = null
        setInitCookieLoggingIn(false)
        pushToast('启动失败', '当前运行环境不支持内置登录窗口', 'error')
        return
      }

      loginWindowSessionRef.current = loginWindowSession
      loginFinalizeRef.current = finalizeAfterWindowClosed
      pushToast('请先登录', '登录 Apple Music 后系统会尝试自动完成；若未自动关闭，可点击右上角 X 或“完成登录并继续”。', 'info')
      probeTimer = window.setInterval(() => {
        void probeLoginState()
      }, 1200)
      void probeLoginState()
    } catch (err) {
      console.error(err)
      finalized = true
      stopProbe()
      loginFinalizeRef.current = null
      loginWindowSessionRef.current = null
      setInitCookieLoggingIn(false)
      pushToast('启动失败', gterrmsg(err) || '无法打开 Apple Music 登录窗口', 'error')
    }
  }, [initCookieLoggingIn, pushToast])

  // 关闭初始化引导弹窗并持久化完成状态
  const dismissInitGuide = useCallback(() => {
    userManuallyOpenedInitGuideRef.current = false
    localStorage.setItem(SETTINGS_KEY_INIT_GUIDE_DISMISSED, 'true')
    setInitGuideOpen(false)
    svstngs({
      [SETTINGS_KEY_INIT_GUIDE_DISMISSED]: 'true'
    }).catch(console.error)
  }, [])

  // 确认进入主界面
  const handleInitEnterSoftware = useCallback(() => {
    if (!initWrapperConfigured) {
      setInitEnterConfirmOpen(true)
      return
    }
    setSkipWrapperAutostart(false)
    localStorage.setItem(SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART, 'false')
    svstngs({ [SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART]: 'false' }).catch(console.error)
    dismissInitGuide()
  }, [initWrapperConfigured, dismissInitGuide])

  // 从设置界面手动打开初始化页面
  const handleOpenInitGuideFromSettings = useCallback(() => {
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

  const stopWslInstallPolling = useCallback(() => {
    if (wslInstallPollTimerRef.current !== null) {
      window.clearInterval(wslInstallPollTimerRef.current)
      wslInstallPollTimerRef.current = null
    }
  }, [])

  const syncWslInstallStatus = useCallback(async () => {
    const status = await wslstts()
    setWslInstallStatusData(status)

    if (status.completed) {
      stopWslInstallPolling()
      setWslInstallLoading(false)

      if (!wslInstallCompletedNotifiedRef.current) {
        wslInstallCompletedNotifiedRef.current = true
        if (status.success_flag) {
          pushToast('安装完成', status.message || 'WSL2 安装与配置已完成', 'success')
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
          pushToast('安装失败', status.message || 'WSL2 安装流程失败，请查看日志', 'error')
        }
      }
    }

    return status
  }, [pushToast, stopWslInstallPolling])

  const openWslInstallDialog = useCallback(async () => {
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
        stopWslInstallPolling()
        wslInstallPollTimerRef.current = window.setInterval(() => {
          syncWslInstallStatus().catch(console.error)
        }, 1200)
      }
    } catch (err) {
      console.error(err)
      pushToast('检查失败', gterrmsg(err) || '无法获取WSL2安装状态', 'error')
    } finally {
      setWslInstallLoading(false)
    }
  }, [pushToast, stopWslInstallPolling, syncWslInstallStatus])

  const handleConfirmInstallWsl2 = useCallback(async () => {
    if (wslInstallLoading) return
    if (wslInstallPrecheck?.already_installed) {
      pushToast('无需安装', wslInstallPrecheck.message || '检测到本机已安装WSL2', 'info')
      return
    }
    setWslInstallLoading(true)
    wslInstallCompletedNotifiedRef.current = false

    try {
      const startRes = await wslstrt({ required_gb: 15 })
      if (!startRes.success) {
        pushToast('无法安装', startRes.message || 'WSL2 安装前检查未通过', 'error')
        setWslInstallLoading(false)
        return
      }

      if (startRes.status === 'success') {
        await syncWslInstallStatus()
        setWslInstallLoading(false)
        return
      }

      await syncWslInstallStatus()
      stopWslInstallPolling()
      wslInstallPollTimerRef.current = window.setInterval(() => {
        syncWslInstallStatus().catch(console.error)
      }, 1200)
    } catch (err) {
      console.error(err)
      pushToast('启动失败', gterrmsg(err) || '无法启动 WSL2 安装流程', 'error')
      setWslInstallLoading(false)
    }
  }, [wslInstallLoading, wslInstallPrecheck, pushToast, stopWslInstallPolling, syncWslInstallStatus])

  const handleCloseWslInstallDialog = useCallback(() => {
    if (wslInstallStatusData?.running) return
    stopWslInstallPolling()
    setWslInstallDialogOpen(false)
  }, [stopWslInstallPolling, wslInstallStatusData])

  const stopWrapperSetupPolling = useCallback(() => {
    if (wrapperSetupPollTimerRef.current !== null) {
      window.clearInterval(wrapperSetupPollTimerRef.current)
      wrapperSetupPollTimerRef.current = null
    }
  }, [])

  const syncWrapperSetupStatus = useCallback(async () => {
    const status = await wrprstts()
    setWrapperSetupStatusData(status)

    if (status.awaiting_input) {
      setWrapperInputDialogOpen(true)
    } else if (!status.running) {
      setWrapperInputDialogOpen(false)
    }

    if (status.completed) {
      stopWrapperSetupPolling()
      setWrapperSetupLoading(false)
      setWrapperInputSubmitting(false)

      if (!wrapperSetupCompletedNotifiedRef.current) {
        wrapperSetupCompletedNotifiedRef.current = true
        if (status.success_flag) {
          setSkipWrapperAutostart(false)
          localStorage.setItem(SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART, 'false')
          svstngs({ [SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART]: 'false' }).catch(console.error)
          pushToast('Wrapper已就绪', status.message || 'Wrapper正在运行', 'success')
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
          pushToast('Wrapper流程失败', status.message || '请查看日志并重试', 'error')
        }
      }
    }

    return status
  }, [pushToast, stopWrapperSetupPolling])

  const openWrapperSetupDialog = useCallback(async () => {
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
        stopWrapperSetupPolling()
        wrapperSetupPollTimerRef.current = window.setInterval(() => {
          syncWrapperSetupStatus().catch(console.error)
        }, 1100)
      }
    } catch (err) {
      console.error(err)
      pushToast('检查失败', gterrmsg(err) || '无法获取Wrapper状态', 'error')
    } finally {
      setWrapperSetupLoading(false)
    }
  }, [pushToast, stopWrapperSetupPolling, syncWrapperSetupStatus])

  // 启动Wrapper服务并启动状态轮询监控
  const triggerWrapperSetup = useCallback(async (forceRestart: boolean = false, isSilent: boolean = false) => {
    if (wrapperSetupLoading) return false
    setWrapperSetupLoading(true)
    wrapperSetupCompletedNotifiedRef.current = false

    try {
      const startRes = await wrprstrt({ force_restart: forceRestart })
      if (!startRes.success) {
        if (!isSilent) {
          pushToast(forceRestart ? '无法重启' : '无法启动', startRes.message || 'Wrapper启动前检查未通过', 'error')
        }
        setWrapperSetupLoading(false)
        return false
      }

      await syncWrapperSetupStatus()
      if (startRes.status !== 'success') {
        stopWrapperSetupPolling()
        wrapperSetupPollTimerRef.current = window.setInterval(() => {
          syncWrapperSetupStatus().catch(console.error)
        }, 1100)
      } else {
        setWrapperSetupLoading(false)
      }
      return true
    } catch (err) {
      console.error(err)
      if (!isSilent) {
        pushToast(forceRestart ? '重启失败' : '启动失败', gterrmsg(err) || '无法启动Wrapper流程', 'error')
      }
      setWrapperSetupLoading(false)
      return false
    }
  }, [wrapperSetupLoading, pushToast, stopWrapperSetupPolling, syncWrapperSetupStatus])

  // 确认启动Wrapper服务
  const handleConfirmStartWrapperSetup = useCallback(async () => {
    await triggerWrapperSetup(false, false)
  }, [triggerWrapperSetup])

  // 确认重启Wrapper服务
  const handleRestartWrapperSetup = useCallback(async () => {
    await triggerWrapperSetup(true, false)
  }, [triggerWrapperSetup])

  const handleCloseWrapperSetupDialog = useCallback(() => {
    if (wrapperSetupStatusData?.running) return
    stopWrapperSetupPolling()
    setWrapperInputDialogOpen(false)
    setWrapperSetupDialogOpen(false)
  }, [wrapperSetupStatusData, stopWrapperSetupPolling])

  const handleSubmitWrapperInput = useCallback(async () => {
    const inputType = wrapperSetupStatusData?.input_type
    if (!inputType) return
    if (wrapperInputSubmitting) return

    try {
      setWrapperInputSubmitting(true)

      if (inputType === 'credentials') {
        const appleId = wrapperInputAppleId.trim()
        const password = wrapperInputPassword.trim()
        if (!appleId || !password) {
          pushToast('输入不完整', '请输入Apple ID与密码', 'error')
          setWrapperInputSubmitting(false)
          return
        }

        const res = await wrprint({
          input_type: 'credentials',
          apple_id: appleId,
          password,
        })
        if (!res.success) {
          pushToast('提交失败', res.message || '账号密码提交失败', 'error')
          setWrapperInputSubmitting(false)
          return
        }

        setWrapperInputDialogOpen(false)
        setWrapperInput2fa('')
      } else {
        const code = wrapperInput2fa.trim()
        if (!code) {
          pushToast('输入不完整', '请输入2FA验证码', 'error')
          setWrapperInputSubmitting(false)
          return
        }

        const res = await wrprint({
          input_type: '2fa',
          code,
        })
        if (!res.success) {
          pushToast('提交失败', res.message || '2FA验证码提交失败', 'error')
          setWrapperInputSubmitting(false)
          return
        }

        setWrapperInputDialogOpen(false)
      }

      await syncWrapperSetupStatus()
      stopWrapperSetupPolling()
      wrapperSetupPollTimerRef.current = window.setInterval(() => {
        syncWrapperSetupStatus().catch(console.error)
      }, 1100)
    } catch (err) {
      console.error(err)
      pushToast('提交失败', gterrmsg(err) || '无法提交Wrapper输入', 'error')
    } finally {
      setWrapperInputSubmitting(false)
    }
  }, [
    wrapperSetupStatusData,
    wrapperInputSubmitting,
    wrapperInputAppleId,
    wrapperInputPassword,
    wrapperInput2fa,
    pushToast,
    syncWrapperSetupStatus,
    stopWrapperSetupPolling
  ])

  useEffect(() => {
    if (!initGuideOpen || initGuideStep !== 1) return

    const element = initAgreementScrollRef.current
    if (!element) return

    const onScroll = () => checkInitAgreementScroll()
    element.addEventListener('scroll', onScroll)
    const raf = window.requestAnimationFrame(onScroll)

    return () => {
      element.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(raf)
    }
  }, [initGuideOpen, initGuideStep, checkInitAgreementScroll])

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
      stopWslInstallPolling()
      stopWrapperSetupPolling()
    }
  }, [stopWslInstallPolling, stopWrapperSetupPolling])

  const buildPreviewPlaylistEntry = useCallback((track: SearchResult): PlaylistEntry | null => {
    const previewUrl = track.attributes.previews?.[0]?.url as string | undefined
    if (!previewUrl) return null
    return {
      key: `preview:${track.id}`,
      source: 'preview',
      title: track.attributes.name,
      artistName: track.attributes.artistName || '未知艺术家',
      artworkUrl: track.attributes.artwork?.url || logoImage,
      previewUrl,
      searchTrackId: track.id,
    }
  }, [])

  const addPlaylistEntry = useCallback((entry: PlaylistEntry, setCurrent: boolean = true) => {
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

  const addSearchTrackToPlaylist = useCallback((track: SearchResult, setCurrent: boolean = true) => {
    const entry = buildPreviewPlaylistEntry(track)
    if (!entry) return
    addPlaylistEntry(entry, setCurrent)
  }, [buildPreviewPlaylistEntry, addPlaylistEntry])

  const addLocalTrackToPlaylist = useCallback((
    trackId: string,
    metadata: { name: string; artistName: string; artworkUrl?: string },
    setCurrent: boolean = true
  ) => {
    addPlaylistEntry({
      key: `local:${trackId}`,
      source: 'local',
      title: metadata.name,
      artistName: metadata.artistName || '未知艺术家',
      artworkUrl: metadata.artworkUrl || logoImage,
      trackId,
    }, setCurrent)
  }, [addPlaylistEntry])

  // Persist Settings to API
  useEffect(() => {
    if (!settingsLoaded) return
    localStorage.setItem(SETTINGS_KEY_METADATA_REGION, metadataRegion)
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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Sync volume to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
      audioRef.current.muted = isMuted
    }
  }, [isMuted, volume])

  // Poll Downloads Status & Backend Health
  const fetchStatusAndHealth = useCallback(async () => {
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

          const qualityStr = isAlbumTask ? '专辑' : (isMvTask ? 'mv' : nrmlcdclbl(item.codec))
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
    fetchStatusAndHealth()
    
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

    // Poll every 3 seconds
    const interval = setInterval(fetchStatusAndHealth, 3000)
    return () => clearInterval(interval)
  }, [fetchStatusAndHealth])

  // 监控启动流程并在未跳过时默认自动启动Wrapper服务
  useEffect(() => {
    if (!settingsLoaded || initGuideOpen) return
    if (wrapperAutostartAttemptedRef.current) return
    if (skipWrapperAutostart) return
    if (healthStatus?.wrapper.all_ok) return

    wrapperAutostartAttemptedRef.current = true
    void triggerWrapperSetup(false, false)
  }, [settingsLoaded, initGuideOpen, skipWrapperAutostart, healthStatus?.wrapper.all_ok, triggerWrapperSetup])

  // Preview lyrics timer animation
  useEffect(() => {
    if (!isPlaying || lyricsSource !== 'preview') return
    const interval = setInterval(() => {
      setLyricIndex((prev) => (prev + 1) % MOCK_LYRICS.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [isPlaying, lyricsSource])

  useEffect(() => {
    if (!lyricsOpen || !lyricsStageRef.current) return

    const element = lyricsStageRef.current
    const updateHeight = () => {
      setLyricsStageHeight(element.getBoundingClientRect().height || 320)
    }
    updateHeight()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight)
      return () => window.removeEventListener('resize', updateHeight)
    }

    const observer = new ResizeObserver(() => updateHeight())
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

  // Simulated live terminal output stream
  useEffect(() => {
    const possibleLogs = [
      '轮询后端状态完成，下载队列处于空闲状态。',
      'WSL 解密端口 10020 侦听正常，准备解密握手数据包...',
      'WSL 解密端口 20020 (M3U8) 数据路由就绪。',
      '刷新 Cookies 状态：授权依然有效。',
      '心跳检测完成，守护进程（FastAPI）响应正常。',
      '等待用户提交搜索请求或曲库下载链接...',
      '无损高解析度解密密钥缓存已自动刷新。'
    ]

    const interval = setInterval(() => {
      const randomLog = possibleLogs[Math.floor(Math.random() * possibleLogs.length)]
      const timeStr = new Date().toLocaleTimeString()
      setTerminalLogs((prev) => [...prev, `[${timeStr}] [控制台流] ${randomLog}`].slice(-25))
    }, 6000)

    return () => clearInterval(interval)
  }, [])

  // Play Preview Action
  const playTrackPreview = useCallback((track: SearchResult, options?: { syncPlaylist?: boolean }) => {
    const previewUrl = track.attributes.previews?.[0]?.url
    if (!previewUrl) {
      pushToast('无法播放', '该结果暂无在线预览音轨，点击“下载”可获取完整品质音频', 'error')
      return
    }

    const shouldSyncPlaylist = options?.syncPlaylist !== false
    if (shouldSyncPlaylist) {
      addSearchTrackToPlaylist(track, true)
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
          pushToast('播放失败', '预览加载错误，请检查网络连接', 'error')
        })
    }
  }, [pushToast, addSearchTrackToPlaylist])

  // Player controls
  const handlePlayPause = () => {
    if (!playingTrack) {
      if (searchResults.length > 0) {
        playTrackPreview(searchResults[0])
      } else {
        pushToast('提示', '请先在搜索曲库中选择歌曲进行试听', 'info')
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

  const resolveAdjacentPlaylistKey = (direction: -1 | 1): string | null => {
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

  const handlePrev = () => {
    const playlistKey = resolveAdjacentPlaylistKey(-1)
    if (playlistKey) {
      playPlaylistEntryByKey(playlistKey)
      return
    }

    if (!playingTrack || searchResults.length === 0) return
    const currentIndex = searchResults.findIndex((t) => t.id === playingTrack.id)
    if (currentIndex > 0) {
      playTrackPreview(searchResults[currentIndex - 1])
    } else {
      playTrackPreview(searchResults[searchResults.length - 1])
    }
  }

  const handleNext = () => {
    const playlistKey = resolveAdjacentPlaylistKey(1)
    if (playlistKey) {
      playPlaylistEntryByKey(playlistKey)
      return
    }

    if (!playingTrack || searchResults.length === 0) return
    const currentIndex = searchResults.findIndex((t) => t.id === playingTrack.id)
    if (currentIndex >= 0 && currentIndex < searchResults.length - 1) {
      playTrackPreview(searchResults[currentIndex + 1])
    } else {
      playTrackPreview(searchResults[0])
    }
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value)
    setPlaybackTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setVolume(val)
    if (val > 0) {
      setIsMuted(false)
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  // Audio lifecycle bindings
  const onAudioTimeUpdate = () => {
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

  const onAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setPlaybackDuration(audioRef.current.duration)
    }
  }

  const onAudioEnded = () => {
    setIsPlaying(false)
    setPlaybackTime(0)
    if (isRepeat) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().then(() => setIsPlaying(true))
      }
    } else {
      handleNext()
    }
  }

  // Search Action
  const triggerSearch = async () => {
    if (!searchKeyword.trim()) return
    setSearchLoading(true)
    setSearchError('')
    try {
      const response = await srchapl(searchKeyword)
      rprtsrch(searchKeyword).catch(console.error)
      let list: SearchResult[] = []

      if (response.success && response.results) {
        list = bldsrls(response.results)
      }
      setSearchResults(list)
      if (list.length === 0) {
        setSearchError('曲库中未找到相关内容')
      }
      
      const timeStr = new Date().toLocaleTimeString()
      setTerminalLogs(prev => [...prev, `[${timeStr}] [搜索请求] 关键字: "${searchKeyword}"，检索出 ${list.length} 个结果`].slice(-25))
    } catch (err) {
      console.error(err)
      setSearchError(gterrmsg(err) || '搜索接口异常，请确认后端服务是否运行')
      pushToast('搜索失败', gterrmsg(err) || '调用代理搜索失败', 'error')
    } finally {
      setSearchLoading(false)
    }
  }

  // Trigger Confirmation Dialog
  const openDownloadConfirm = (track: SearchResult) => {
    setDownloadConfirmTrack(track)
    setDownloadConfirmOpen(true)
  }

  // Confirm Download and Submit to backend/local Queue
  const handleConfirmDownload = async () => {
    if (!downloadConfirmTrack) return
    const track = downloadConfirmTrack
    const title = track.attributes.name
    const trackUrl = track.attributes.url

    setDownloadConfirmOpen(false)
    setDownloadConfirmTrack(null)

    pushToast('下载已提交', `任务已发送至后台排队：${title}`, 'info')

    // Append to log console
    const timeStr = new Date().toLocaleTimeString()
    setTerminalLogs(prev => [...prev, `[${timeStr}] [核心调度] 发送下载任务 -> url: ${trackUrl.slice(0, 45)}...`].slice(-25))

    // Submit to backend API
    try {
      await sbmtdwnld(trackUrl, codec, resolution, useWrapper, metadataRegion)
      // Trigger instant poll to show the new item
      setTimeout(fetchStatusAndHealth, 500)
    } catch (err) {
      console.error('Backend download submission failed:', err)
      pushToast('任务提交失败', `无法将 “${title}” 提交至后台：${gterrmsg(err) || err}`, 'error')
      const errTime = new Date().toLocaleTimeString()
      setTerminalLogs(prev => [...prev, `[${errTime}] [核心调度] 任务提交异常: ${gterrmsg(err) || '后端连接失败'}`].slice(-25))
    }
  }

  // Delete Error item from local list
  const deleteQueueItem = (id: string) => {
    setDownloadQueue((prev) => prev.filter((item) => item.id !== id))
    pushToast('清理成功', '已移除下载失败任务', 'info')
  }

  const handleDeleteHistoryGroup = useCallback(async (
    groupId: string,
    groupTitle: string,
    tracks: HistoryItem[]
  ) => {
    if (!tracks.length || deletingHistoryGroupId) return

    const promptText = tracks.length > 1
      ? `确定要删除专辑“${groupTitle}”及其 ${tracks.length} 首曲目吗？将同时尝试删除本地文件。`
      : `确定要删除“${groupTitle}”吗？将同时尝试删除本地文件。`

    if (!window.confirm(promptText)) return

    setDeletingHistoryGroupId(groupId)
    try {
      const results = await Promise.allSettled(
        tracks.map((track) => dlthstry(track.track_id, true))
      )
      const successCount = results.filter((item) => item.status === 'fulfilled').length
      const failedCount = results.length - successCount

      const refreshed = await gthstry()
      setDownloadHistory(refreshed)
      setOpenHistoryAlbums((prev) => ({ ...prev, [groupId]: false }))

      if (failedCount > 0) {
        pushToast('删除完成', `已删除 ${successCount} 首，失败 ${failedCount} 首`, 'info')
      } else {
        pushToast('删除完成', `已删除 ${successCount} 首曲目`, 'success')
      }
    } catch (err) {
      console.error(err)
      pushToast('删除失败', gterrmsg(err) || '整专删除失败，请稍后重试', 'error')
    } finally {
      setDeletingHistoryGroupId((current) => (current === groupId ? null : current))
    }
  }, [deletingHistoryGroupId, pushToast])

  const loadLocalLyricsForTrack = useCallback(async (trackId: string) => {
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

  const startLocalPlayback = useCallback((
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
      addLocalTrackToPlaylist(trackId, metadata, true)
    }

    setPlayingTrack(fakeTrack)
    setLyricIndex(0)
    setPlaybackTime(0)
    setPlaybackDuration(0)
    setLyricsSource('none')
    loadLocalLyricsForTrack(trackId).catch(() => undefined)

    audioRef.current.pause()
    audioRef.current.src = localUrl
    audioRef.current.load()
    audioRef.current.play()
      .then(() => {
        setIsPlaying(true)
        if (notify) {
          pushToast('正在播放', `正在播放本地文件：${metadata.artistName} - ${metadata.name}`, 'success')
        }
      })
      .catch((err) => {
        console.error('Local audio play failed:', err)
        pushToast('播放失败', '本地音频加载失败，请确认文件存在且可访问', 'error')
      })
  }, [pushToast, loadLocalLyricsForTrack, addLocalTrackToPlaylist])

  // Play local downloaded audio
  const playLocalTrack = (item: QueueItem) => {
    const trackId = item.trackId || item.id
    if (!trackId || trackId === 'Unknown') {
      pushToast('播放失败', '该下载项缺少曲目 ID，暂时无法本地播放', 'error')
      return
    }
    const trackName = item.trackName || item.title
    const artistName = item.artistName || '未知艺术家'
    startLocalPlayback(trackId, { name: trackName, artistName, artworkUrl: item.cover }, true)
  }

  const playPlaylistEntryByKey = useCallback((playlistKey: string) => {
    const entry = playlistEntries.find((item) => item.key === playlistKey)
    if (!entry) return

    setCurrentPlaylistKey(entry.key)
    if (entry.source === 'local') {
      if (!entry.trackId) {
        pushToast('播放失败', '播放列表中的本地曲目缺少 track_id', 'error')
        return
      }
      startLocalPlayback(
        entry.trackId,
        { name: entry.title, artistName: entry.artistName, artworkUrl: entry.artworkUrl },
        false,
        false
      )
      return
    }

    if (!entry.previewUrl) {
      pushToast('播放失败', '播放列表中的试听链接不可用', 'error')
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
    playTrackPreview(previewTrack, { syncPlaylist: false })
  }, [playlistEntries, pushToast, startLocalPlayback, playTrackPreview])

  const removePlaylistEntry = useCallback((playlistKey: string) => {
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

  const clearPlaylistEntries = useCallback(() => {
    setPlaylistEntries([])
    setCurrentPlaylistKey('')
    pushToast('播放列表', '已清空当前播放列表', 'info')
  }, [pushToast])

  const handleAddQueueItemToPlaylist = useCallback((item: QueueItem) => {
    const trackId = item.trackId || item.id
    if (!trackId || trackId === 'Unknown') {
      pushToast('添加失败', '该本地曲目缺少 track_id，无法加入播放列表', 'error')
      return
    }

    const trackName = item.trackName || item.title
    const artistName = item.artistName || '未知艺术家'
    addLocalTrackToPlaylist(trackId, { name: trackName, artistName, artworkUrl: item.cover }, false)
    pushToast('已添加', `已加入播放列表：${trackName}`, 'success')
  }, [addLocalTrackToPlaylist, pushToast])

  const handleAddHistoryTrackToPlaylist = useCallback((track: HistoryItem) => {
    addLocalTrackToPlaylist(
      track.track_id,
      {
        name: track.name,
        artistName: track.artist_name || '未知艺术家',
        artworkUrl: track.artwork_url || gtlclart(track.track_id),
      },
      false
    )
    pushToast('已添加', `已加入播放列表：${track.name}`, 'success')
  }, [addLocalTrackToPlaylist, pushToast])

  // Save cookies action
  const triggerSaveCookies = async () => {
    if (!cookieText.trim()) return
    setCookieSaving(true)
    try {
      const res = await svcks(cookieText)
      if (res.success) {
        pushToast('授权成功', 'Cookies 配置更新并重载成功！', 'success')
        setCookieText('')
        fetchStatusAndHealth()
        
        const timeStr = new Date().toLocaleTimeString()
        setTerminalLogs(prev => [...prev, `[${timeStr}] [授权系统] Cookies 文件加载成功，重置曲库连接。`].slice(-25))
      } else {
        pushToast('解析失败', res.message || '格式解析异常，请检查 Cookies txt', 'error')
      }
    } catch (err) {
      console.error(err)
      pushToast('文件写入失败', gterrmsg(err) || '无法写入 cookies.txt', 'error')
    } finally {
      setCookieSaving(false)
    }
  }

  // Scan local download folder and backfill DB history
  const triggerLocalScan = async () => {
    if (scanningLocal) return
    setScanningLocal(true)
    try {
      const res = await scnlcl()
      const summary = `扫描 ${res.scanned_files} 首，新增 ${res.inserted}，更新 ${res.updated}，跳过 ${res.skipped}，失败 ${res.failed}`
      pushToast('扫描完成', summary, res.failed > 0 ? 'info' : 'success')
      gthstry().then((rows) => setDownloadHistory(rows)).catch(console.error)
    } catch (err) {
      console.error(err)
      pushToast('扫描失败', gterrmsg(err) || '无法扫描本地曲库', 'error')
    } finally {
      setScanningLocal(false)
    }
  }

  // Search recommendation click helper
  const handleRecommendationClick = (keyword: string) => {
    setSearchKeyword(keyword)
    // Run search in next tick after state updates
    setTimeout(() => {
      const btn = document.getElementById('search-btn')
      if (btn) btn.click()
    }, 50)
  }

  // Filter result logic
  const filteredSearchResults = searchResults.filter((item) => {
    if (filterType.all) return true
    if (filterType.song && item.type === 'songs') return true
    if (filterType.album && item.type === 'albums') return true
    if (filterType.artist && item.type === 'artists') return true
    if (filterType.mv && item.type === 'music-videos') return true
    return false
  })

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
      const artistName = (item.artist_name || '未知艺人').trim()
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

  // Handle recommendation tag toggle logic
  const handleFilterChange = (key: 'all' | 'song' | 'album' | 'artist' | 'mv', checked: boolean) => {
    if (key === 'all') {
      setFilterType({ all: true, song: false, album: false, artist: false, mv: false })
    } else {
      setFilterType((prev) => {
        const next = { ...prev, all: false, [key]: checked }
        // If all sub-filters are unchecked, default back to all
        if (!next.song && !next.album && !next.artist && !next.mv) {
          next.all = true
        }
        return next
      })
    }
  }

  // Calculate downloading badge count
  const downloadingCount = downloadQueue.filter((d) => d.status === 'downloading').length

  // Accordion toggle helper
  const toggleAccordion = (key: string) => {
    setAccordionOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const displayLyricsLines = (() => {
    if (lyricsSource === 'preview') return MOCK_LYRICS
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
    addLocalTrackToPlaylist,
    addPlaylistEntry,
    addSearchTrackToPlaylist,
    buildPreviewPlaylistEntry,
    checkInitAgreementScroll,
    clearPlaylistEntries,
    codec,
    cookieSaving,
    cookieText,
    currentPlaylistKey,
    deleteQueueItem,
    deletingHistoryGroupId,
    disclaimerLang,
    dismissInitGuide,
    displayLyricsLines,
    downloadConfirmOpen,
    downloadConfirmTrack,
    downloadHistory,
    downloadQueue,
    downloaderInitialized,
    downloadingCount,
    fetchStatusAndHealth,
    filterType,
    filteredSearchResults,
    handleAddHistoryTrackToPlaylist,
    handleAddQueueItemToPlaylist,
    handleCloseWrapperSetupDialog,
    handleCloseWslInstallDialog,
    handleConfirmDownload,
    handleConfirmInstallWsl2,
    handleConfirmStartWrapperSetup,
    handleDeleteHistoryGroup,
    handleDisagreeAndExit,
    handleFilterChange,
    handleInitCookieLogin,
    handleInitEnterSoftware,
    handleNext,
    handleOpenInitGuideFromSettings,
    handlePlayPause,
    handlePrev,
    handleProgressChange,
    handleRecommendationClick,
    handleRestartWrapperSetup,
    handleSubmitWrapperInput,
    handleVolumeChange,
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
    loadLocalLyricsForTrack,
    lyricCenterOffset,
    lyricIndex,
    lyricLineHeight,
    lyricTrackOffset,
    lyricsOpen,
    lyricsSource,
    lyricsStageHeight,
    metadataRegion,
    mode,
    onAudioEnded,
    onAudioLoadedMetadata,
    onAudioTimeUpdate,
    openAlbums,
    openDownloadConfirm,
    openExternalLink,
    openHistoryAlbums,
    openWrapperSetupDialog,
    openWslInstallDialog,
    plainLyrics,
    playLocalTrack,
    playPlaylistEntryByKey,
    playTrackPreview,
    playbackDuration,
    playbackTime,
    playingTrack,
    playlistEntries,
    playlistOpen,
    pushToast,
    recommendations,
    removePlaylistEntry,
    removeToast,
    repositoryUrl,
    resolution,
    resolveAdjacentPlaylistKey,
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
    setFilterType,
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
    startLocalPlayback,
    stopWrapperSetupPolling,
    stopWslInstallPolling,
    syncWrapperSetupStatus,
    syncWslInstallStatus,
    terminalLogs,
    timedLyrics,
    toasts,
    toggleAccordion,
    toggleMode,
    toggleMute,
    transcodeAacToAacStandard,
    transcodeAacToMp3_320,
    transcodeAacToMp4,
    transcodeAlacToFlac,
    transcodeAlacToMp4,
    transcodeAlacToWav,
    triggerLocalScan,
    triggerSaveCookies,
    triggerSearch,
    triggerWrapperSetup,
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
    setAudioEl,
    setLyricsStageEl,
    setInitScrollEl,
    setLogsEndEl,
    wslInstallStatusData,
  }
}

export type AppStore = ReturnType<typeof useAppStore>
