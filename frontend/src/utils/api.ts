// 后端RESTful API网络请求客户端与类型定义模块
const BASE_URL = 'http://127.0.0.1:8000/api'

export interface DownloadItem {
  status: 'pending' | 'downloading' | 'completed' | 'error'
  error?: string
  hint?: string
}

export interface DownloadQueueItem {
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'error'
  error?: string
  items: DownloadItem[]
}

export interface DownloadStatus {
  is_initialized: boolean
  downloads: Record<string, DownloadQueueItem>
}

export interface HealthStatus {
  wrapper: {
    decrypt_port: { port: number; reachable: boolean }
    m3u8_port: { port: number; reachable: boolean }
    account_port?: { port: number; reachable: boolean }
    all_ok: boolean
  }
  cookies_ok: boolean
  downloader_initialized: boolean
}

export interface SearchResult {
  id: string
  type: string
  attributes: {
    name: string
    artistName?: string
    albumName?: string
    url: string
    artwork?: {
      url: string
      width: number
      height: number
    }
  }
}

export interface SearchResponse {
  success: boolean
  results: Record<string, { data: SearchResult[] }>
}

export interface CookieLoginFinalizeResponse {
  success: boolean
  message: string
  cookies_count: number
  has_media_user_token: boolean
  login_detected: boolean
  downloader_initialized: boolean
  source_db?: string
  apple_login_url?: string
}

export interface CookieLoginProbeResponse {
  success: boolean
  message: string
  login_detected: boolean
  cookies_count: number
  has_media_user_token: boolean
  source_db?: string
}

export interface HistoryItem {
  id: number
  track_id: string
  name: string
  artist_name: string
  album_name: string
  artwork_url: string
  codec: string
  file_path: string
  lyrics_path?: string
  file_size: number
  download_time: string
}

export interface ScanLocalResponse {
  success: boolean
  root_path: string
  scanned_files: number
  inserted: number
  updated: number
  skipped: number
  failed: number
  errors: string[]
}

export interface LocalLyricsResponse {
  success: boolean
  track_id: string
  path: string
  content: string
}

export interface Wsl2InstallPrecheckResponse {
  success: boolean
  can_install: boolean
  already_installed?: boolean
  install_hint?: string
  message: string
  required_gb: number
  selected_drive: 'D' | 'C' | ''
  target_path: string
  use_custom_location: boolean
  d_drive_exists: boolean
  d_free_gb: number
  c_free_gb: number
  is_admin: boolean
}

export interface Wsl2InstallStatusResponse {
  success: boolean
  status: 'idle' | 'running' | 'success' | 'error'
  stage: string
  running: boolean
  completed: boolean
  success_flag: boolean
  message: string
  required_gb: number
  selected_drive: 'D' | 'C' | ''
  target_path: string
  use_custom_location: boolean
  logs: string[]
  updated_at: number
}

export interface Wsl2InstallStartResponse {
  success: boolean
  status: 'running' | 'success' | 'error'
  message: string
  target_path: string
  selected_drive: 'D' | 'C' | ''
}

export interface WrapperSetupPrecheckResponse {
  success: boolean
  can_start: boolean
  wsl2_installed: boolean
  wsl2_hint?: string
  wrapper_installed: boolean
  wrapper_running: boolean
  session_db_exists: boolean
  message: string
}

export interface WrapperSetupStatusResponse {
  success: boolean
  status: 'idle' | 'running' | 'awaiting_input' | 'success' | 'error'
  stage: string
  running: boolean
  completed: boolean
  success_flag: boolean
  message: string
  wsl2_installed: boolean
  wrapper_installed: boolean
  wrapper_running: boolean
  awaiting_input: boolean
  input_type: '' | 'credentials' | '2fa'
  input_prompt: string
  logs: string[]
  updated_at: number
}

export interface WrapperSetupStartResponse {
  success: boolean
  status: 'running' | 'success' | 'error'
  message: string
}

export interface WrapperSetupInputResponse {
  success: boolean
  status: 'running' | 'success' | 'error'
  message: string
}


// 请求Apple Music曲库关键词检索
export async function srchapl(term: string): Promise<SearchResponse> {
  const res = await fetch(`${BASE_URL}/search?term=${encodeURIComponent(term)}`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to search Apple Music')
  }
  return res.json()
}


// 投递音频下载请求
export async function sbmtdwnld(
  url: string,
  codec: string,
  videoResolution: string,
  useWrapper: boolean
): Promise<{ message: string; url: string }> {
  const res = await fetch(`${BASE_URL}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      codec,
      video_resolution: videoResolution,
      use_wrapper: useWrapper,
    }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to submit download')
  }
  return res.json()
}


// 获取下载队列运行状态
export async function gtstts(): Promise<DownloadStatus> {
  const res = await fetch(`${BASE_URL}/status`)
  if (!res.ok) throw new Error('Failed to fetch status')
  return res.json()
}


// 获取系统各模块健康探针状态
export async function gthlth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE_URL}/health`)
  if (!res.ok) throw new Error('Failed to fetch health status')
  return res.json()
}


// 保存Netscape格式Cookies文本
export async function svcks(content: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/cookies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to save cookies')
  }
  return res.json()
}


// 完成WebView登录并写入Cookies
export async function fnllgn(payload: {
  profile_hint?: string
  started_at_ms?: number
}): Promise<CookieLoginFinalizeResponse> {
  const res = await fetch(`${BASE_URL}/cookie-login/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to finalize cookie login')
  }
  return res.json()
}


// 探测WebView登录认证状态
export async function prblgn(payload: {
  profile_hint?: string
  started_at_ms?: number
}): Promise<CookieLoginProbeResponse> {
  const res = await fetch(`${BASE_URL}/cookie-login/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to probe cookie login')
  }
  return res.json()
}


// 获取客户端全部设置字典
export async function gtstngs(): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/settings`)
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}


// 更新客户端设置配置项
export async function svstngs(settings: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('Failed to save settings')
  return res.json()
}


// 获取全量下载历史列表
export async function gthstry(): Promise<HistoryItem[]> {
  const res = await fetch(`${BASE_URL}/history`)
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}


// 删除指定历史记录
export async function dlthstry(trackId: string, deleteFile: boolean = false): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/history/${trackId}?delete_file=${deleteFile}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete history')
  return res.json()
}


// 获取搜索推荐热词列表
export async function gtrecmdtn(): Promise<{ success: boolean; recommendations: string[] }> {
  const res = await fetch(`${BASE_URL}/recommendations`)
  if (!res.ok) throw new Error('Failed to fetch recommendations')
  return res.json()
}


// 上报搜索关键词记录
export async function rprtsrch(keyword: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/recommendations/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword }),
  })
  if (!res.ok) throw new Error('Failed to report search')
  return res.json()
}


// 构造本地音频播放流地址
export const getLocalPlayUrl = (trackId: string) => `${BASE_URL}/local-play/${encodeURIComponent(trackId)}`


// 构造本地封面图资源地址
export const getLocalArtworkUrl = (trackId: string) => `${BASE_URL}/local-artwork/${encodeURIComponent(trackId)}`


// 打开下载目标文件目录
export async function opnfldr(path?: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/open-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error('Failed to open folder')
  return res.json()
}


// 打开转码输出文件目录
export async function opncnvtfldr(): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/open-converted-folder`, {
    method: 'POST',
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to open converted folder')
  }
  return res.json()
}


// 触发本地音乐目录重扫描
export async function scnlcl(): Promise<ScanLocalResponse> {
  const res = await fetch(`${BASE_URL}/scan-local`, {
    method: 'POST',
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to scan local music files')
  }
  return res.json()
}


// 获取本地伴随LRC歌词内容
export async function gtlcllrc(trackId: string): Promise<LocalLyricsResponse> {
  const res = await fetch(`${BASE_URL}/local-lyrics/${encodeURIComponent(trackId)}`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to load local lyrics')
  }
  return res.json()
}


// 请求WSL2安装环境预检信息
export async function wslprchk(): Promise<Wsl2InstallPrecheckResponse> {
  const res = await fetch(`${BASE_URL}/wsl2/install/precheck`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to check WSL2 install prerequisites')
  }
  return res.json()
}


// 启动WSL2自动化安装任务
export async function wslstrt(payload?: {
  required_gb?: number
}): Promise<Wsl2InstallStartResponse> {
  const res = await fetch(`${BASE_URL}/wsl2/install/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to start WSL2 installation')
  }
  return res.json()
}


// 轮询WSL2安装进度状态
export async function wslstts(): Promise<Wsl2InstallStatusResponse> {
  const res = await fetch(`${BASE_URL}/wsl2/install/status`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to fetch WSL2 installation status')
  }
  return res.json()
}


// 请求Wrapper部署前预检信息
export async function wrprprchk(): Promise<WrapperSetupPrecheckResponse> {
  const res = await fetch(`${BASE_URL}/wrapper/setup/precheck`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to check Wrapper setup prerequisites')
  }
  return res.json()
}


// 启动Wrapper自动部署与登录流程
export async function wrprstrt(payload?: {
  force_restart?: boolean
}): Promise<WrapperSetupStartResponse> {
  const res = await fetch(`${BASE_URL}/wrapper/setup/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to start Wrapper setup')
  }
  return res.json()
}


// 轮询Wrapper部署与登录运行状态
export async function wrprstts(): Promise<WrapperSetupStatusResponse> {
  const res = await fetch(`${BASE_URL}/wrapper/setup/status`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to fetch Wrapper setup status')
  }
  return res.json()
}


// 提交Wrapper账号密码或2FA验证码
export async function wrprint(payload: {
  input_type: 'credentials' | '2fa'
  apple_id?: string
  password?: string
  code?: string
}): Promise<WrapperSetupInputResponse> {
  const res = await fetch(`${BASE_URL}/wrapper/setup/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to submit Wrapper input')
  }
  return res.json()
}


// 兼容性别名导出
export const searchAppleMusic = srchapl
export const submitDownload = sbmtdwnld
export const getStatus = gtstts
export const getHealth = gthlth
export const saveCookies = svcks
export const finalizeCookieLogin = fnllgn
export const probeCookieLogin = prblgn
export const getSettingsApi = gtstngs
export const saveSettingsApi = svstngs
export const getHistoryApi = gthstry
export const deleteHistoryApi = dlthstry
export const getRecommendationsApi = gtrecmdtn
export const reportSearchApi = rprtsrch
export const openFolderApi = opnfldr
export const openConvertedFolderApi = opncnvtfldr
export const scanLocalApi = scnlcl
export const getLocalLyricsApi = gtlcllrc
export const getWsl2InstallPrecheckApi = wslprchk
export const startWsl2InstallApi = wslstrt
export const getWsl2InstallStatusApi = wslstts
export const getWrapperSetupPrecheckApi = wrprprchk
export const startWrapperSetupApi = wrprstrt
export const getWrapperSetupStatusApi = wrprstts
export const submitWrapperSetupInputApi = wrprint
