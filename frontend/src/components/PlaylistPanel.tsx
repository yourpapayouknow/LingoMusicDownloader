// PlaylistPanel组件
import { Bdg, Btn, Crd, IcBtn } from '../ui/components'
import { Dvd, HStk, Icn, Img, Txt, VStk } from '../ui/primitives'
import { gtarturl } from '../utils/format'
import type { AppStore } from '../app/useAppStore'

// PlaylistPanel组件渲染入口
export function PlsPnl({ store }: { store: AppStore }) {
  const {
    clrplen, currentPlaylistKey, plplkey, playlistEntries, playlistOpen, rmplent, setPlaylistOpen,
  } = store

  if (!playlistOpen) return null

  return (
    <div className="playlist-panel">
      <HStk justify="space-between" align="center" style={{ marginBottom: '12px' }}>
        <Txt weight={700}>播放列表 ({playlistEntries.length})</Txt>
        <HStk gap="compact" align="center">
          <Btn
            variant="ghost"
            size="sm"
            onClick={clrplen}
            disabled={playlistEntries.length === 0}
          >
            清空列表
          </Btn>
          <IcBtn onClick={() => setPlaylistOpen(false)} size={30}>
            <Icn name="close" size={14} />
          </IcBtn>
        </HStk>
      </HStk>
      <Dvd />
      <div className="playlist-content">
        {playlistEntries.length === 0 ? (
          <VStk gap="normal" align="center" style={{ marginTop: '42px' }}>
            <Icn name="playlist" size={42} style={{ color: 'var(--text-secondary)' }} />
            <Txt tone="secondary" style={{ fontSize: '0.9rem' }}>
              还没有曲目，先播放或添加本地歌曲吧
            </Txt>
          </VStk>
        ) : (
          <VStk gap="compact">
            {playlistEntries.map((entry, index) => {
              const isCurrent = entry.key === currentPlaylistKey
              return (
                <Crd
                  key={entry.key}
                  className={isCurrent ? 'playlist-item-card is-current' : 'playlist-item-card'}
                >
                  <HStk justify="space-between" align="center" gap="normal">
                    <HStk align="center" gap="compact" style={{ minWidth: 0, flex: 1 }}>
                      <Img
                        src={gtarturl(entry.artworkUrl, 96)}
                        alt={entry.title}
                        radius={6}
                        style={{ width: '44px', height: '44px', flexShrink: 0 }}
                      />
                      <VStk gap={2} style={{ minWidth: 0, flex: 1 }}>
                        <Txt weight={700} style={{ fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {index + 1}. {entry.title}
                        </Txt>
                        <HStk gap="compact" align="center">
                          <Txt tone="secondary" style={{ fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.artistName}
                          </Txt>
                          <Bdg tone={entry.source === 'local' ? 'success' : 'info'}>
                            {entry.source === 'local' ? '本地' : '试听'}
                          </Bdg>
                          {isCurrent && <Bdg tone="default">正在播放</Bdg>}
                        </HStk>
                      </VStk>
                    </HStk>
                    <HStk gap="compact">
                      <IcBtn
                        variant={isCurrent ? 'primary' : 'secondary'}
                        size={28}
                        onClick={() => plplkey(entry.key)}
                        title="播放"
                      >
                        <Icn name="play" size={12} filled={isCurrent} />
                      </IcBtn>
                      <IcBtn
                        variant="ghost"
                        size={28}
                        onClick={() => rmplent(entry.key)}
                        title="移出列表"
                      >
                        <Icn name="trash" size={12} style={{ color: 'var(--system-error)' }} />
                      </IcBtn>
                    </HStk>
                  </HStk>
                </Crd>
              )
            })}
          </VStk>
        )}
      </div>
    </div>
  )
}
