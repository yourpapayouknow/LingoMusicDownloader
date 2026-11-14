// 前端应用共享纯函数
import type { SearchResult } from '../utils/api'

const RESULT_TYPE_LABEL_MAP: Record<string, string> = {
  songs: '曲目',
  albums: '专辑',
  artists: '歌手',
  'music-videos': 'MV',
}

const RESULT_CATEGORY_ORDER = ['songs', 'albums', 'artists', 'music-videos']

// 获取搜索结果类型标签
export function gtrslbl(type: string): string {
  return RESULT_TYPE_LABEL_MAP[type] || '其他'
}

// 按固定分类顺序合并搜索结果并去重
export function bldsrls(results: Record<string, { data: SearchResult[] }>): SearchResult[] {
  const ordered: SearchResult[] = []
  const seen = new Set<string>()
  const known = new Set(RESULT_CATEGORY_ORDER)

  const pshls = (items: SearchResult[]) => {
    for (const item of items) {
      const key = `${item.type}:${item.id}`
      if (!seen.has(key)) {
        seen.add(key)
        ordered.push(item)
      }
    }
  }

  for (const category of RESULT_CATEGORY_ORDER) {
    pshls(results[category]?.data || [])
  }

  for (const [category, bucket] of Object.entries(results)) {
    if (known.has(category)) continue
    pshls(bucket?.data || [])
  }

  return ordered
}