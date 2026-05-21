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

export async function searchAppleMusic(term: string): Promise<SearchResponse> {
  const res = await fetch(`${BASE_URL}/search?term=${encodeURIComponent(term)}`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to search Apple Music')
  }
  return res.json()
}

export async function submitDownload(
  url: string,
  codec: string,
  videoResolution: string,
  useWrapper: boolean
): Promise<{ message: string; url: string }> {
  const res = await fetch(`${BASE_URL}/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

export async function getStatus(): Promise<DownloadStatus> {
  const res = await fetch(`${BASE_URL}/status`)
  if (!res.ok) {
    throw new Error('Failed to fetch status')
  }
  return res.json()
}

export async function getHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE_URL}/health`)
  if (!res.ok) {
    throw new Error('Failed to fetch health status')
  }
  return res.json()
}

export async function saveCookies(content: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/cookies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to save cookies')
  }
  return res.json()
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

export async function finalizeCookieLogin(payload: {
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

export interface CookieLoginProbeResponse {
  success: boolean
  message: string
  login_detected: boolean
  cookies_count: number
  has_media_user_token: boolean
  source_db?: string
}

export async function probeCookieLogin(payload: {
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

// --- New Backend Integration APIs ---

export interface HistoryItem {
  id: number;
  track_id: string;
  name: string;
  artist_name: string;
  album_name: string;
  artwork_url: string;
  codec: string;
  file_path: string;
  lyrics_path?: string;
  file_size: number;
  download_time: string;
}

export async function getSettingsApi(): Promise<Record<string, any>> {
  const res = await fetch(`${BASE_URL}/settings`)
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export async function saveSettingsApi(settings: Record<string, any>): Promise<any> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('Failed to save settings')
  return res.json()
}

export async function getHistoryApi(): Promise<HistoryItem[]> {
  const res = await fetch(`${BASE_URL}/history`)
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

export async function deleteHistoryApi(trackId: string, deleteFile: boolean = false): Promise<any> {
  const res = await fetch(`${BASE_URL}/history/${trackId}?delete_file=${deleteFile}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to delete history')
  return res.json()
}

export async function getRecommendationsApi(): Promise<{ success: boolean; recommendations: string[] }> {
  const res = await fetch(`${BASE_URL}/recommendations`)
  if (!res.ok) throw new Error('Failed to fetch recommendations')
  return res.json()
}

export async function reportSearchApi(keyword: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/recommendations/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword }),
  })
  if (!res.ok) throw new Error('Failed to report search')
  return res.json()
}

export const getLocalPlayUrl = (trackId: string) => `${BASE_URL}/local-play/${encodeURIComponent(trackId)}`
export const getLocalArtworkUrl = (trackId: string) => `${BASE_URL}/local-artwork/${encodeURIComponent(trackId)}`

export async function openFolderApi(path?: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/open-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error('Failed to open folder')
  return res.json()
}

export async function openConvertedFolderApi(): Promise<any> {
  const res = await fetch(`${BASE_URL}/open-converted-folder`, {
    method: 'POST',
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to open converted folder')
  }
  return res.json()
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

export async function scanLocalApi(): Promise<ScanLocalResponse> {
  const res = await fetch(`${BASE_URL}/scan-local`, {
    method: 'POST',
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to scan local music files')
  }
  return res.json()
}

export interface LocalLyricsResponse {
  success: boolean
  track_id: string
  path: string
  content: string
}

export async function getLocalLyricsApi(trackId: string): Promise<LocalLyricsResponse> {
  const res = await fetch(`${BASE_URL}/local-lyrics/${encodeURIComponent(trackId)}`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to load local lyrics')
  }
  return res.json()
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

export async function getWsl2InstallPrecheckApi(): Promise<Wsl2InstallPrecheckResponse> {
  const res = await fetch(`${BASE_URL}/wsl2/install/precheck`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to check WSL2 install prerequisites')
  }
  return res.json()
}

export async function startWsl2InstallApi(payload?: {
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

export async function getWsl2InstallStatusApi(): Promise<Wsl2InstallStatusResponse> {
  const res = await fetch(`${BASE_URL}/wsl2/install/status`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to fetch WSL2 installation status')
  }
  return res.json()
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

export async function getWrapperSetupPrecheckApi(): Promise<WrapperSetupPrecheckResponse> {
  const res = await fetch(`${BASE_URL}/wrapper/setup/precheck`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to check Wrapper setup prerequisites')
  }
  return res.json()
}

export async function startWrapperSetupApi(payload?: {
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

export async function getWrapperSetupStatusApi(): Promise<WrapperSetupStatusResponse> {
  const res = await fetch(`${BASE_URL}/wrapper/setup/status`)
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Failed to fetch Wrapper setup status')
  }
  return res.json()
}

export async function submitWrapperSetupInputApi(payload: {
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
