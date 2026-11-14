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

// 安装阶段英文标识映射为中文
const STAGE_LABELS: Record<string, string> = {
  idle: '空闲',
  queued: '排队',
  precheck: '预检查',
  'download-wrapper': '下载解密组件',
  'start-wrapper': '启动解密组件',
  'restart-wrapper': '重启解密组件',
  'await-credentials': '等待账号',
  'await-2fa': '等待验证码',
  'auth-credentials': '提交账号',
  'auth-2fa': '提交验证码',
  'check-wsl': '检查WSL2',
  'install-ubuntu': '安装Ubuntu',
  'configure-root': '配置用户',
  'health-check': '健康检查',
  'request-elevation': '请求管理员权限',
  'running-elevated': '管理员安装中',
  completed: '已完成',
  failed: '失败',
}

// 获取安装阶段中文标签
export function stglbl(stage: string): string {
  return STAGE_LABELS[stage] || stage || '空闲'
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