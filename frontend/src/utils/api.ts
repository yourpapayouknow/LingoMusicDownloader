// 后端RESTful API网络请求客户端与类型定义模块
const BASE_URL = 'http://127.0.0.1:8000/api'

export interface DownloadItem {
  status: 'pending' | 'downloading' | 'completed' | 'error'
  error?: string
  hint?: string
  track_id?: string
  name?: string
  artist_name?: string
  album_name?: string
  artwork_url?: string
  file_path?: string
  lyrics_path?: string
  file_size?: number
  already_exists?: boolean
}

export interface DownloadQueueItem {
  status: 'pending' | 'downloading' | 'processing' | 'completed' | 'error'
  error?: string
  hint?: string
  warning?: string
  codec?: string
  resolution?: string
  file_path?: string
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
  account_storefront?: string
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
    previews?: Array<{ url: string }>
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


// 通用JSON请求辅助方法
async function reqjson<T>(url: string, init?: RequestInit, fallbackMsg: string = 'Request failed'): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error((errorData as { detail?: string }).detail || fallbackMsg)
  }
  return res.json() as Promise<T>
}

// 通用POST JSON请求辅助方法
function postjson<T>(url: string, body?: unknown, fallbackMsg: string = 'Request failed'): Promise<T> {
  return reqjson<T>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    fallbackMsg
  )
}


// 请求Apple Music曲库关键词检索
export async function srchapl(term: string): Promise<SearchResponse> {
  return reqjson<SearchResponse>(`${BASE_URL}/search?term=${encodeURIComponent(term)}`, undefined, 'Failed to search Apple Music')
}


// 投递音频下载请求
export async function sbmtdwnld(
  url: string,
  codec: string,
  videoResolution: string,
  useWrapper: boolean,
  metadataRegion?: string
): Promise<{ message: string; url: string }> {
  return postjson<{ message: string; url: string }>(
    `${BASE_URL}/download`,
    {
      url,
      codec,
      video_resolution: videoResolution,
      use_wrapper: useWrapper,
      metadata_region: metadataRegion,
    },
    'Failed to submit download'
  )
}


// 获取下载队列运行状态
export async function gtstts(): Promise<DownloadStatus> {
  return reqjson<DownloadStatus>(`${BASE_URL}/status`, undefined, 'Failed to fetch status')
}


// 获取系统各模块健康探针状态
export async function gthlth(): Promise<HealthStatus> {
  return reqjson<HealthStatus>(`${BASE_URL}/health`, undefined, 'Failed to fetch health status')
}


// 保存Netscape格式Cookies文本
export async function svcks(content: string): Promise<{ success: boolean; message: string }> {
  return postjson<{ success: boolean; message: string }>(`${BASE_URL}/cookies`, { content }, 'Failed to save cookies')
}


// 完成WebView登录并写入Cookies
export async function fnllgn(payload: {
  profile_hint?: string
  started_at_ms?: number
}): Promise<CookieLoginFinalizeResponse> {
  return postjson<CookieLoginFinalizeResponse>(`${BASE_URL}/cookie-login/finalize`, payload, 'Failed to finalize cookie login')
}




// 获取客户端全部设置字典
export async function gtstngs(): Promise<Record<string, unknown>> {
  return reqjson<Record<string, unknown>>(`${BASE_URL}/settings`, undefined, 'Failed to fetch settings')
}


// 更新客户端设置配置项
export async function svstngs(settings: Record<string, unknown>): Promise<unknown> {
  return postjson<unknown>(`${BASE_URL}/settings`, settings, 'Failed to save settings')
}


// 获取全量下载历史列表
export async function gthstry(): Promise<HistoryItem[]> {
  return reqjson<HistoryItem[]>(`${BASE_URL}/history`, undefined, 'Failed to fetch history')
}


// 删除指定历史记录
export async function dlthstry(trackId: string, deleteFile: boolean = false): Promise<unknown> {
  return reqjson<unknown>(
    `${BASE_URL}/history/${encodeURIComponent(trackId)}?delete_file=${deleteFile}`,
    { method: 'DELETE' },
    'Failed to delete history'
  )
}


// 获取搜索推荐热词列表
export async function gtrecmdtn(): Promise<{ success: boolean; recommendations: string[] }> {
  return reqjson<{ success: boolean; recommendations: string[] }>(`${BASE_URL}/recommendations`, undefined, 'Failed to fetch recommendations')
}


// 上报搜索关键词记录
export async function rprtsrch(keyword: string): Promise<unknown> {
  return postjson<unknown>(`${BASE_URL}/recommendations/report`, { keyword }, 'Failed to report search')
}


// 构造本地音频播放流地址
export const gtlclurl = (trackId: string) => `${BASE_URL}/local-play/${encodeURIComponent(trackId)}`


// 构造本地封面图资源地址
export const gtlclart = (trackId: string) => `${BASE_URL}/local-artwork/${encodeURIComponent(trackId)}`


// 打开下载目标文件目录
export async function opnfldr(path?: string): Promise<unknown> {
  return postjson<unknown>(`${BASE_URL}/open-folder`, { path }, 'Failed to open folder')
}


// 打开转码输出文件目录
export async function opncnvtfldr(): Promise<unknown> {
  return postjson<unknown>(`${BASE_URL}/open-converted-folder`, undefined, 'Failed to open converted folder')
}


// 触发本地音乐目录重扫描
export async function scnlcl(): Promise<ScanLocalResponse> {
  return postjson<ScanLocalResponse>(`${BASE_URL}/scan-local`, undefined, 'Failed to scan local music files')
}


// 获取本地伴随LRC歌词内容
export async function gtlcllrc(trackId: string): Promise<LocalLyricsResponse> {
  return reqjson<LocalLyricsResponse>(`${BASE_URL}/local-lyrics/${encodeURIComponent(trackId)}`, undefined, 'Failed to load local lyrics')
}


// 请求WSL2安装环境预检信息
export async function wslprchk(): Promise<Wsl2InstallPrecheckResponse> {
  return reqjson<Wsl2InstallPrecheckResponse>(`${BASE_URL}/wsl2/install/precheck`, undefined, 'Failed to check WSL2 install prerequisites')
}


// 启动WSL2自动化安装任务
export async function wslstrt(payload?: {
  required_gb?: number
}): Promise<Wsl2InstallStartResponse> {
  return postjson<Wsl2InstallStartResponse>(`${BASE_URL}/wsl2/install/start`, payload || {}, 'Failed to start WSL2 installation')
}


// 轮询WSL2安装进度状态
export async function wslstts(): Promise<Wsl2InstallStatusResponse> {
  return reqjson<Wsl2InstallStatusResponse>(`${BASE_URL}/wsl2/install/status`, undefined, 'Failed to fetch WSL2 installation status')
}


// 请求Wrapper部署前预检信息
export async function wrprprchk(): Promise<WrapperSetupPrecheckResponse> {
  return reqjson<WrapperSetupPrecheckResponse>(`${BASE_URL}/wrapper/setup/precheck`, undefined, 'Failed to check Wrapper setup prerequisites')
}


// 启动Wrapper自动部署与登录流程
export async function wrprstrt(payload?: {
  force_restart?: boolean
}): Promise<WrapperSetupStartResponse> {
  return postjson<WrapperSetupStartResponse>(`${BASE_URL}/wrapper/setup/start`, payload || {}, 'Failed to start Wrapper setup')
}


// 轮询Wrapper部署与登录运行状态
export async function wrprstts(): Promise<WrapperSetupStatusResponse> {
  return reqjson<WrapperSetupStatusResponse>(`${BASE_URL}/wrapper/setup/status`, undefined, 'Failed to fetch Wrapper setup status')
}


// 提交Wrapper账号密码或2FA验证码
export async function wrprint(payload: {
  input_type: 'credentials' | '2fa'
  apple_id?: string
  password?: string
  code?: string
}): Promise<WrapperSetupInputResponse> {
  return postjson<WrapperSetupInputResponse>(`${BASE_URL}/wrapper/setup/input`, payload, 'Failed to submit Wrapper input')
}


