// 通用格式化与文本解析工具模块

export interface LrcLine {
  time: number
  text: string
}

// 格式化专辑封面图URL
export function gtarturl(url?: string, size = 150): string {
  if (!url) return 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150'
  return url.replace('{w}', String(size)).replace('{h}', String(size))
}

// 格式化秒数为分秒展示字符串
export function fmttm(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// 规范化音频编码分类标签
export function nrmlcdclbl(rawCodec?: string): string {
  const value = (rawCodec || '').trim().toLowerCase()
  if (!value) return 'aac'
  if (value.includes('alac')) return 'alac'
  if (value.includes('atmos') || value.includes('dolby') || value === 'ec-3' || value === 'eac3' || value === 'ac-3' || value === 'ac3') return 'dolby'
  if (value.includes('aac') || value.includes('mp4a')) return 'aac'
  return value
}

// 计算父级目录路径
export function gtprntpth(path?: string): string {
  if (!path) return ''
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (index <= 0) return path
  return path.slice(0, index)
}

// 解析LRC歌词文本为时间轴与纯文本行
export function prslrc(content: string): { timed: LrcLine[]; plain: string[] } {
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

// 提取异常对象的可读消息
export function gterrmsg(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
