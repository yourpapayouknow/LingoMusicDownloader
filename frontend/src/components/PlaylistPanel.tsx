// PlaylistPanel组件
import { Badge, Button, Card, IconButton } from '../ui/components'
import { Divider, HStack, Icon, Image, Text, VStack } from '../ui/primitives'
import { gtarturl } from '../utils/format'
import type { AppStore } from '../app/useAppStore'

// PlaylistPanel组件渲染入口
export function PlaylistPanel({ store }: { store: AppStore }) {
  const {
    clearPlaylistEntries, currentPlaylistKey, playPlaylistEntryByKey, playlistEntries, playlistOpen, removePlaylistEntry, setPlaylistOpen,
  } = store

  if (!playlistOpen) return null

  return (
    <div className="playlist-panel">
      <HStack justify="space-between" align="center" style={{ marginBottom: '12px' }}>
        <Text weight={700}>播放列表 ({playlistEntries.length})</Text>
        <HStack gap="compact" align="center">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearPlaylistEntries}
            disabled={playlistEntries.length === 0}
          >
            清空列表
          </Button>
          <IconButton onClick={() => setPlaylistOpen(false)} size={30}>
            <Icon name="close" size={14} />
          </IconButton>
        </HStack>
      </HStack>
      <Divider />
      <div className="playlist-content">
        {playlistEntries.length === 0 ? (
          <VStack gap="normal" align="center" style={{ marginTop: '42px' }}>
            <Icon name="playlist" size={42} style={{ color: 'var(--text-secondary)' }} />
            <Text tone="secondary" style={{ fontSize: '0.9rem' }}>
              还没有曲目，先播放或添加本地歌曲吧
            </Text>
          </VStack>
        ) : (
          <VStack gap="compact">
            {playlistEntries.map((entry, index) => {
              const isCurrent = entry.key === currentPlaylistKey
              return (
                <Card
                  key={entry.key}
                  className={isCurrent ? 'playlist-item-card is-current' : 'playlist-item-card'}
                >
                  <HStack justify="space-between" align="center" gap="normal">
                    <HStack align="center" gap="compact" style={{ minWidth: 0, flex: 1 }}>
                      <Image
                        src={gtarturl(entry.artworkUrl, 96)}
                        alt={entry.title}
                        radius={6}
                        style={{ width: '44px', height: '44px', flexShrink: 0 }}
                      />
                      <VStack gap={2} style={{ minWidth: 0, flex: 1 }}>
                        <Text weight={700} style={{ fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {index + 1}. {entry.title}
                        </Text>
                        <HStack gap="compact" align="center">
                          <Text tone="secondary" style={{ fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.artistName}
                          </Text>
                          <Badge tone={entry.source === 'local' ? 'success' : 'info'}>
                            {entry.source === 'local' ? '本地' : '试听'}
                          </Badge>
                          {isCurrent && <Badge tone="default">正在播放</Badge>}
                        </HStack>
                      </VStack>
                    </HStack>
                    <HStack gap="compact">
                      <IconButton
                        variant={isCurrent ? 'primary' : 'secondary'}
                        size={28}
                        onClick={() => playPlaylistEntryByKey(entry.key)}
                        title="播放"
                      >
                        <Icon name="play" size={12} filled={isCurrent} />
                      </IconButton>
                      <IconButton
                        variant="ghost"
                        size={28}
                        onClick={() => removePlaylistEntry(entry.key)}
                        title="移出列表"
                      >
                        <Icon name="trash" size={12} style={{ color: 'var(--system-error)' }} />
                      </IconButton>
                    </HStack>
                  </HStack>
                </Card>
              )
            })}
          </VStack>
        )}
      </div>
    </div>
  )
}
