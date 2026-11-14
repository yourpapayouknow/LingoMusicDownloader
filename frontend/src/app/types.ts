// 前端应用共享状态类型定义

// 主导航标签
export type TabKey = 'search' | 'download' | 'settings' | 'about'

// 搜索结果筛选分类
export type SearchFilter = 'all' | 'songs' | 'albums' | 'artists' | 'music-videos'

// 应用内确认弹窗配置
export type ConfirmPrompt = {
  title: string
  description: string
  confirmText?: string
  tone?: 'primary' | 'error'
  onConfirm: () => void | Promise<void>
}

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