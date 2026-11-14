// 前端应用共享状态类型定义

// 主导航标签
export type TabKey = 'search' | 'download' | 'settings' | 'about'

// 本地下载队列条目
export interface QueueItem {
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

// 播放列表条目
export interface PlaylistEntry {
  key: string
  source: 'preview' | 'local'
  title: string
  artistName: string
  artworkUrl: string
  previewUrl?: string
  trackId?: string
  searchTrackId?: string
}