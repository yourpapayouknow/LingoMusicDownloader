import { useCallback, useEffect, useRef, useState } from 'react'
import logoImage from './assets/lingomusiclogo.png'
import './app.css'
import { useTheme } from './theme/ThemeProvider'
import {
  Box,
  Divider,
  Grid,
  Heading,
  HStack,
  Icon,
  Image,
  ScrollView,
  Text,
  VStack,
} from './ui/primitives'
import {
  Badge,
  BottomBar,
  Button,
  Card,
  Dialog,
  IconButton,
  Spinner,
  TextArea,
  TextField,
  ToastViewport,
  Toggle,
  Menu,
  Chip,
  Segmented,
  Checkbox,
  type ToastItem,
  type ToastTone,
} from './ui/components'
import {
  searchAppleMusic,
  submitDownload,
  getStatus,
  getHealth,
  saveCookies,
  finalizeCookieLogin,
  getWsl2InstallPrecheckApi,
  startWsl2InstallApi,
  getWsl2InstallStatusApi,
  getWrapperSetupPrecheckApi,
  startWrapperSetupApi,
  getWrapperSetupStatusApi,
  submitWrapperSetupInputApi,
  type SearchResult,
  type HealthStatus,
  type Wsl2InstallPrecheckResponse,
  type Wsl2InstallStatusResponse,
  type WrapperSetupPrecheckResponse,
  type WrapperSetupStatusResponse,
  getSettingsApi, saveSettingsApi, getHistoryApi, deleteHistoryApi, getRecommendationsApi, reportSearchApi, getLocalPlayUrl, getLocalArtworkUrl, getLocalLyricsApi, openFolderApi, openConvertedFolderApi, scanLocalApi, type HistoryItem} from './utils/api'
import { minimizeWindow, maximizeWindow, closeWindow, isTauri, openAppleMusicLoginWindow, probeAppleMusicLoginWindowCookies } from './utils/tauri'

// Settings keys
const SETTINGS_KEY_CODEC = 'lingomusic-codec'
const SETTINGS_KEY_RESOLUTION = 'lingomusic-resolution'
const SETTINGS_KEY_USE_WRAPPER = 'lingomusic-use-wrapper'
const SETTINGS_KEY_VOLUME = 'lingomusic-volume'
const SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320 = 'lingomusic-transcode-aac-to-mp3-320'
const SETTINGS_KEY_TRANSCODE_AAC_TO_MP4 = 'lingomusic-transcode-aac-to-mp4'
const SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD = 'lingomusic-transcode-aac-to-aac-standard'
const SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC = 'lingomusic-transcode-alac-to-flac'
const SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV = 'lingomusic-transcode-alac-to-wav'
const SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4 = 'lingomusic-transcode-alac-to-mp4'

// Onboarding guide (frontend-only phase)
const FORCE_SHOW_INIT_GUIDE = true

const INIT_AGREEMENT_PARAGRAPHS = [
  '欢迎使用 LingoMusicDownloader。本软件用于个人学习与技术研究，不构成任何商业服务或平台义务承诺。',
  '在继续使用前，请您完整阅读并理解本协议、免责声明和风险提示。点击“同意并下一页”即视为您已确认并接受全部条款。',
  '1. 合法合规使用：您承诺仅在法律法规允许的范围内使用本软件，不得用于盗版传播、非法牟利、批量侵权分发等行为。',
  '2. 账号与凭据责任：您自行提供并管理账号登录信息、Cookies 与相关认证信息。因凭据泄露、过期、共享导致的风险由您自行承担。',
  '3. 版权与内容权属：通过本软件检索或下载的音视频、封面、歌词等内容，其著作权及相关权利归原权利人所有。',
  '4. 删除与留存义务：若您所在地区法律、平台条款或权利人要求限制留存，您应及时删除相关内容，并承担相应责任。',
  '5. 服务可用性声明：本软件依赖第三方网络环境、系统组件与接口能力，可能出现中断、波动、失效或兼容性问题。',
  '6. 风险提示：使用过程中可能出现账号风控、访问受限、授权失效、下载失败、系统资源占用等情况，请您自行评估并接受风险。',
  '7. 组件安装声明：启用高级能力可能需要安装 WSL2 与 Wrapper 服务。该步骤可能占用磁盘空间并涉及额外登录流程。',
  '8. 数据与隐私：本软件不会主动上传您的本地媒体文件，但您应知悉系统日志、缓存与临时文件可能在本地留存。',
  '9. 免责边界：开发者对因使用本软件导致的任何直接或间接损失（含账号、版权、业务、设备损失）不承担赔偿责任。',
  '10. 用户独立责任：您理解并同意，所有下载、播放、转码、分享等操作均由您独立决定并承担全部法律后果。',
  '11. 第三方条款优先：当平台服务条款、地区法规与本协议存在冲突时，以更严格的条款与适用法律为准。',
  '12. 协议更新：本协议可能随版本调整而更新。继续使用新版本功能即视为接受更新后的条款。',
  '若您不同意上述任何条款，请点击“不同意并退出”立即停止使用本软件。'
]

// Helper to format track artwork URL
function getArtworkUrl(url?: string, size = 150): string {
  if (!url) return 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150'
  return url.replace('{w}', String(size)).replace('{h}', String(size))
}

// Format duration/current time
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function normalizeCodecLabel(rawCodec?: string): string {
  const value = (rawCodec || '').trim().toLowerCase()
  if (!value) return 'aac'
  if (value.includes('alac')) return 'alac'
  if (value.includes('atmos') || value.includes('dolby') || value === 'ec-3' || value === 'eac3' || value === 'ac-3' || value === 'ac3') return 'dolby'
  if (value.includes('aac') || value.includes('mp4a')) return 'aac'
  return value
}

function getParentPath(path?: string): string {
  if (!path) return ''
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (index <= 0) return path
  return path.slice(0, index)
}

type LrcLine = {
  time: number
  text: string
}

function parseLrcContent(content: string): { timed: LrcLine[]; plain: string[] } {
  const timed: LrcLine[] = []
  const plain: string[] = []
  const timeTagRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g

  const lines = content.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const tags = Array.from(line.matchAll(timeTagRegex))
    const lyricText = line.replace(timeTagRegex, '').trim()

    if (tags.length > 0) {
      for (const match of tags) {
        const minutes = Number(match[1] || 0)
        const seconds = Number(match[2] || 0)
        const fractionRaw = match[3] || '0'
        let fraction = 0
        if (fractionRaw.length === 3) fraction = Number(fractionRaw) / 1000
        else if (fractionRaw.length === 2) fraction = Number(fractionRaw) / 100
        else if (fractionRaw.length === 1) fraction = Number(fractionRaw) / 10

        timed.push({
          time: minutes * 60 + seconds + fraction,
          text: lyricText || '...'
        })
      }
    } else if (!line.startsWith('[')) {
      plain.push(line)
    }
  }

  timed.sort((a, b) => a.time - b.time)
  return { timed, plain }
}

const mockLyrics = [
  '开启无损高品质音乐新时代',
  '立体空间音频与环绕声学技术',
  '母带级超高解析度本地无损下载',
  '歌词与唱片集封面全自动完美嵌入',
  '正在试听当前单曲的 30 秒高品质预览音轨',
  '点击右侧下载按钮即可保存完整版至本地',
  '请在“设置”页中粘贴您的账户授权 Cookies',
  '确保网络以及解密辅助代理端口连接正常',
  '感谢使用 LingoMusicDownloader！',
  'Enjoy the music journey...'
]

const RESULT_TYPE_LABEL_MAP: Record<string, string> = {
  songs: '曲目',
  albums: '专辑',
  artists: '歌手',
  'music-videos': 'mv',
}

const RESULT_CATEGORY_ORDER = ['songs', 'albums', 'artists', 'music-videos']

function getResultTypeLabel(type: string): string {
  return RESULT_TYPE_LABEL_MAP[type] || '其他'
}

function buildSearchResultList(results: Record<string, { data: SearchResult[] }>): SearchResult[] {
  const ordered: SearchResult[] = []
  const seen = new Set<string>()
  const known = new Set(RESULT_CATEGORY_ORDER)

  const pushList = (items: SearchResult[]) => {
    for (const item of items) {
      const key = `${item.type}:${item.id}`
      if (!seen.has(key)) {
        seen.add(key)
        ordered.push(item)
      }
    }
  }

  for (const category of RESULT_CATEGORY_ORDER) {
    pushList(results[category]?.data || [])
  }

  for (const [category, bucket] of Object.entries(results)) {
    if (known.has(category)) continue
    pushList(bucket?.data || [])
  }

  return ordered
}

interface QueueItem {
  id: string
  title: string
  cover: string
  quality: string
  status: 'completed' | 'downloading' | 'error'
  type: 'track' | 'album' | 'mv'
  trackId?: string
  trackName?: string
  artistName?: string
  albumName?: string
  tracks?: Array<{
    trackId: string
    name: string
    artistName?: string
    file_path?: string
    cover?: string
    status: 'pending' | 'downloading' | 'completed' | 'error'
    error?: string
  }>
  sourceUrl?: string
  errorDetails?: string
  file_path?: string
}

interface PlaylistEntry {
  key: string
  source: 'preview' | 'local'
  title: string
  artistName: string
  artworkUrl: string
  previewUrl?: string
  trackId?: string
  searchTrackId?: string
}

export default function App() {
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
  const [initGuideOpen, setInitGuideOpen] = useState(FORCE_SHOW_INIT_GUIDE)
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
  const lyricsStageRef = useRef<HTMLDivElement | null>(null)
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
    } catch (error) {
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
    if (isTauri()) {
      closeWindow()
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

    const stopProbe = () => {
      if (probeTimer !== null) {
        window.clearInterval(probeTimer)
        probeTimer = null
      }
    }

    const finalizeAfterWindowClosed = async () => {
      if (finalized) return
      finalized = true
      stopProbe()
      loginFinalizeRef.current = null
      loginWindowSessionRef.current = null

      // Wait briefly for WebView2 to flush/release cookie DB handles.
      await new Promise((resolve) => window.setTimeout(resolve, 900))
      try {
        let result: { success: boolean; message: string; cookies_count: number }
        const content = liveCookieContent.trim()
        if (content) {
          const saveResult = await saveCookies(content)
          result = {
            success: Boolean(saveResult.success),
            message: saveResult.message || 'Cookies 已保存并完成初始化',
            cookies_count: liveCookieCount || content.split('\n').filter((line) => line.trim() && !line.startsWith('#')).length,
          }
        } else {
          const finalizedResult = await finalizeCookieLogin({
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
          const [statusData, health] = await Promise.all([getStatus(), getHealth()])
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
      } catch (err: any) {
        console.error(err)
        pushToast('登录校验失败', err.message || '无法导出登录 Cookies', 'error')
      } finally {
        setInitCookieLoggingIn(false)
      }
    }

    const probeLoginState = async () => {
      if (finalized || probeInFlight || !loginWindowSession) return
      probeInFlight = true
      try {
        const probe = await probeAppleMusicLoginWindowCookies(loginWindowSession.label)
        if (probe.loginDetected && probe.cookiesContent?.trim()) {
          liveCookieContent = probe.cookiesContent
          liveCookieCount = probe.cookiesCount || liveCookieCount
          pushToast('检测到登录', '已识别 Apple 登录态，正在自动关闭窗口并完成校验...', 'success')
          try {
            await loginWindowSession?.close()
            window.setTimeout(() => {
              void finalizeAfterWindowClosed()
            }, 1200)
          } catch (e) {
            console.warn('Auto close login window failed, fallback to finalize', e)
            void finalizeAfterWindowClosed()
          }
        }
      } catch (e) {
        // Keep silent during probing; login may still be in progress.
      } finally {
        probeInFlight = false
      }
    }

    if (!isTauri()) {
      window.open('https://music.apple.com/cn/new', '_blank', 'noopener,noreferrer')
      pushToast('已打开网页', '请完成登录后手动导出 Cookies（当前为浏览器模式）', 'info')
      return
    }

    setInitCookieLoggingIn(true)
    try {
      loginWindowSession = await openAppleMusicLoginWindow({
        dataDirectory: 'apple-music-login',
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
      }, 2200)
      void probeLoginState()
    } catch (err: any) {
      console.error(err)
      finalized = true
      stopProbe()
      loginFinalizeRef.current = null
      loginWindowSessionRef.current = null
      setInitCookieLoggingIn(false)
      pushToast('启动失败', err.message || '无法打开 Apple Music 登录窗口', 'error')
    }
  }, [initCookieLoggingIn, pushToast])

  const handleInitEnterSoftware = useCallback(() => {
    if (!initWrapperConfigured) {
      setInitEnterConfirmOpen(true)
      return
    }
    setInitGuideOpen(false)
  }, [initWrapperConfigured])

  const handleOpenInitGuideFromSettings = useCallback(() => {
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
    const status = await getWsl2InstallStatusApi()
    setWslInstallStatusData(status)

    if (status.completed) {
      stopWslInstallPolling()
      setWslInstallLoading(false)

      if (!wslInstallCompletedNotifiedRef.current) {
        wslInstallCompletedNotifiedRef.current = true
        if (status.success_flag) {
          pushToast('安装完成', status.message || 'WSL2 安装与配置已完成', 'success')
          try {
            const [statusData, health] = await Promise.all([getStatus(), getHealth()])
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
        getWsl2InstallPrecheckApi(),
        getWsl2InstallStatusApi(),
      ])
      setWslInstallPrecheck(precheck)
      setWslInstallStatusData(status)

      if (status.running && !status.completed) {
        stopWslInstallPolling()
        wslInstallPollTimerRef.current = window.setInterval(() => {
          syncWslInstallStatus().catch(console.error)
        }, 1200)
      }
    } catch (err: any) {
      console.error(err)
      pushToast('检查失败', err.message || '无法获取WSL2安装状态', 'error')
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
      const startRes = await startWsl2InstallApi({ required_gb: 15 })
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
    } catch (err: any) {
      console.error(err)
      pushToast('启动失败', err.message || '无法启动 WSL2 安装流程', 'error')
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
    const status = await getWrapperSetupStatusApi()
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
          pushToast('Wrapper已就绪', status.message || 'Wrapper正在运行', 'success')
          try {
            const [statusData, health] = await Promise.all([getStatus(), getHealth()])
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
        getWrapperSetupPrecheckApi(),
        getWrapperSetupStatusApi(),
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
    } catch (err: any) {
      console.error(err)
      pushToast('检查失败', err.message || '无法获取Wrapper状态', 'error')
    } finally {
      setWrapperSetupLoading(false)
    }
  }, [pushToast, stopWrapperSetupPolling, syncWrapperSetupStatus])

  const handleConfirmStartWrapperSetup = useCallback(async () => {
    if (wrapperSetupLoading) return
    setWrapperSetupLoading(true)
    wrapperSetupCompletedNotifiedRef.current = false

    try {
      const startRes = await startWrapperSetupApi()
      if (!startRes.success) {
        pushToast('无法启动', startRes.message || 'Wrapper启动前检查未通过', 'error')
        setWrapperSetupLoading(false)
        return
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
    } catch (err: any) {
      console.error(err)
      pushToast('启动失败', err.message || '无法启动Wrapper流程', 'error')
      setWrapperSetupLoading(false)
    }
  }, [wrapperSetupLoading, pushToast, stopWrapperSetupPolling, syncWrapperSetupStatus])

  const handleRestartWrapperSetup = useCallback(async () => {
    if (wrapperSetupLoading) return
    setWrapperSetupLoading(true)
    wrapperSetupCompletedNotifiedRef.current = false

    try {
      const startRes = await startWrapperSetupApi({ force_restart: true })
      if (!startRes.success) {
        pushToast('无法重启', startRes.message || 'Wrapper重启前检查未通过', 'error')
        setWrapperSetupLoading(false)
        return
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
    } catch (err: any) {
      console.error(err)
      pushToast('重启失败', err.message || '无法重启Wrapper流程', 'error')
      setWrapperSetupLoading(false)
    }
  }, [wrapperSetupLoading, pushToast, stopWrapperSetupPolling, syncWrapperSetupStatus])

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

        const res = await submitWrapperSetupInputApi({
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

        const res = await submitWrapperSetupInputApi({
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
    } catch (err: any) {
      console.error(err)
      pushToast('提交失败', err.message || '无法提交Wrapper输入', 'error')
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
    const previewUrl = (track.attributes as any).previews?.[0]?.url as string | undefined
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
    saveSettingsApi({
      [SETTINGS_KEY_CODEC]: codec,
      [SETTINGS_KEY_RESOLUTION]: resolution,
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
      const statusData = await getStatus()
      setDownloaderInitialized(statusData.is_initialized)

      const health = await getHealth()
      setHealthStatus(health)

      // Sync active downloading queue from backend
      if (statusData.downloads) {
        const activeQueue: QueueItem[] = []
        Object.entries(statusData.downloads).forEach(([url, item]: [string, any]) => {
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
          }> = rawItems.map((child: any, idx: number) => ({
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
          const cover = getArtworkUrl(firstMediaItem?.artworkUrl, 150)

          let displayTitle = `任务 (${firstMediaItem?.trackId || 'Unknown'})`
          if (isAlbumTask) {
            displayTitle = albumName || trackName || `专辑任务（${children.length} 首）`
          } else if (trackName) {
            displayTitle = artistName ? `${artistName} - ${trackName}` : trackName
          }

          const qualityStr = isAlbumTask ? '专辑' : (isMvTask ? 'mv' : normalizeCodecLabel(item.codec))
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
              cover: child.artworkUrl ? getArtworkUrl(child.artworkUrl, 96) : cover,
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
    getSettingsApi().then(settings => {
      if (settings[SETTINGS_KEY_CODEC]) setCodec(settings[SETTINGS_KEY_CODEC])
      if (settings[SETTINGS_KEY_RESOLUTION]) setResolution(settings[SETTINGS_KEY_RESOLUTION])
      if (settings[SETTINGS_KEY_USE_WRAPPER] !== undefined) setUseWrapper(settings[SETTINGS_KEY_USE_WRAPPER] === 'true' || settings[SETTINGS_KEY_USE_WRAPPER] === true)
      if (settings[SETTINGS_KEY_VOLUME]) {
        const v = parseFloat(settings[SETTINGS_KEY_VOLUME])
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
      setSettingsLoaded(true)
    }).catch(err => {
      console.error(err)
      setSettingsLoaded(true)
    })

    // Fetch Recommendations
    getRecommendationsApi().then(res => setRecommendations(res.recommendations || [])).catch(console.error)
    
    // Fetch History
    getHistoryApi().then(res => {
      setDownloadHistory(res)
    }).catch(console.error)

    // Poll every 3 seconds
    const interval = setInterval(fetchStatusAndHealth, 3000)
    return () => clearInterval(interval)
  }, [fetchStatusAndHealth])

  // Preview lyrics timer animation
  useEffect(() => {
    if (!isPlaying || lyricsSource !== 'preview') return
    const interval = setInterval(() => {
      setLyricIndex((prev) => (prev + 1) % mockLyrics.length)
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
    const previewUrl = (track.attributes as any).previews?.[0]?.url
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
      const response = await searchAppleMusic(searchKeyword)
      reportSearchApi(searchKeyword).catch(console.error)
      let list: SearchResult[] = []

      if (response.success && response.results) {
        list = buildSearchResultList(response.results)
      }
      setSearchResults(list)
      if (list.length === 0) {
        setSearchError('曲库中未找到相关内容')
      }
      
      const timeStr = new Date().toLocaleTimeString()
      setTerminalLogs(prev => [...prev, `[${timeStr}] [搜索请求] 关键字: "${searchKeyword}"，检索出 ${list.length} 个结果`].slice(-25))
    } catch (err: any) {
      console.error(err)
      setSearchError(err.message || '搜索接口异常，请确认后端服务是否运行')
      pushToast('搜索失败', err.message || '调用代理搜索失败', 'error')
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
      await submitDownload(trackUrl, codec, resolution, useWrapper)
      // Trigger instant poll to show the new item
      setTimeout(fetchStatusAndHealth, 500)
    } catch (err: any) {
      console.error('Backend download submission failed:', err)
      pushToast('任务提交失败', `无法将 “${title}” 提交至后台：${err.message || err}`, 'error')
      const errTime = new Date().toLocaleTimeString()
      setTerminalLogs(prev => [...prev, `[${errTime}] [核心调度] 任务提交异常: ${err.message || '后端连接失败'}`].slice(-25))
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
        tracks.map((track) => deleteHistoryApi(track.track_id, true))
      )
      const successCount = results.filter((item) => item.status === 'fulfilled').length
      const failedCount = results.length - successCount

      const refreshed = await getHistoryApi()
      setDownloadHistory(refreshed)
      setOpenHistoryAlbums((prev) => ({ ...prev, [groupId]: false }))

      if (failedCount > 0) {
        pushToast('删除完成', `已删除 ${successCount} 首，失败 ${failedCount} 首`, 'info')
      } else {
        pushToast('删除完成', `已删除 ${successCount} 首曲目`, 'success')
      }
    } catch (err: any) {
      console.error(err)
      pushToast('删除失败', err.message || '整专删除失败，请稍后重试', 'error')
    } finally {
      setDeletingHistoryGroupId((current) => (current === groupId ? null : current))
    }
  }, [deletingHistoryGroupId, pushToast])

  const loadLocalLyricsForTrack = useCallback(async (trackId: string) => {
    try {
      const res = await getLocalLyricsApi(trackId)
      const parsed = parseLrcContent(res.content || '')
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

    const localUrl = getLocalPlayUrl(trackId)
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
      } as any
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
        artworkUrl: track.artwork_url || getLocalArtworkUrl(track.track_id),
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
      const res = await saveCookies(cookieText)
      if (res.success) {
        pushToast('授权成功', 'Cookies 配置更新并重载成功！', 'success')
        setCookieText('')
        fetchStatusAndHealth()
        
        const timeStr = new Date().toLocaleTimeString()
        setTerminalLogs(prev => [...prev, `[${timeStr}] [授权系统] Cookies 文件加载成功，重置曲库连接。`].slice(-25))
      } else {
        pushToast('解析失败', res.message || '格式解析异常，请检查 Cookies txt', 'error')
      }
    } catch (err: any) {
      console.error(err)
      pushToast('文件写入失败', err.message || '无法写入 cookies.txt', 'error')
    } finally {
      setCookieSaving(false)
    }
  }

  // Scan local download folder and backfill DB history
  const triggerLocalScan = async () => {
    if (scanningLocal) return
    setScanningLocal(true)
    try {
      const res = await scanLocalApi()
      const summary = `扫描 ${res.scanned_files} 首，新增 ${res.inserted}，更新 ${res.updated}，跳过 ${res.skipped}，失败 ${res.failed}`
      pushToast('扫描完成', summary, res.failed > 0 ? 'info' : 'success')
      getHistoryApi().then((rows) => setDownloadHistory(rows)).catch(console.error)
    } catch (err: any) {
      console.error(err)
      pushToast('扫描失败', err.message || '无法扫描本地曲库', 'error')
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
  }> = (() => {
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
          cover: item.artwork_url ? getArtworkUrl(item.artwork_url, 96) : logoImage,
          folderPath: getParentPath(item.file_path),
          tracks: []
        })
      }

      const group = groups.get(key)!
      group.tracks.push(item)
      if (!group.folderPath) {
        group.folderPath = getParentPath(item.file_path)
      }
      if ((group.cover === logoImage || !group.cover) && item.artwork_url) {
        group.cover = getArtworkUrl(item.artwork_url, 96)
      }
    }

    return Array.from(groups.values())
  })()

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
    if (lyricsSource === 'preview') return mockLyrics
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

  // Render method
  return (
    <div className="app-shell">
      {/* Hidden audio tag */}
      <audio
        ref={audioRef}
        onTimeUpdate={onAudioTimeUpdate}
        onLoadedMetadata={onAudioLoadedMetadata}
        onEnded={onAudioEnded}
      />

      {/* Header section with custom titlebar padding */}
      <header 
        className="ui-topbar" 
        style={{ 
          paddingBlock: '8px', 
          minHeight: '64px', 
          paddingRight: isTauri() ? '154px' : '20px' 
        }} 
        data-tauri-drag-region
      >
        {/* Left branding */}
        <HStack align="center" gap="compact" data-tauri-drag-region>
          <img src={logoImage} className="topbar-logo" alt="LingoMusic Logo" data-tauri-drag-region />
          <VStack gap={0} align="flex-start" data-tauri-drag-region>
            <Text weight={700} style={{ fontSize: '1.05rem', lineHeight: '1.2' }} data-tauri-drag-region>LingoMusic</Text>
            <Text tone="secondary" style={{ fontSize: '0.68rem' }} data-tauri-drag-region>Downloader</Text>
          </VStack>
        </HStack>

        {/* Center player */}
        <div className="am-player">
          <div className="am-controls">
            <button className="am-btn" onClick={handlePrev} title="上一首">
              <Icon name="prev" size={16} />
            </button>
            <button 
              className="am-btn" 
              onClick={handlePlayPause} 
              style={{ width: '36px', height: '36px' }} 
              title={isPlaying ? '暂停' : '试听预览'}
            >
              <Icon name={isPlaying ? 'pause' : 'play'} size={19} />
            </button>
            <button className="am-btn" onClick={handleNext} title="下一首">
              <Icon name="next" size={16} />
            </button>
          </div>

          <div className="am-display">
            <Image
              src={playingTrack ? getArtworkUrl(playingTrack.attributes.artwork?.url, 64) : logoImage}
              className="am-artwork"
              radius={4}
            />
            <div className="am-info-progress">
              <div className="am-info-text">
                {playingTrack ? (
                  <>
                    <span>{playingTrack.attributes.name}</span>
                    <span className="am-info-artist"> — {playingTrack.attributes.artistName}</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>暂无试听预览内容</span>
                )}
              </div>
              <span className="am-time am-time-remaining">
                {playbackDuration > 0
                  ? `-${formatTime(Math.max(0, playbackDuration - playbackTime))}`
                  : '-00:00'}
              </span>
            </div>
          </div>

          <div className="am-volume-wrapper">
            <button className="am-btn" onClick={toggleMute} title={isMuted ? '取消静音' : '静音'}>
              <Icon name={isMuted || volume === 0 ? 'volumeMute' : 'volume'} size={15} />
            </button>
            <input
              type="range"
              className="am-volume-slider"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              style={{
                '--track-bg': `linear-gradient(to right, var(--action-primary) 0%, var(--action-primary) ${
                  (isMuted ? 0 : volume) * 100
                }%, var(--component-wrapped-bg) ${
                  (isMuted ? 0 : volume) * 100
                }%, var(--component-wrapped-bg) 100%)`,
                '--thumb-bg': 'var(--action-primary)'
              } as React.CSSProperties}
            />
          </div>

          <div className="am-controls">
            <button
              className="am-btn"
              style={{ color: isShuffle ? 'var(--action-primary)' : 'inherit' }}
              onClick={() => setIsShuffle(!isShuffle)}
              title="随机试听"
            >
              <Icon name="shuffle" size={14} />
            </button>
            <button
              className="am-btn"
              style={{ color: isRepeat ? 'var(--action-primary)' : 'inherit' }}
              onClick={() => setIsRepeat(!isRepeat)}
              title="单曲循环"
            >
              <Icon name="repeat" size={14} />
            </button>
          </div>
          <div className="am-progress-edge-wrapper">
            <input
              type="range"
              className="am-progress-slider am-progress-edge-slider"
              min={0}
              max={playbackDuration || 30}
              value={playbackTime}
              onChange={handleProgressChange}
              style={{
                '--track-bg': playingTrack
                  ? `linear-gradient(to right, var(--action-primary) 0%, var(--action-primary) ${
                      (playbackTime / (playbackDuration || 30)) * 100
                    }%, color-mix(in srgb, var(--component-wrapped-bg) 62%, transparent) ${
                      (playbackTime / (playbackDuration || 30)) * 100
                    }%, color-mix(in srgb, var(--component-wrapped-bg) 62%, transparent) 100%)`
                  : 'color-mix(in srgb, var(--component-wrapped-bg) 62%, transparent)',
                '--thumb-bg': playingTrack ? 'var(--action-primary)' : 'var(--component-wrapped-bg)',
              } as React.CSSProperties}
            />
          </div>
        </div>

        {/* Right tools and window buttons */}
        <HStack align="center" gap="compact">
          <IconButton
            variant={lyricsOpen ? 'primary' : 'ghost'}
            size={36}
            onClick={() => {
              const next = !lyricsOpen
              setLyricsOpen(next)
              if (next) setPlaylistOpen(false)
            }}
            title="歌词"
          >
            <Icon name="lyrics" size={16} />
          </IconButton>
          <IconButton
            variant={playlistOpen ? 'primary' : 'ghost'}
            size={36}
            onClick={() => {
              const next = !playlistOpen
              setPlaylistOpen(next)
              if (next) setLyricsOpen(false)
            }}
            title={`播放列表 (${playlistEntries.length})`}
          >
            <Icon name="playlist" size={16} />
          </IconButton>
          <Toggle checked={mode === 'dark'} onChange={toggleMode} label={mode === 'dark' ? '深色' : '浅色'} />

          {isTauri() && (
            <div className="win-controls" style={{ position: 'absolute', right: 0, top: 0, bottom: 0 }}>
              <button className="win-btn" onClick={minimizeWindow} title="最小化">
                <Icon name="minimize" size={12} />
              </button>
              <button className="win-btn" onClick={maximizeWindow} title="最大化">
                <Icon name="maximize" size={12} />
              </button>
              <button className="win-btn win-btn-close" onClick={closeWindow} title="关闭">
                <Icon name="close" size={12} />
              </button>
            </div>
          )}
        </HStack>
      </header>

      {/* Lyrics panel */}
      {lyricsOpen && (
        <div className="lyrics-panel">
          <HStack justify="space-between" align="center" style={{ marginBottom: '12px' }}>
            <Text weight={700}>歌词同步显示</Text>
            <IconButton onClick={() => setLyricsOpen(false)} size={30}>
              <Icon name="close" size={14} />
            </IconButton>
          </HStack>
          <Divider />
          <div className="lyrics-content">
            {playingTrack ? (
              <VStack gap="normal" align="center" style={{ width: '100%' }}>
                <Text tone="secondary" style={{ fontSize: '0.88rem' }}>
                  {playingTrack.attributes.name} - {playingTrack.attributes.artistName}
                </Text>
                {(lyricsSource === 'local' || lyricsSource === 'preview') && displayLyricsLines.length > 0 && (
                  <div className="lyrics-stage" ref={lyricsStageRef}>
                    <div
                      className="lyrics-track"
                      style={{ transform: `translate3d(0, ${lyricTrackOffset}px, 0)` }}
                    >
                      {displayLyricsLines.map((line, index) => {
                        const distance = index - activeDisplayLyricIndex
                        const absDistance = Math.abs(distance)
                        const isCurrent = absDistance === 0
                        const lineOpacity = isCurrent
                          ? 1
                          : Math.max(0.08, 0.86 - (absDistance * 0.16))
                        const lineBlur = isCurrent
                          ? 0
                          : Math.min(5.2, absDistance * 1.18)
                        const lineScale = isCurrent
                          ? 1
                          : Math.max(0.88, 1 - (absDistance * 0.022))
                        const lineYOffset = isCurrent
                          ? 0
                          : Math.sign(distance) * Math.min(12, absDistance * 2.2)
                        return (
                          <div
                            key={`${index}-${line.slice(0, 12)}`}
                            className={`lyrics-line ${isCurrent ? 'is-current' : ''}`}
                            style={{
                              opacity: lineOpacity,
                              filter: `blur(${lineBlur}px)`,
                              transform: `translate3d(0, ${lineYOffset}px, 0) scale(${lineScale})`,
                            }}
                          >
                            <span>{line}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {(lyricsSource === 'local' || lyricsSource === 'preview') && displayLyricsLines.length === 0 && (
                  <VStack gap="compact" align="center">
                    <Text tone="secondary" style={{ fontSize: '0.9rem' }}>当前音轨暂无可显示歌词</Text>
                  </VStack>
                )}
                {lyricsSource === 'none' && (
                  <VStack gap="compact" align="center">
                    <Text tone="secondary" style={{ fontSize: '0.9rem' }}>未找到本地歌词文件（.lrc）</Text>
                  </VStack>
                )}
              </VStack>
            ) : (
              <VStack gap="normal" align="center">
                <Icon name="lyrics" size={42} style={{ color: 'var(--text-secondary)' }} />
                <Text tone="secondary" style={{ fontSize: '0.9rem' }}>暂无播放预览音轨</Text>
              </VStack>
            )}
          </div>
        </div>
      )}

      {/* Playlist panel */}
      {playlistOpen && (
        <div className="playlist-panel">
          <HStack justify="space-between" align="center" style={{ marginBottom: '12px' }}>
            <Text weight={700}>播放列表 ({playlistEntries.length})</Text>
            <HStack gap="compact" align="center">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPlaylistEntries}
                disabled={playlistEntries.length === 0}
              >
                清空列表
              </Button>
              <IconButton onClick={() => setPlaylistOpen(false)} size={30}>
                <Icon name="close" size={14} />
              </IconButton>
            </HStack>
          </HStack>
          <Divider />
          <div className="playlist-content">
            {playlistEntries.length === 0 ? (
              <VStack gap="normal" align="center" style={{ marginTop: '42px' }}>
                <Icon name="playlist" size={42} style={{ color: 'var(--text-secondary)' }} />
                <Text tone="secondary" style={{ fontSize: '0.9rem' }}>
                  还没有曲目，先播放或添加本地歌曲吧
                </Text>
              </VStack>
            ) : (
              <VStack gap="compact">
                {playlistEntries.map((entry, index) => {
                  const isCurrent = entry.key === currentPlaylistKey
                  return (
                    <Card
                      key={entry.key}
                      className={isCurrent ? 'playlist-item-card is-current' : 'playlist-item-card'}
                    >
                      <HStack justify="space-between" align="center" gap="normal">
                        <HStack align="center" gap="compact" style={{ minWidth: 0, flex: 1 }}>
                          <Image
                            src={entry.source === 'preview' ? getArtworkUrl(entry.artworkUrl, 96) : entry.artworkUrl}
                            alt={entry.title}
                            radius={6}
                            style={{ width: '44px', height: '44px', flexShrink: 0 }}
                          />
                          <VStack gap={2} style={{ minWidth: 0, flex: 1 }}>
                            <Text weight={700} style={{ fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {index + 1}. {entry.title}
                            </Text>
                            <HStack gap="compact" align="center">
                              <Text tone="secondary" style={{ fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {entry.artistName}
                              </Text>
                              <Badge tone={entry.source === 'local' ? 'success' : 'info'}>
                                {entry.source === 'local' ? '本地' : '试听'}
                              </Badge>
                              {isCurrent && <Badge tone="default">正在播放</Badge>}
                            </HStack>
                          </VStack>
                        </HStack>
                        <HStack gap="compact">
                          <IconButton
                            variant={isCurrent ? 'primary' : 'secondary'}
                            size={28}
                            onClick={() => playPlaylistEntryByKey(entry.key)}
                            title="播放"
                          >
                            <Icon name="play" size={12} />
                          </IconButton>
                          <IconButton
                            variant="ghost"
                            size={28}
                            onClick={() => removePlaylistEntry(entry.key)}
                            title="移出列表"
                          >
                            <Icon name="trash" size={12} style={{ color: 'var(--system-error)' }} />
                          </IconButton>
                        </HStack>
                      </HStack>
                    </Card>
                  )
                })}
              </VStack>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <ScrollView className="app-main" height="calc(100vh - 150px)">
        <VStack gap="loose" className="app-sections">
          
          {/* TAB 1: SEARCH PAGE */}
          {activeTab === 'search' && (
            <VStack gap="normal">
              {/* Search Block */}
              <Card>
                <VStack gap="compact">
                  <Heading level={3}>搜索曲库</Heading>
                  <HStack gap="compact" style={{ marginTop: '8px' }}>
                    <TextField
                      id="search-input"
                      style={{ flex: 1 }}
                      placeholder="输入关键词或曲目分享链接..."
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && triggerSearch()}
                      prefix={<Icon name="search" size={16} />}
                    />
                    <Button
                      id="search-btn"
                      onClick={triggerSearch}
                      disabled={searchLoading}
                      leadingIcon={searchLoading ? <Spinner size={14} /> : <Icon name="search" size={14} />}
                    >
                      {searchLoading ? '检索中...' : '搜索'}
                    </Button>
                  </HStack>

                  {/* Recommendation pill Tags */}
                  <HStack gap="compact" style={{ flexWrap: 'wrap', marginTop: '12px' }} align="center">
                    <Text tone="secondary" style={{ fontSize: '0.8rem' }}>常用搜索：</Text>
                    {(recommendations.length > 0 ? recommendations : searchRecommendations).map((rec) => (
                      <Chip key={rec} onClick={() => handleRecommendationClick(rec)}>
                        {rec}
                      </Chip>
                    ))}
                  </HStack>
                </VStack>
              </Card>

              {/* Filter Block */}
              <Card>
                <VStack gap="compact">
                  <Heading level={4}>筛选</Heading>
                  <HStack gap="normal" style={{ flexWrap: 'wrap', marginTop: '4px' }}>
                    <Checkbox
                      label="全部"
                      checked={filterType.all}
                      onChange={(e) => handleFilterChange('all', e.target.checked)}
                    />
                    <Checkbox
                      label="曲目"
                      checked={filterType.song}
                      onChange={(e) => handleFilterChange('song', e.target.checked)}
                    />
                    <Checkbox
                      label="专辑"
                      checked={filterType.album}
                      onChange={(e) => handleFilterChange('album', e.target.checked)}
                    />
                    <Checkbox
                      label="歌手"
                      checked={filterType.artist}
                      onChange={(e) => handleFilterChange('artist', e.target.checked)}
                    />
                    <Checkbox
                      label="MV"
                      checked={filterType.mv}
                      onChange={(e) => handleFilterChange('mv', e.target.checked)}
                    />
                  </HStack>
                </VStack>
              </Card>

              {/* Search Errors */}
              {searchError && (
                <Box surface border padding="normal" radius="container" style={{ borderColor: 'var(--system-error)' }}>
                  <HStack gap="compact" align="center">
                    <Icon name="alert" size={18} style={{ color: 'var(--system-error)' }} />
                    <Text tone="error" style={{ fontSize: '0.9rem' }}>{searchError}</Text>
                  </HStack>
                </Box>
              )}

              {/* Search Results Block */}
              {filteredSearchResults.length > 0 && (
                <VStack gap="compact">
                  <Heading level={4}>结果列表 ({filteredSearchResults.length})</Heading>
                  <Grid minItemWidth="290px" gap="normal">
                    {filteredSearchResults.map((item) => {
                      const isCurrentPlaying = playingTrack?.id === item.id
                      const hasPreview = !!(item.attributes as any).previews?.[0]?.url
                      const badgeText = getResultTypeLabel(item.type)
                      const secondaryText =
                        item.type === 'artists'
                          ? '艺术家'
                          : (item.attributes.artistName || '未知艺人')

                      return (
                        <Card key={item.id}>
                          <HStack gap="normal" align="center">
                            {/* Artwork Cover */}
                            <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                              <Image
                                src={getArtworkUrl(item.attributes.artwork?.url, 120)}
                                alt={item.attributes.name}
                                style={{ width: '56px', height: '56px' }}
                              />
                            </div>

                            {/* Details */}
                            <VStack gap={2} style={{ flex: 1, minWidth: 0 }}>
                              <Text weight={700} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.92rem' }}>
                                {item.attributes.name}
                              </Text>
                              <HStack gap="compact" align="center">
                                <Text tone="secondary" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                                  {secondaryText}
                                </Text>
                                <Badge tone={item.type === 'music-videos' ? 'info' : item.type === 'artists' ? 'success' : 'default'}>
                                  {badgeText}
                                </Badge>
                              </HStack>
                            </VStack>

                            {/* Buttons */}
                            <HStack gap="compact" align="center">
                              {hasPreview && (
                                <IconButton
                                  variant={isCurrentPlaying && isPlaying ? 'primary' : 'ghost'}
                                  size={30}
                                  onClick={() => playTrackPreview(item)}
                                  title="试听"
                                >
                                  <Icon name={isCurrentPlaying && isPlaying ? 'pause' : 'play'} size={14} />
                                </IconButton>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                leadingIcon={<Icon name="download" size={13} />}
                                onClick={() => openDownloadConfirm(item)}
                              >
                                下载
                              </Button>
                            </HStack>
                          </HStack>
                        </Card>
                      )
                    })}
                  </Grid>
                </VStack>
              )}
            </VStack>
          )}

          {/* TAB 2: DOWNLOADS VIEW */}
          {activeTab === 'download' && (
            <VStack gap="normal">
              {/* Header Folder Trigger Button */}
              <HStack justify="flex-start" gap="compact">
                <Button
                  variant="secondary"
                  leadingIcon={<Icon name="folder" size={15} />}
                  onClick={() => {
                    openFolderApi().catch((err) => pushToast('打开目录失败', err.message || '无法打开目录', 'error'))
                  }}
                >
                  打开下载文件夹
                </Button>
                <Button
                  variant="secondary"
                  leadingIcon={<Icon name="search" size={15} />}
                  onClick={triggerLocalScan}
                  disabled={scanningLocal}
                >
                  {scanningLocal ? '扫描中...' : '扫描歌曲'}
                </Button>
                <Button
                  variant="secondary"
                  leadingIcon={<Icon name="folder" size={15} />}
                  onClick={() => {
                    openConvertedFolderApi().catch((err) => pushToast('打开目录失败', err.message || '无法打开转换目录', 'error'))
                  }}
                >
                  打开转换文件夹
                </Button>
              </HStack>

              <VStack gap="compact">
                <Heading level={3}>任务列表</Heading>
                {downloadQueue.length === 0 ? (
                  <Card style={{ paddingBlock: '32px' }}>
                    <VStack align="center" gap="normal">
                      <Icon name="download" size={24} style={{ color: 'var(--text-secondary)' }} />
                      <Text tone="secondary">下载列表为空，快前往搜索页面搜索吧！</Text>
                    </VStack>
                  </Card>
                ) : (
                  <VStack gap="compact">
                    {downloadQueue.map((item) => {
                      const isCompleted = item.status === 'completed'
                      const isErr = item.status === 'error'
                      const isDownloading = item.status === 'downloading'
                      const isAlbum = item.type === 'album'
                      const isAlbumOpen = openAlbums[item.id]

                      return (
                        <Card key={item.id} style={{ borderLeft: isErr ? '4px solid var(--system-error)' : undefined }}>
                          <VStack gap="compact">
                            <HStack justify="space-between" align="center">
                              {/* Left side Cover and title */}
                              <HStack gap="normal" align="center" style={{ minWidth: 0, flex: 1 }}>
                                <Image
                                  src={item.cover}
                                  alt={item.title}
                                  radius={6}
                                  style={{ width: '48px', height: '48px', flexShrink: 0 }}
                                />
                                <VStack gap={2} style={{ minWidth: 0 }}>
                                  <Text weight={700} style={{ fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.title}
                                  </Text>
                                  <HStack gap="compact" align="center">
                                    <Text tone="secondary" style={{ fontSize: '0.76rem' }}>
                                      {isAlbum
                                        ? `专辑曲目: ${item.tracks?.length || 0} 首`
                                        : `曲目ID: ${item.trackId || item.id}`}
                                    </Text>
                                    <Badge tone={isCompleted ? 'success' : isErr ? 'error' : 'info'}>
                                      {item.quality}
                                    </Badge>
                                  </HStack>
                                </VStack>
                              </HStack>

                              {/* Right side operations */}
                              <HStack gap="compact" align="center">
                                {isDownloading && (
                                  <HStack gap="compact" align="center">
                                    <Spinner size={16} />
                                    <Text tone="secondary" style={{ fontSize: '0.8rem' }}>正在下...</Text>
                                  </HStack>
                                )}

                                {isErr && (
                                  <HStack gap="compact" align="center">
                                    <Icon name="alert" size={16} style={{ color: 'var(--system-error)' }} />
                                    <IconButton
                                      variant="ghost"
                                      size={32}
                                      onClick={() => deleteQueueItem(item.id)}
                                      title="删除任务"
                                    >
                                      <Icon name="trash" size={15} style={{ color: 'var(--system-error)' }} />
                                    </IconButton>
                                  </HStack>
                                )}

                                {isCompleted && (
                                  <HStack gap="compact">
                                    {isAlbum && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        trailingIcon={<Icon name="chevronDown" size={12} style={{ transform: isAlbumOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                                        onClick={() => setOpenAlbums(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                      >
                                        {isAlbumOpen ? '收起曲目' : '查看曲目'}
                                      </Button>
                                    )}
                                    <IconButton
                                      variant="ghost"
                                      size={32}
                                      onClick={() => {
                                        openFolderApi(item.file_path).catch((err) => pushToast('定位失败', err.message || '无法定位本地文件', 'error'))
                                      }}
                                      title="定位文件"
                                    >
                                      <Icon name="folder" size={14} />
                                    </IconButton>
                                    {item.type === 'track' && (
                                      <>
                                        <IconButton
                                          variant="secondary"
                                          size={32}
                                          onClick={() => playLocalTrack(item)}
                                          title="播放"
                                        >
                                          <Icon name="play" size={14} />
                                        </IconButton>
                                        <IconButton
                                          variant="ghost"
                                          size={32}
                                          onClick={() => handleAddQueueItemToPlaylist(item)}
                                          title="添加到播放列表"
                                        >
                                          <Icon name="plus" size={14} />
                                        </IconButton>
                                      </>
                                    )}
                                  </HStack>
                                )}
                              </HStack>
                            </HStack>

                            {/* Album Subtracks list */}
                            {isAlbum && isAlbumOpen && item.tracks && (
                              <div className="album-subtracks">
                                {item.tracks.map((track, i) => (
                                  <div key={track.trackId || `${item.id}-${i}`} className="album-subtrack-item">
                                    <HStack justify="space-between" align="center">
                                      <Text style={{ fontSize: '0.84rem' }}>
                                        {i + 1}. {track.artistName ? `${track.artistName} - ` : ''}{track.name}
                                      </Text>
                                      <HStack gap="compact">
                                        <Badge tone={track.status === 'error' ? 'error' : track.status === 'completed' ? 'success' : 'info'}>
                                          {track.status === 'error' ? '失败' : track.status === 'completed' ? '已下载' : '下载中'}
                                        </Badge>
                                        <IconButton
                                          variant="ghost"
                                          size={26}
                                          onClick={() => {
                                            openFolderApi(track.file_path || item.file_path).catch((err) => pushToast('定位失败', err.message || '无法定位本地文件', 'error'))
                                          }}
                                          title="定位文件"
                                        >
                                          <Icon name="folder" size={11} />
                                        </IconButton>
                                        <IconButton
                                          variant="ghost"
                                          size={26}
                                          onClick={() => {
                                            const subTrackItem: QueueItem = {
                                              id: track.trackId || `${item.id}-${i}`,
                                              title: track.artistName ? `${track.artistName} - ${track.name}` : track.name,
                                              cover: track.cover || item.cover,
                                              quality: normalizeCodecLabel(item.quality),
                                              status: 'completed',
                                              type: 'track',
                                              trackId: track.trackId,
                                              trackName: track.name,
                                              artistName: track.artistName,
                                              file_path: track.file_path || item.file_path,
                                            }
                                            playLocalTrack(subTrackItem)
                                          }}
                                          title="播放单曲"
                                          disabled={track.status !== 'completed'}
                                        >
                                          <Icon name="play" size={11} />
                                        </IconButton>
                                        <IconButton
                                          variant="ghost"
                                          size={26}
                                          onClick={() => {
                                            if (!track.trackId) {
                                              pushToast('添加失败', '该曲目缺少 track_id，无法加入播放列表', 'error')
                                              return
                                            }
                                            addLocalTrackToPlaylist(
                                              track.trackId,
                                              {
                                                name: track.name,
                                                artistName: track.artistName || '未知艺术家',
                                                artworkUrl: track.cover || item.cover,
                                              },
                                              false
                                            )
                                            pushToast('已添加', `已加入播放列表：${track.name}`, 'success')
                                          }}
                                          title="添加到播放列表"
                                          disabled={track.status !== 'completed'}
                                        >
                                          <Icon name="plus" size={11} />
                                        </IconButton>
                                      </HStack>
                                    </HStack>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Error Details */}
                            {isErr && item.errorDetails && (
                              <Box style={{ background: 'rgba(232, 17, 35, 0.08)', padding: '8px 12px', borderRadius: '4px', marginTop: '4px' }}>
                                <Text tone="error" style={{ fontSize: '0.78rem' }}>
                                  故障详情: {item.errorDetails}
                                </Text>
                              </Box>
                            )}
                          </VStack>
                        </Card>
                      )
                    })}
                  </VStack>
                )}
              </VStack>

              {/* DOWNLOAD HISTORY */}
              <VStack gap="compact" style={{ marginTop: '16px' }}>
                <HStack justify="space-between" align="center">
                  <Heading level={3}>历史已下载 ({downloadHistory.length})</Heading>
                  <Button variant="ghost" size="sm" onClick={() => getHistoryApi().then(res => setDownloadHistory(res))}>刷新</Button>
                </HStack>
                {historyAlbumGroups.length === 0 ? (
                  <Text tone="secondary" style={{ fontSize: '0.85rem' }}>暂无历史下载记录</Text>
                ) : (
                  <VStack gap="compact">
                    {historyAlbumGroups.map((group) => {
                      const isHistoryOpen = !!openHistoryAlbums[group.id]
                      const firstTrack = group.tracks[0]

                      return (
                        <Card key={group.id}>
                          <VStack gap="compact">
                            <HStack justify="space-between" align="center">
                              <HStack gap="normal" align="center" style={{ minWidth: 0, flex: 1 }}>
                                <Image
                                  src={group.cover}
                                  alt={group.title}
                                  radius={6}
                                  style={{ width: '48px', height: '48px', flexShrink: 0 }}
                                />
                                <VStack gap={2} style={{ minWidth: 0 }}>
                                  <Text weight={700} style={{ fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {group.title}
                                  </Text>
                                  <HStack gap="compact" align="center">
                                    <Text tone="secondary" style={{ fontSize: '0.76rem' }}>
                                      {group.artistName} · {group.tracks.length} 首
                                    </Text>
                                    <Badge tone="info">专辑</Badge>
                                  </HStack>
                                </VStack>
                              </HStack>

                              <HStack gap="compact" align="center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  trailingIcon={<Icon name="chevronDown" size={12} style={{ transform: isHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                                  onClick={() => setOpenHistoryAlbums(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                                >
                                  {isHistoryOpen ? '收起曲目' : '查看曲目'}
                                </Button>
                                <IconButton
                                  variant="ghost"
                                  size={32}
                                  onClick={() => handleDeleteHistoryGroup(group.id, group.title, group.tracks)}
                                  title={group.tracks.length > 1 ? '删除整专' : '删除记录'}
                                  disabled={deletingHistoryGroupId === group.id}
                                >
                                  {deletingHistoryGroupId === group.id ? (
                                    <Spinner size={14} />
                                  ) : (
                                    <Icon name="trash" size={14} style={{ color: 'var(--system-error)' }} />
                                  )}
                                </IconButton>
                                <IconButton
                                  variant="ghost"
                                  size={32}
                                  onClick={() => {
                                    openFolderApi(group.folderPath || firstTrack?.file_path).catch((err) => pushToast('定位失败', err.message || '无法定位本地文件', 'error'))
                                  }}
                                  title="定位专辑目录"
                                >
                                  <Icon name="folder" size={14} />
                                </IconButton>
                              </HStack>
                            </HStack>

                            {isHistoryOpen && (
                              <div className="album-subtracks">
                                {group.tracks.map((track, index) => (
                                  <div key={track.id} className="album-subtrack-item">
                                    <HStack justify="space-between" align="center">
                                      <Text style={{ fontSize: '0.84rem' }}>
                                        {index + 1}. {track.name}
                                      </Text>
                                      <HStack gap="compact">
                                        <Badge tone="success">{normalizeCodecLabel(track.codec)}</Badge>
                                        <IconButton
                                          variant="secondary"
                                          size={26}
                                          onClick={() => {
                                            startLocalPlayback(
                                              track.track_id,
                                              { name: track.name, artistName: track.artist_name, artworkUrl: track.artwork_url || getLocalArtworkUrl(track.track_id) },
                                              true
                                            )
                                          }}
                                          title="本地播放"
                                        >
                                          <Icon name="play" size={11} />
                                        </IconButton>
                                        <IconButton
                                          variant="ghost"
                                          size={26}
                                          onClick={() => handleAddHistoryTrackToPlaylist(track)}
                                          title="添加到播放列表"
                                        >
                                          <Icon name="plus" size={11} />
                                        </IconButton>
                                        <IconButton
                                          variant="ghost"
                                          size={26}
                                          onClick={() => {
                                            openFolderApi(track.file_path).catch((err) => pushToast('定位失败', err.message || '无法定位本地文件', 'error'))
                                          }}
                                          title="定位文件"
                                        >
                                          <Icon name="folder" size={11} />
                                        </IconButton>
                                        <IconButton
                                          variant="ghost"
                                          size={26}
                                          onClick={() => {
                                            if (window.confirm('确定要删除此历史记录吗？将同时尝试删除本地文件。')) {
                                              deleteHistoryApi(track.track_id, true).then(() => {
                                                getHistoryApi().then(res => setDownloadHistory(res))
                                              }).catch(console.error)
                                            }
                                          }}
                                          title="删除记录"
                                        >
                                          <Icon name="trash" size={11} style={{ color: 'var(--system-error)' }} />
                                        </IconButton>
                                      </HStack>
                                    </HStack>
                                  </div>
                                ))}
                              </div>
                            )}
                          </VStack>
                        </Card>
                      )
                    })}
                  </VStack>
                )}
              </VStack>

            </VStack>
          )}

          {/* TAB 3: SETTINGS VIEW */}
          {activeTab === 'settings' && (
            <VStack gap="normal">
              {/* STATUS Accordion */}
              <Box surface border radius="container" style={{ overflow: 'hidden' }}>
                <button
                  className="ui-accordion-summary"
                  style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
                  onClick={() => toggleAccordion('status')}
                >
                  <Text weight={700}>运行状态信息</Text>
                  <Icon name="chevronDown" style={{ transform: accordionOpen.status ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {accordionOpen.status && (
                  <div style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
                    <Grid minItemWidth="200px" gap="normal">
                      <Box padding="normal" surface border radius="container">
                        <VStack gap={4}>
                          <Text tone="secondary" style={{ fontSize: '0.8rem' }}>授权文件 Cookies.txt</Text>
                          <HStack justify="space-between" align="center" style={{ marginTop: '4px' }}>
                            <Text weight={700}>{healthStatus?.cookies_ok ? '有效配置' : '未授权 (请贴Cookies)'}</Text>
                            <Badge tone={healthStatus?.cookies_ok ? 'success' : 'error'}>
                              {healthStatus?.cookies_ok ? '正常' : '异常'}
                            </Badge>
                          </HStack>
                        </VStack>
                      </Box>
                      <Box padding="normal" surface border radius="container">
                        <VStack gap={4}>
                          <Text tone="secondary" style={{ fontSize: '0.8rem' }}>解密辅助代理 (Wrapper)</Text>
                          <HStack justify="space-between" align="center" style={{ marginTop: '4px' }}>
                            <Text weight={700}>{healthStatus?.wrapper.all_ok ? '解密容器就绪' : '组件未工作'}</Text>
                            <Badge tone={healthStatus?.wrapper.all_ok ? 'success' : 'error'}>
                              {healthStatus?.wrapper.all_ok ? '已连接' : '未启动'}
                            </Badge>
                          </HStack>
                        </VStack>
                      </Box>
                      <Box padding="normal" surface border radius="container">
                        <VStack gap={4}>
                          <Text tone="secondary" style={{ fontSize: '0.8rem' }}>本地调度中心进程</Text>
                          <HStack justify="space-between" align="center" style={{ marginTop: '4px' }}>
                            <Text weight={700}>{downloaderInitialized ? '核心就绪' : '等待接口'}</Text>
                            <Badge tone={downloaderInitialized ? 'success' : 'error'}>
                              {downloaderInitialized ? '运行中' : '异常'}
                            </Badge>
                          </HStack>
                        </VStack>
                      </Box>
                      <Box padding="normal" surface border radius="container">
                        <VStack gap={4}>
                          <Text tone="secondary" style={{ fontSize: '0.8rem' }}>解析曲库首选地区</Text>
                          <HStack justify="space-between" align="center" style={{ marginTop: '4px' }}>
                            <Text weight={700}>中国大陆 (CN)</Text>
                            <Badge tone="default">默认</Badge>
                          </HStack>
                        </VStack>
                      </Box>
                    </Grid>
                  </div>
                )}
              </Box>

              {/* ONBOARDING ENTRY Accordion */}
              <Box surface border radius="container" style={{ overflow: 'hidden' }}>
                <button
                  className="ui-accordion-summary"
                  style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
                  onClick={() => toggleAccordion('onboarding')}
                >
                  <Text weight={700}>初始化页面入口</Text>
                  <Icon name="chevronDown" style={{ transform: accordionOpen.onboarding ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {accordionOpen.onboarding && (
                  <div style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
                    <VStack gap="normal">
                      <Text tone="secondary" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                        如需重新查看协议、重新执行 Cookies 登录或 Wrapper 初始化引导，可在此重新打开首次启动初始化页面。
                      </Text>
                      <HStack justify="space-between" align="center" style={{ flexWrap: 'wrap', gap: '10px' }}>
                        <HStack gap="compact" align="center" style={{ flexWrap: 'wrap' }}>
                          <Badge tone={initCookieConfigured ? 'success' : 'error'}>
                            Cookies: {initCookieConfigured ? '已配置' : '未配置'}
                          </Badge>
                          <Badge tone={initWrapperConfigured ? 'success' : 'default'}>
                            Wrapper: {initWrapperConfigured ? '已配置' : '未配置'}
                          </Badge>
                        </HStack>
                        <Button onClick={handleOpenInitGuideFromSettings}>
                          打开初始化页面
                        </Button>
                      </HStack>
                    </VStack>
                  </div>
                )}
              </Box>

              {/* QUALITY Accordion */}
              <Box surface border radius="container" style={{ overflow: 'hidden' }}>
                <button
                  className="ui-accordion-summary"
                  style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
                  onClick={() => toggleAccordion('quality')}
                >
                  <Text weight={700}>音视频品质品质选择</Text>
                  <Icon name="chevronDown" style={{ transform: accordionOpen.quality ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {accordionOpen.quality && (
                  <div style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
                    <VStack gap="normal">
                      <HStack justify="space-between" align="center">
                        <VStack gap={2}>
                          <Text weight={700} style={{ fontSize: '0.94rem' }}>启用高品音质下载 (无损/全景声)</Text>
                          <Text tone="secondary" style={{ fontSize: '0.78rem' }}>若Wrapper未就绪，提交下载时将直接报错，不再自动降级</Text>
                        </VStack>
                        <Toggle
                          checked={useWrapper}
                          onChange={(e) => setUseWrapper(e.target.checked)}
                          disabled={healthStatus ? !healthStatus.wrapper.all_ok : true}
                        />
                      </HStack>

                      <Divider />

                      <Menu
                        label="设定默认音频下载音质"
                        disabled={!useWrapper}
                        value={codec}
                        onChange={(e) => setCodec(e.target.value)}
                        options={[
                          { label: 'AAC 256kbps (标准立体声)', value: 'aac-legacy' },
                          { label: 'ALAC 24-bit/192kHz (高保真无损品质)', value: 'alac' },
                          { label: 'Dolby Atmos (杜比全景声 环绕声)', value: 'atmos' }
                        ]}
                      />

                      <Divider />

                      <Menu
                        label="设定默认 MV 视频画质"
                        disabled={healthStatus ? !healthStatus.wrapper.all_ok : true}
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        options={healthStatus?.wrapper.all_ok ? [
                          { label: '1080p FHD (自适应高画质)', value: '1080p' },
                          { label: '4K Ultra HD (极高清品质)', value: '4k' }
                        ] : [
                          { label: '不可用 (请开启本地解密辅助代理)', value: 'unavailable' }
                        ]}
                      />

                      <Divider />

                      <VStack gap="compact">
                        <Text weight={700} style={{ fontSize: '0.94rem' }}>通用音频格式转码</Text>
                        <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                          不建议使用AAC转MP3，这将导致音质永久损失。
                        </Text>

                        <HStack justify="space-between" align="center">
                          <Text style={{ fontSize: '0.84rem' }}>AAC自动转换320kMP3</Text>
                          <Toggle checked={transcodeAacToMp3_320} onChange={(e) => setTranscodeAacToMp3_320(e.target.checked)} />
                        </HStack>
                        <HStack justify="space-between" align="center">
                          <Text style={{ fontSize: '0.84rem' }}>AAC自动转换MP4</Text>
                          <Toggle checked={transcodeAacToMp4} onChange={(e) => setTranscodeAacToMp4(e.target.checked)} />
                        </HStack>
                        <HStack justify="space-between" align="center">
                          <Text style={{ fontSize: '0.84rem' }}>AAC自动转换标准AAC</Text>
                          <Toggle checked={transcodeAacToAacStandard} onChange={(e) => setTranscodeAacToAacStandard(e.target.checked)} />
                        </HStack>
                        <HStack justify="space-between" align="center">
                          <Text style={{ fontSize: '0.84rem' }}>ALAC自动转换FLAC</Text>
                          <Toggle checked={transcodeAlacToFlac} onChange={(e) => setTranscodeAlacToFlac(e.target.checked)} />
                        </HStack>
                        <HStack justify="space-between" align="center">
                          <Text style={{ fontSize: '0.84rem' }}>ALAC自动转换WAV</Text>
                          <Toggle checked={transcodeAlacToWav} onChange={(e) => setTranscodeAlacToWav(e.target.checked)} />
                        </HStack>
                        <HStack justify="space-between" align="center">
                          <Text style={{ fontSize: '0.84rem' }}>ALAC自动转换MP4</Text>
                          <Toggle checked={transcodeAlacToMp4} onChange={(e) => setTranscodeAlacToMp4(e.target.checked)} />
                        </HStack>
                      </VStack>
                    </VStack>
                  </div>
                )}
              </Box>

              {/* COOKIE Accordion */}
              <Box surface border radius="container" style={{ overflow: 'hidden' }}>
                <button
                  className="ui-accordion-summary"
                  style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
                  onClick={() => toggleAccordion('cookie')}
                >
                  <Text weight={700}>Cookies 授权管理</Text>
                  <Icon name="chevronDown" style={{ transform: accordionOpen.cookie ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {accordionOpen.cookie && (
                  <div style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
                    <VStack gap="normal">
                      <TextArea
                        placeholder="在此粘贴您的账户 Cookies (Netscape 文本格式，首行应为 # Netscape HTTP Cookie File)..."
                        value={cookieText}
                        onChange={(e) => setCookieText(e.target.value)}
                        style={{ height: '140px', fontSize: '0.8rem' }}
                      />
                      <HStack justify="flex-end">
                        <Button
                          onClick={triggerSaveCookies}
                          disabled={cookieSaving || !cookieText.trim()}
                          leadingIcon={cookieSaving ? <Spinner size={14} /> : <Icon name="check" size={14} />}
                        >
                          {cookieSaving ? '保存核心中...' : '保存并重启下载核心'}
                        </Button>
                      </HStack>
                    </VStack>
                  </div>
                )}
              </Box>

              {/* LOGS Accordion */}
              <Box surface border radius="container" style={{ overflow: 'hidden' }}>
                <button
                  className="ui-accordion-summary"
                  style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
                  onClick={() => toggleAccordion('logs')}
                >
                  <Text weight={700}>运行日志与后台终端输出</Text>
                  <Icon name="chevronDown" style={{ transform: accordionOpen.logs ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {accordionOpen.logs && (
                  <div style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
                    <div className="terminal-log-view">
                      {terminalLogs.map((log, i) => (
                        <div key={i} style={{ marginBottom: '3px' }}>{log}</div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                )}
              </Box>
            </VStack>
          )}

          {/* TAB 4: ABOUT VIEW */}
          {activeTab === 'about' && (
            <VStack gap="normal">
              
              {/* Product Info Section */}
              <Card>
                <VStack align="center" gap="normal" style={{ paddingBlock: '12px' }}>
                  <img src={logoImage} alt="Product Logo" style={{ width: '72px', height: '72px' }} />
                  <VStack align="center" gap={4}>
                    <Heading level={3}>LingoMusic Downloader</Heading>
                    <Text tone="secondary" style={{ fontSize: '0.88rem' }}>版本号: v2.1.0-Beta (Vite+React+Tauri)</Text>
                  </VStack>
                  <Text style={{ fontSize: '0.88rem', textAlign: 'center', maxWidth: '480px', lineHeight: '1.5' }}>
                    本应用是一个极速高保真的本地音视频抓取客户端，支持全自动高级品质音频解密与智能封面歌词合成封装。
                  </Text>
                  <HStack gap="compact" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openExternalLink(`${repositoryUrl}/releases`, 'GitHub Releases')}
                    >
                      检查更新
                    </Button>
                    <Badge tone="default">后端监听: 8000</Badge>
                    <Badge tone="default">解密端口: 10020</Badge>
                    <Badge tone="default">画质解密: 20020</Badge>
                  </HStack>
                </VStack>
              </Card>

              {/* Author section */}
              <Card>
                <HStack justify="space-between" align="center">
                  <VStack gap={2}>
                    <Text weight={700}>开发作者</Text>
                    <Text tone="secondary" style={{ fontSize: '0.84rem' }}>yourpapayouknow (GitHub 社区)</Text>
                  </VStack>
                  <IconButton
                    variant="ghost"
                    onClick={() => openExternalLink(repositoryUrl, 'GitHub 仓库')}
                    title="作者仓库"
                  >
                    <Icon name="github" size={20} />
                  </IconButton>
                </HStack>
              </Card>

              {/* Third-party references */}
              <Card>
                <VStack gap="compact">
                  <Text weight={700}>第三方开源项目引用</Text>
                  <Grid minItemWidth="230px" gap="compact" style={{ marginTop: '8px' }}>
                    {[
                      { name: 'Tauri Framework', desc: '轻量级桌面容器核心', url: 'https://github.com/tauri-apps/tauri' },
                      { name: 'Vite Build Engine', desc: '下一代前端构建调度器', url: 'https://github.com/vitejs/vite' },
                      { name: 'React UI Runtime', desc: '高性能状态组件库', url: 'https://github.com/facebook/react' },
                      { name: 'FastAPI Backend', desc: '极速异步 Python API 框架', url: 'https://github.com/tiangolo/fastapi' },
                      { name: 'gamdl Downloader', desc: '核心曲目调度抓取模块', url: 'https://github.com/glomatico/gamdl' }
                    ].map((lib, i) => (
                      <Box key={i} surface border padding="compact" radius="container">
                        <HStack justify="space-between" align="center">
                          <VStack gap={2} style={{ minWidth: 0 }}>
                            <Text weight={600} style={{ fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {lib.name}
                            </Text>
                            <Text tone="secondary" style={{ fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {lib.desc}
                            </Text>
                          </VStack>
                          <IconButton
                            variant="ghost"
                            size={28}
                            onClick={() => openExternalLink(lib.url, lib.name)}
                            title="查看主页"
                          >
                            <Icon name="link" size={13} />
                          </IconButton>
                        </HStack>
                      </Box>
                    ))}
                  </Grid>
                </VStack>
              </Card>

              {/* Legal Disclaimer Section */}
              <Card style={{ border: '1px solid var(--system-error)', background: 'rgba(232, 17, 35, 0.03)' }}>
                <VStack gap="normal">
                  <HStack justify="space-between" align="center">
                    <HStack gap="compact" align="center">
                      <Icon name="alert" size={18} style={{ color: 'var(--system-error)' }} />
                      <Text weight={700} tone="error">使用免责声明及法律风险提示</Text>
                    </HStack>
                    <HStack gap="compact" align="center">
                      <Text style={{ fontSize: '0.78rem' }} tone="secondary">语言/Language:</Text>
                      <Segmented
                        options={[
                          { label: '中文', value: 'zh' },
                          { label: 'EN', value: 'en' }
                        ]}
                        value={disclaimerLang}
                        onChange={(val) => setDisclaimerLang(val as any)}
                      />
                    </HStack>
                  </HStack>

                  <Divider style={{ borderColor: 'color-mix(in srgb, var(--system-error) 20%, transparent)' }} />

                  {disclaimerLang === 'zh' ? (
                    <div style={{ fontSize: '0.8rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                      <p style={{ marginBlock: '0 6px' }}>1. 本软件为开源学习交流项目，仅限用于个人技术交流与研究目的。<b>严禁将本软件用于任何商业性牟利或非法侵权行为。</b></p>
                      <p style={{ marginBlock: '6px' }}>2. 软件中所调用的音视频解密辅助接口及 WSL 环境，均来源自网络公共研究文献。本软件不提供任何音源版权破解，亦不存储任何受版权保护的音视频文件。</p>
                      <p style={{ marginBlock: '6px' }}>3. 用户利用本应用检索或下载的所有音乐、歌词、唱片封面和 MV 视频内容，<b>版权均归原版权方合法所有。</b>请于下载后 24 小时内将其全部删除。</p>
                      <p style={{ marginBlock: '6px 0' }}>4. 因使用本软件所产生的账号封禁、数字版权纠纷、民事侵权或刑事纠纷风险，<b>均由使用者个人自行承担全部责任</b>，软件作者和开发团队不承担任何连带赔偿与法律责任。</p>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                      <p style={{ marginBlock: '0 6px' }}>1. This software is an open-source educational project for research and technical exploration. <b>Any commercial usage or infringement is strictly prohibited.</b></p>
                      <p style={{ marginBlock: '6px' }}>2. The decryption helper and proxy configurations are based on public network research. This tool does not directly host, crack, or bypass digital rights ownerships.</p>
                      <p style={{ marginBlock: '6px' }}>3. All ownership rights for audio/video materials fetched by this client <b>belong to the original legal rights holders.</b> Please delete files within 24 hours of retrieval.</p>
                      <p style={{ marginBlock: '6px 0' }}>4. Risk of account suspension, copyright enforcement, civil liability, or damages <b>falls entirely upon the individual user.</b> The developers assume no legal responsibility or liability.</p>
                    </div>
                  )}
                </VStack>
              </Card>
            </VStack>
          )}
        </VStack>
      </ScrollView>

      {/* WSL2 installer dialog */}
      {wslInstallDialogOpen && (
        <div className="wsl-install-mask" role="dialog" aria-modal="true" aria-label="安装WSL2">
          <div className="wsl-install-card">
            <VStack gap="normal" style={{ height: '100%' }}>
              <HStack justify="space-between" align="flex-start">
                <VStack gap={4}>
                  <Heading level={3}>安装WSL2</Heading>
                  <Text tone="secondary" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
                    将安装Ubuntu于D:\WSL2，若D盘不存在，则将安装在C盘默认位置
                  </Text>
                </VStack>
                <IconButton
                  variant="ghost"
                  size={30}
                  onClick={handleCloseWslInstallDialog}
                  disabled={Boolean(wslInstallStatusData?.running)}
                  title={wslInstallStatusData?.running ? '安装进行中，暂不可关闭' : '关闭'}
                >
                  <Icon name="close" size={14} />
                </IconButton>
              </HStack>

              <Box surface border radius="container" padding="normal">
                <VStack gap={6}>
                  <Text style={{ fontSize: '0.82rem' }}>
                    预检查结果：{wslInstallPrecheck?.message || '正在检查磁盘空间与安装条件...'}
                  </Text>
                  {wslInstallStatusData?.message && (
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      当前状态：{wslInstallStatusData.message}（阶段：{wslInstallStatusData.stage || 'idle'}）
                    </Text>
                  )}
                  <HStack gap="compact" style={{ flexWrap: 'wrap' }}>
                    <Badge tone={wslInstallPrecheck?.d_drive_exists ? 'default' : 'error'}>
                      D盘: {wslInstallPrecheck?.d_drive_exists ? '存在' : '不存在'} · {wslInstallPrecheck?.d_free_gb ?? 0} GB
                    </Badge>
                    <Badge tone="default">
                      C盘可用: {wslInstallPrecheck?.c_free_gb ?? 0} GB
                    </Badge>
                    <Badge tone={wslInstallPrecheck?.is_admin ? 'success' : 'error'}>
                      权限: {wslInstallPrecheck?.is_admin ? '管理员' : '非管理员'}
                    </Badge>
                    <Badge tone={wslInstallPrecheck?.already_installed ? 'success' : 'default'}>
                      WSL2: {wslInstallPrecheck?.already_installed ? '已安装' : '未安装'}
                    </Badge>
                  </HStack>
                  {wslInstallPrecheck?.install_hint && (
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      检测依据：{wslInstallPrecheck.install_hint}
                    </Text>
                  )}
                  {(wslInstallStatusData?.target_path || wslInstallPrecheck?.target_path) && (
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      安装目标：{wslInstallStatusData?.target_path || wslInstallPrecheck?.target_path}
                    </Text>
                  )}
                </VStack>
              </Box>

              {(wslInstallStatusData?.logs?.length || 0) > 0 && (
                <div className="wsl-install-log-panel">
                  {wslInstallStatusData?.logs?.map((line, index) => (
                    <div key={`wsl-log-${index}`}>{line}</div>
                  ))}
                </div>
              )}

              {wslInstallLoading && (
                <HStack gap="compact" align="center">
                  <Spinner size={14} />
                  <Text tone="secondary" style={{ fontSize: '0.8rem' }}>
                    正在处理安装流程，请稍候...
                  </Text>
                </HStack>
              )}

              <HStack justify="space-between" align="center" style={{ marginTop: 'auto' }}>
                <Button
                  variant="secondary"
                  onClick={handleCloseWslInstallDialog}
                  disabled={Boolean(wslInstallStatusData?.running)}
                >
                  关闭
                </Button>
                <Button
                  className="init-guide-primary-btn"
                  onClick={handleConfirmInstallWsl2}
                  disabled={
                    wslInstallLoading
                    || Boolean(wslInstallStatusData?.running)
                    || Boolean(wslInstallPrecheck?.already_installed)
                    || !Boolean(wslInstallPrecheck?.can_install)
                  }
                  leadingIcon={wslInstallLoading ? <Spinner size={14} /> : undefined}
                >
                  {wslInstallStatusData?.running
                    ? '安装中...'
                    : wslInstallPrecheck?.already_installed
                      ? '已安装完成'
                      : '确认安装'}
                </Button>
              </HStack>
            </VStack>
          </div>
        </div>
      )}

      {/* Wrapper installer/login dialog */}
      {wrapperSetupDialogOpen && (
        <div className="wsl-install-mask" role="dialog" aria-modal="true" aria-label="安装Wrapper并登录">
          <div className="wsl-install-card">
            <VStack gap="normal" style={{ height: '100%' }}>
              <HStack justify="space-between" align="flex-start">
                <VStack gap={4}>
                  <Heading level={3}>安装Wrapper并登录</Heading>
                  <Text tone="secondary" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
                    将自动检测WSL2、安装/启动Wrapper，并在需要时提示输入ID/密码与2FA验证码
                  </Text>
                </VStack>
                <IconButton
                  variant="ghost"
                  size={30}
                  onClick={handleCloseWrapperSetupDialog}
                  disabled={Boolean(wrapperSetupStatusData?.running)}
                  title={wrapperSetupStatusData?.running ? '任务进行中，暂不可关闭' : '关闭'}
                >
                  <Icon name="close" size={14} />
                </IconButton>
              </HStack>

              <Box surface border radius="container" padding="normal">
                <VStack gap={6}>
                  <Text style={{ fontSize: '0.82rem' }}>
                    预检查结果：{wrapperSetupPrecheck?.message || '正在检查WSL2与Wrapper运行条件...'}
                  </Text>
                  {wrapperSetupStatusData?.message && (
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      当前状态：{wrapperSetupStatusData.message}（阶段：{wrapperSetupStatusData.stage || 'idle'}）
                    </Text>
                  )}
                  <HStack gap="compact" style={{ flexWrap: 'wrap' }}>
                    <Badge tone={wrapperSetupPrecheck?.wsl2_installed ? 'success' : 'error'}>
                      WSL2: {wrapperSetupPrecheck?.wsl2_installed ? '已安装' : '未安装'}
                    </Badge>
                    <Badge tone={wrapperSetupPrecheck?.wrapper_installed ? 'success' : 'default'}>
                      Wrapper: {wrapperSetupPrecheck?.wrapper_installed ? '已安装' : '未安装'}
                    </Badge>
                    <Badge tone={wrapperSetupPrecheck?.wrapper_running ? 'success' : 'error'}>
                      服务: {wrapperSetupPrecheck?.wrapper_running ? '运行中' : '未运行'}
                    </Badge>
                    <Badge tone={wrapperSetupPrecheck?.session_db_exists ? 'success' : 'default'}>
                      会话库: {wrapperSetupPrecheck?.session_db_exists ? '已存在' : '未检测到'}
                    </Badge>
                  </HStack>
                  {wrapperSetupPrecheck?.wsl2_hint && (
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      WSL2检测依据：{wrapperSetupPrecheck.wsl2_hint}
                    </Text>
                  )}
                  {wrapperSetupStatusData?.awaiting_input && (
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      输入提示：{wrapperSetupStatusData.input_prompt || '检测到Wrapper需要输入，请在弹窗中提交。'}
                    </Text>
                  )}
                </VStack>
              </Box>

              {(wrapperSetupStatusData?.logs?.length || 0) > 0 && (
                <div className="wsl-install-log-panel">
                  {wrapperSetupStatusData?.logs?.map((line, index) => (
                    <div key={`wrapper-log-${index}`}>{line}</div>
                  ))}
                </div>
              )}

              {wrapperSetupLoading && (
                <HStack gap="compact" align="center">
                  <Spinner size={14} />
                  <Text tone="secondary" style={{ fontSize: '0.8rem' }}>
                    正在处理Wrapper流程，请稍候...
                  </Text>
                </HStack>
              )}

              <HStack justify="space-between" align="center" style={{ marginTop: 'auto' }}>
                <Button
                  variant="secondary"
                  onClick={handleCloseWrapperSetupDialog}
                  disabled={Boolean(wrapperSetupStatusData?.running)}
                >
                  关闭
                </Button>
                <HStack gap="compact" align="center">
                  <Button
                    variant="secondary"
                    onClick={handleRestartWrapperSetup}
                    disabled={
                      wrapperSetupLoading
                      || Boolean(wrapperSetupStatusData?.running)
                      || !Boolean(wrapperSetupPrecheck?.can_start)
                    }
                  >
                    重启Wrapper
                  </Button>
                  <Button
                    className="init-guide-primary-btn"
                    onClick={handleConfirmStartWrapperSetup}
                    disabled={
                      wrapperSetupLoading
                      || Boolean(wrapperSetupStatusData?.running)
                      || !Boolean(wrapperSetupPrecheck?.can_start)
                    }
                    leadingIcon={wrapperSetupLoading ? <Spinner size={14} /> : undefined}
                  >
                    {wrapperSetupStatusData?.running ? '处理中...' : '开始安装/登录'}
                  </Button>
                </HStack>
              </HStack>
            </VStack>

            {wrapperInputDialogOpen && (
              <div className="wrapper-input-mask">
                <div className="wrapper-input-card">
                  <VStack gap="normal">
                    <VStack gap={4}>
                      <Heading level={4}>
                        {wrapperSetupStatusData?.input_type === '2fa' ? '输入2FA验证码' : '输入Apple ID登录信息'}
                      </Heading>
                      <Text tone="secondary" style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                        {wrapperSetupStatusData?.input_prompt || '检测到Wrapper正在等待输入，请完成提交。'}
                      </Text>
                    </VStack>

                    {wrapperSetupStatusData?.input_type === '2fa' ? (
                      <TextField
                        placeholder="请输入验证码"
                        value={wrapperInput2fa}
                        onChange={(e) => setWrapperInput2fa(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmitWrapperInput()}
                      />
                    ) : (
                      <VStack gap="compact">
                        <TextField
                          placeholder="请输入Apple ID（邮箱）"
                          value={wrapperInputAppleId}
                          onChange={(e) => setWrapperInputAppleId(e.target.value)}
                        />
                        <TextField
                          type="password"
                          placeholder="请输入Apple ID密码"
                          value={wrapperInputPassword}
                          onChange={(e) => setWrapperInputPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSubmitWrapperInput()}
                        />
                      </VStack>
                    )}

                    <HStack justify="flex-end" gap="compact">
                      <Button
                        className="init-guide-primary-btn"
                        onClick={handleSubmitWrapperInput}
                        disabled={wrapperInputSubmitting}
                        leadingIcon={wrapperInputSubmitting ? <Spinner size={14} /> : undefined}
                      >
                        提交
                      </Button>
                    </HStack>
                  </VStack>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Forced onboarding wizard (frontend-only for now) */}
      {initGuideOpen && (
        <div className="init-guide-overlay" role="dialog" aria-modal="true" aria-label="首次启动引导">
          <div className="init-guide-backdrop" />
          <div className="init-guide-modal">
            {initGuideStep === 1 ? (
              <VStack gap="normal" style={{ height: '100%' }}>
                <VStack gap={4}>
                  <Heading level={3}>欢迎使用LingoMusicDownloader！</Heading>
                  <Text tone="secondary" style={{ fontSize: '0.82rem' }}>
                    请完整阅读以下协议与免责声明，滚动至末尾后方可继续下一步。
                  </Text>
                </VStack>

                <div className="init-guide-agreement-scroll" ref={initAgreementScrollRef}>
                  {INIT_AGREEMENT_PARAGRAPHS.map((paragraph, index) => (
                    <p key={`agreement-${index}`}>{paragraph}</p>
                  ))}
                </div>

                <HStack justify="space-between" align="center" style={{ marginTop: 'auto' }}>
                  <Button
                    variant="secondary"
                    onClick={handleDisagreeAndExit}
                  >
                    不同意并退出
                  </Button>
                  <Button
                    className="init-guide-primary-btn"
                    onClick={() => setInitGuideStep(2)}
                    disabled={!initAgreementReachedEnd}
                  >
                    同意并下一页
                  </Button>
                </HStack>
              </VStack>
            ) : (
              <VStack gap="normal" style={{ height: '100%' }}>
                <VStack gap={4}>
                  <Heading level={3}>软件初始化配置</Heading>
                  <Text tone="secondary" style={{ fontSize: '0.82rem' }}>
                    以下步骤用于激活全部核心功能。Cookies与Wrapper流程均支持自动检测、安装与登录引导。
                  </Text>
                </VStack>

                <div className="init-guide-step-block">
                  <Text weight={700} style={{ fontSize: '0.95rem' }}>获取Cookies</Text>
                  <Text tone="secondary" style={{ fontSize: '0.82rem' }}>
                    使用Cookies登录以激活搜索与AAC下载功能
                  </Text>
                  <HStack align="center" gap="compact" style={{ marginTop: '10px' }}>
                    <Button
                      className="init-guide-primary-btn"
                      onClick={handleInitCookieLogin}
                      leadingIcon={initCookieLoggingIn ? <Spinner size={14} /> : undefined}
                    >
                      {initCookieLoggingIn ? '完成登录并继续' : '点击登录'}
                    </Button>
                    {initCookieConfigured && (
                      <span className="init-guide-check-ok" title="已配置">
                        <Icon name="check" size={12} />
                      </span>
                    )}
                  </HStack>
                </div>

                <div className="init-guide-step-block">
                  <Text weight={700} style={{ fontSize: '0.95rem' }}>安装Wrapper</Text>
                  <Text tone="secondary" style={{ fontSize: '0.82rem' }}>
                    使用Wrapper以激活ALAC/DOLBY与MV等高级下载功能
                  </Text>
                  <HStack align="center" gap="compact" style={{ marginTop: '10px', flexWrap: 'wrap' }}>
                    <Button
                      className="init-guide-primary-btn"
                      onClick={openWslInstallDialog}
                    >
                      点击安装WSL2
                    </Button>
                    <Button
                      className="init-guide-primary-btn"
                      onClick={openWrapperSetupDialog}
                    >
                      点击安装Wrapper并登录
                    </Button>
                    {initWrapperConfigured && (
                      <span className="init-guide-check-ok" title="已配置">
                        <Icon name="check" size={12} />
                      </span>
                    )}
                  </HStack>
                  <VStack gap={6} style={{ marginTop: '10px', alignItems: 'flex-start' }}>
                    <HStack gap={6} align="flex-start">
                      <Icon name="alert" size={14} style={{ marginTop: '2px', color: '#f6a11b' }} />
                      <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                        1. 不安装以上组件，仍然可有限使用本软件。
                      </Text>
                    </HStack>
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      2. WSL2将默认安装在D盘并占用15GB左右空间，请提前预留空间。
                    </Text>
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      3. Wrapper为独立服务，使用时需要为其再次登录ID。
                    </Text>
                  </VStack>
                </div>

                <HStack justify="space-between" align="center" style={{ marginTop: 'auto' }}>
                  <Button variant="secondary" onClick={() => setInitGuideStep(1)}>
                    上一页
                  </Button>
                  <Button className="init-guide-primary-btn" onClick={handleInitEnterSoftware}>
                    进入软件
                  </Button>
                </HStack>

                {initEnterConfirmOpen && (
                  <div className="init-guide-confirm-mask">
                    <div className="init-guide-confirm-card">
                      <VStack gap="normal">
                        <HStack gap="compact" align="center">
                          <Icon name="alert" size={16} style={{ color: '#f6a11b' }} />
                          <Text weight={700}>提示</Text>
                        </HStack>
                        <Text style={{ fontSize: '0.84rem', lineHeight: '1.6' }}>
                          未配置Wrapper将无法下载无损等高规格音视频！您可后续在设置页配置。
                        </Text>
                        <HStack justify="flex-end" gap="compact">
                          <Button variant="secondary" onClick={() => setInitEnterConfirmOpen(false)}>
                            返回
                          </Button>
                          <Button
                            className="init-guide-primary-btn"
                            onClick={() => {
                              setInitEnterConfirmOpen(false)
                              setInitGuideOpen(false)
                            }}
                          >
                            仍然进入
                          </Button>
                        </HStack>
                      </VStack>
                    </div>
                  </div>
                )}
              </VStack>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Download Dialog */}
      {downloadConfirmTrack && (
        <Dialog
          open={downloadConfirmOpen}
          title="确认提交下载"
          description=""
          confirmText="确认下载"
          cancelText="取消"
          onOpenChange={(next) => setDownloadConfirmOpen(next)}
          onConfirm={handleConfirmDownload}
        >
          <VStack gap="normal" style={{ marginBlock: '10px' }}>
            <Box padding="normal" surface border radius="container">
              <HStack gap="normal" align="center">
                <Image
                  src={getArtworkUrl(downloadConfirmTrack.attributes.artwork?.url, 120)}
                  alt={downloadConfirmTrack.attributes.name}
                  radius={6}
                  style={{ width: '56px', height: '56px' }}
                />
                <VStack gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Text weight={700} style={{ fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {downloadConfirmTrack.attributes.name}
                  </Text>
                  <Text tone="secondary" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {downloadConfirmTrack.type === 'artists'
                      ? '艺术家'
                      : (downloadConfirmTrack.attributes.artistName || '未知艺人')}
                  </Text>
                </VStack>
                <Badge tone={downloadConfirmTrack.type === 'music-videos' ? 'info' : downloadConfirmTrack.type === 'artists' ? 'success' : 'default'}>
                  {getResultTypeLabel(downloadConfirmTrack.type)}
                </Badge>
              </HStack>
            </Box>
            
            <HStack justify="space-between" align="center">
              <Text style={{ fontSize: '0.86rem' }}>预计下载品质：</Text>
              <Badge tone="success">
                {downloadConfirmTrack.type === 'music-videos'
                  ? (resolution === '4k' ? '4K Ultra HD 级画质' : '1080p Full HD 高清视频')
                  : (useWrapper 
                      ? (codec === 'atmos' ? 'Dolby Atmos (杜比环绕音效)' : 'ALAC 24-bit/192kHz 无损母带')
                      : 'AAC 256kbps 标准音质'
                    )
                }
              </Badge>
            </HStack>
          </VStack>
        </Dialog>
      )}

      {/* Global Toast notifications view container */}
      <ToastViewport items={toasts} onDismiss={removeToast} />

      {/* Main app bottom bar navigator */}
      <BottomBar
        active={activeTab}
        onChange={(val: any) => setActiveTab(val)}
        items={[
          { value: 'search', label: '搜索', icon: <Icon name="search" size={20} /> },
          { value: 'download', label: '下载', icon: <Icon name="download" size={20} />, badge: downloadingCount > 0 ? downloadingCount : undefined },
          { value: 'settings', label: '设置', icon: <Icon name="settings" size={20} /> },
          { value: 'about', label: '关于', icon: <Icon name="user" size={20} /> },
        ]}
      />
    </div>
  )
}
