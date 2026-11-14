// LyricsPanel组件
import { IcBtn } from '../ui/components'
import { Dvd, HStk, Icn, Txt, VStk } from '../ui/primitives'
import type { AppStore } from '../app/useAppStore'

// LyricsPanel组件渲染入口
export function LyrPnl({ store }: { store: AppStore }) {
  const {
    activeDisplayLyricIndex, displayLyricsLines, lyricTrackOffset, lyricsOpen, lyricsSource, setlyr, playingTrack, setLyricsOpen,
  } = store

  if (!lyricsOpen) return null

  return (
    <div className="lyrics-panel">
      <HStk justify="space-between" align="center" style={{ marginBottom: '12px' }}>
        <Txt weight={700}>歌词同步显示</Txt>
        <IcBtn onClick={() => setLyricsOpen(false)} size={30}>
          <Icn name="close" size={14} />
        </IcBtn>
      </HStk>
      <Dvd />
      <div className="lyrics-content">
        {playingTrack ? (
          <VStk gap="normal" align="center" style={{ width: '100%' }}>
            <Txt tone="secondary" style={{ fontSize: '0.88rem' }}>
              {playingTrack.attributes.name} - {playingTrack.attributes.artistName}
            </Txt>
            {(lyricsSource === 'local' || lyricsSource === 'preview') && displayLyricsLines.length > 0 && (
              <div className="lyrics-stage" ref={setlyr}>
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
              <VStk gap="compact" align="center">
                <Txt tone="secondary" style={{ fontSize: '0.9rem' }}>当前音轨暂无可显示歌词</Txt>
              </VStk>
            )}
            {lyricsSource === 'none' && (
              <VStk gap="compact" align="center">
                <Txt tone="secondary" style={{ fontSize: '0.9rem' }}>未找到本地歌词文件（.lrc）</Txt>
              </VStk>
            )}
          </VStk>
        ) : (
          <VStk gap="normal" align="center">
            <Icn name="lyrics" size={42} style={{ color: 'var(--text-secondary)' }} />
            <Txt tone="secondary" style={{ fontSize: '0.9rem' }}>暂无播放预览音轨</Txt>
          </VStk>
        )}
      </div>
    </div>
  )
}
