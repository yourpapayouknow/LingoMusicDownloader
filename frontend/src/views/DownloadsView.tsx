// DownloadsView组件
import { Badge, Button, Card, IconButton, Spinner } from '../ui/components'
import { Box, HStack, Heading, Icon, Image, Text, VStack } from '../ui/primitives'
import { dlthstry, gthstry, gtlclart, opncnvtfldr, opnfldr } from '../utils/api'
import { gterrmsg, nrmlcdclbl } from '../utils/format'
import type { AppStore } from '../app/useAppStore'
import type { QueueItem } from '../app/types'

// DownloadsView组件渲染入口
export function DownloadsView({ store }: { store: AppStore }) {
  const {
    addLocalTrackToPlaylist, deleteQueueItem, deletingHistoryGroupId, downloadHistory, downloadQueue, handleAddHistoryTrackToPlaylist, handleAddQueueItemToPlaylist, handleDeleteHistoryGroup, historyAlbumGroups, isPlaying, openAlbums, openHistoryAlbums, playLocalTrack, playingTrack, pushToast, scanningLocal, setDownloadHistory, setOpenAlbums, setOpenHistoryAlbums, startLocalPlayback, triggerLocalScan,
  } = store

  return (
    <VStack gap="normal">
      {/* Header Folder Trigger Button */}
      <HStack justify="flex-start" gap="compact">
        <Button
          variant="secondary"
          leadingIcon={<Icon name="folder" size={15} />}
          onClick={() => {
            opnfldr().catch((err) => pushToast('打开目录失败', gterrmsg(err) || '无法打开目录', 'error'))
          }}
        >
          打开下载文件夹
        </Button>
        <Button
          variant="secondary"
          leadingIcon={<Icon name="search" size={15} />}
          onClick={triggerLocalScan}
          disabled={scanningLocal}
        >
          {scanningLocal ? '扫描中...' : '扫描歌曲'}
        </Button>
        <Button
          variant="secondary"
          leadingIcon={<Icon name="folder" size={15} />}
          onClick={() => {
            opncnvtfldr().catch((err) => pushToast('打开目录失败', gterrmsg(err) || '无法打开转换目录', 'error'))
          }}
        >
          打开转换文件夹
        </Button>
      </HStack>

      <VStack gap="compact">
        <Heading level={3}>任务列表</Heading>
        {downloadQueue.length === 0 ? (
          <Card style={{ paddingBlock: '32px' }}>
            <VStack align="center" gap="normal">
              <Icon name="download" size={24} style={{ color: 'var(--text-secondary)' }} />
              <Text tone="secondary">下载列表为空，快前往搜索页面搜索吧！</Text>
            </VStack>
          </Card>
        ) : (
          <VStack gap="compact">
            {downloadQueue.map((item) => {
              const isCompleted = item.status === 'completed'
              const isErr = item.status === 'error'
              const isDownloading = item.status === 'downloading'
              const isAlbum = item.type === 'album'
              const isAlbumOpen = openAlbums[item.id]

              return (
                <Card key={item.id} style={{ borderLeft: isErr ? '4px solid var(--system-error)' : undefined }}>
                  <VStack gap="compact">
                    <HStack justify="space-between" align="center">
                      {/* Left side Cover and title */}
                      <HStack gap="normal" align="center" style={{ minWidth: 0, flex: 1 }}>
                        <Image
                          src={item.cover}
                          alt={item.title}
                          radius={6}
                          style={{ width: '48px', height: '48px', flexShrink: 0 }}
                        />
                        <VStack gap={2} style={{ minWidth: 0 }}>
                          <Text weight={700} style={{ fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </Text>
                          <HStack gap="compact" align="center">
                            <Text tone="secondary" style={{ fontSize: '0.76rem' }}>
                              {isAlbum
                                ? `专辑曲目: ${item.tracks?.length || 0} 首`
                                : `曲目ID: ${item.trackId || item.id}`}
                            </Text>
                            <Badge tone={isCompleted ? 'success' : isErr ? 'error' : 'info'}>
                              {item.quality}
                            </Badge>
                          </HStack>
                        </VStack>
                      </HStack>

                      {/* Right side operations */}
                      <HStack gap="compact" align="center">
                        {isDownloading && (
                          <HStack gap="compact" align="center">
                            <Spinner size={16} />
                            <Text tone="secondary" style={{ fontSize: '0.8rem' }}>正在下...</Text>
                          </HStack>
                        )}

                        {isErr && (
                          <HStack gap="compact" align="center">
                            <Icon name="alert" size={16} style={{ color: 'var(--system-error)' }} />
                            <IconButton
                              variant="ghost"
                              size={32}
                              onClick={() => deleteQueueItem(item.id)}
                              title="删除任务"
                            >
                              <Icon name="trash" size={15} style={{ color: 'var(--system-error)' }} />
                            </IconButton>
                          </HStack>
                        )}

                        {isCompleted && (
                          <HStack gap="compact">
                            {isAlbum && (
                              <Button
                                variant="ghost"
                                size="sm"
                                trailingIcon={<Icon name="chevronDown" size={12} style={{ transform: isAlbumOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                                onClick={() => setOpenAlbums(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                              >
                                {isAlbumOpen ? '收起曲目' : '查看曲目'}
                              </Button>
                            )}
                            <IconButton
                              variant="ghost"
                              size={32}
                              onClick={() => {
                                opnfldr(item.file_path).catch((err) => pushToast('定位失败', gterrmsg(err) || '无法定位本地文件', 'error'))
                              }}
                              title="定位文件"
                            >
                              <Icon name="folder" size={14} />
                            </IconButton>
                            {item.type === 'track' && (
                              <>
                                <IconButton
                                  variant="secondary"
                                  size={32}
                                  onClick={() => playLocalTrack(item)}
                                  title="播放"
                                >
                                  <Icon name="play" size={14} filled={playingTrack?.id === (item.trackId || item.id) && isPlaying} />
                                </IconButton>
                                <IconButton
                                  variant="ghost"
                                  size={32}
                                  onClick={() => handleAddQueueItemToPlaylist(item)}
                                  title="添加到播放列表"
                                >
                                  <Icon name="plus" size={14} />
                                </IconButton>
                              </>
                            )}
                          </HStack>
                        )}
                      </HStack>
                    </HStack>

                    {/* Album Subtracks list */}
                    {isAlbum && isAlbumOpen && item.tracks && (
                      <div className="album-subtracks">
                        {item.tracks.map((track, i) => (
                          <div key={track.trackId || `${item.id}-${i}`} className="album-subtrack-item">
                            <HStack justify="space-between" align="center">
                              <Text style={{ fontSize: '0.84rem' }}>
                                {i + 1}. {track.artistName ? `${track.artistName} - ` : ''}{track.name}
                              </Text>
                              <HStack gap="compact">
                                <Badge tone={track.status === 'error' ? 'error' : track.status === 'completed' ? 'success' : 'info'}>
                                  {track.status === 'error' ? '失败' : track.status === 'completed' ? '已下载' : '下载中'}
                                </Badge>
                                <IconButton
                                  variant="ghost"
                                  size={26}
                                  onClick={() => {
                                    opnfldr(track.file_path || item.file_path).catch((err) => pushToast('定位失败', gterrmsg(err) || '无法定位本地文件', 'error'))
                                  }}
                                  title="定位文件"
                                >
                                  <Icon name="folder" size={11} />
                                </IconButton>
                                <IconButton
                                  variant="ghost"
                                  size={26}
                                  onClick={() => {
                                    const subTrackItem: QueueItem = {
                                      id: track.trackId || `${item.id}-${i}`,
                                      title: track.artistName ? `${track.artistName} - ${track.name}` : track.name,
                                      cover: track.cover || item.cover,
                                      quality: nrmlcdclbl(item.quality),
                                      status: 'completed',
                                      type: 'track',
                                      trackId: track.trackId,
                                      trackName: track.name,
                                      artistName: track.artistName,
                                      file_path: track.file_path || item.file_path,
                                    }
                                    playLocalTrack(subTrackItem)
                                  }}
                                  title="播放单曲"
                                  disabled={track.status !== 'completed'}
                                >
                                  <Icon name="play" size={11} filled={playingTrack?.id === track.trackId && isPlaying} />
                                </IconButton>
                                <IconButton
                                  variant="ghost"
                                  size={26}
                                  onClick={() => {
                                    if (!track.trackId) {
                                      pushToast('添加失败', '该曲目缺少 track_id，无法加入播放列表', 'error')
                                      return
                                    }
                                    addLocalTrackToPlaylist(
                                      track.trackId,
                                      {
                                        name: track.name,
                                        artistName: track.artistName || '未知艺术家',
                                        artworkUrl: track.cover || item.cover,
                                      },
                                      false
                                    )
                                    pushToast('已添加', `已加入播放列表：${track.name}`, 'success')
                                  }}
                                  title="添加到播放列表"
                                  disabled={track.status !== 'completed'}
                                >
                                  <Icon name="plus" size={11} />
                                </IconButton>
                              </HStack>
                            </HStack>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error Details */}
                    {isErr && item.errorDetails && (
                      <Box style={{ background: 'rgba(232, 17, 35, 0.08)', padding: '8px 12px', borderRadius: '4px', marginTop: '4px' }}>
                        <Text tone="error" style={{ fontSize: '0.78rem' }}>
                          故障详情: {item.errorDetails}
                        </Text>
                      </Box>
                    )}
                  </VStack>
                </Card>
              )
            })}
          </VStack>
        )}
      </VStack>

      {/* DOWNLOAD HISTORY */}
      <VStack gap="compact" style={{ marginTop: '16px' }}>
        <HStack justify="space-between" align="center">
          <Heading level={3}>历史已下载 ({downloadHistory.length})</Heading>
          <Button variant="ghost" size="sm" onClick={() => gthstry().then(res => setDownloadHistory(res))}>刷新</Button>
        </HStack>
        {historyAlbumGroups.length === 0 ? (
          <Text tone="secondary" style={{ fontSize: '0.85rem' }}>暂无历史下载记录</Text>
        ) : (
          <VStack gap="compact">
            {historyAlbumGroups.map((group) => {
              const isHistoryOpen = !!openHistoryAlbums[group.id]
              const firstTrack = group.tracks[0]

              return (
                <Card key={group.id}>
                  <VStack gap="compact">
                    <HStack justify="space-between" align="center">
                      <HStack gap="normal" align="center" style={{ minWidth: 0, flex: 1 }}>
                        <Image
                          src={group.cover}
                          alt={group.title}
                          radius={6}
                          style={{ width: '48px', height: '48px', flexShrink: 0 }}
                        />
                        <VStack gap={2} style={{ minWidth: 0 }}>
                          <Text weight={700} style={{ fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {group.title}
                          </Text>
                          <HStack gap="compact" align="center">
                            <Text tone="secondary" style={{ fontSize: '0.76rem' }}>
                              {group.artistName} · {group.tracks.length} 首
                            </Text>
                            <Badge tone="info">专辑</Badge>
                          </HStack>
                        </VStack>
                      </HStack>

                      <HStack gap="compact" align="center">
                        <Button
                          variant="ghost"
                          size="sm"
                          trailingIcon={<Icon name="chevronDown" size={12} style={{ transform: isHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                          onClick={() => setOpenHistoryAlbums(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                        >
                          {isHistoryOpen ? '收起曲目' : '查看曲目'}
                        </Button>
                        <IconButton
                          variant="ghost"
                          size={32}
                          onClick={() => handleDeleteHistoryGroup(group.id, group.title, group.tracks)}
                          title={group.tracks.length > 1 ? '删除整专' : '删除记录'}
                          disabled={deletingHistoryGroupId === group.id}
                        >
                          {deletingHistoryGroupId === group.id ? (
                            <Spinner size={14} />
                          ) : (
                            <Icon name="trash" size={14} style={{ color: 'var(--system-error)' }} />
                          )}
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          size={32}
                          onClick={() => {
                            opnfldr(group.folderPath || firstTrack?.file_path).catch((err) => pushToast('定位失败', gterrmsg(err) || '无法定位本地文件', 'error'))
                          }}
                          title="定位专辑目录"
                        >
                          <Icon name="folder" size={14} />
                        </IconButton>
                      </HStack>
                    </HStack>

                    {isHistoryOpen && (
                      <div className="album-subtracks">
                        {group.tracks.map((track, index) => (
                          <div key={track.id} className="album-subtrack-item">
                            <HStack justify="space-between" align="center">
                              <Text style={{ fontSize: '0.84rem' }}>
                                {index + 1}. {track.name}
                              </Text>
                              <HStack gap="compact">
                                <Badge tone="success">{nrmlcdclbl(track.codec)}</Badge>
                                <IconButton
                                  variant="secondary"
                                  size={26}
                                  onClick={() => {
                                    startLocalPlayback(
                                      track.track_id,
                                      { name: track.name, artistName: track.artist_name, artworkUrl: track.artwork_url || gtlclart(track.track_id) },
                                      true
                                    )
                                  }}
                                  title="本地播放"
                                >
                                  <Icon name="play" size={11} filled={playingTrack?.id === track.track_id && isPlaying} />
                                </IconButton>
                                <IconButton
                                  variant="ghost"
                                  size={26}
                                  onClick={() => handleAddHistoryTrackToPlaylist(track)}
                                  title="添加到播放列表"
                                >
                                  <Icon name="plus" size={11} />
                                </IconButton>
                                <IconButton
                                  variant="ghost"
                                  size={26}
                                  onClick={() => {
                                    opnfldr(track.file_path).catch((err) => pushToast('定位失败', gterrmsg(err) || '无法定位本地文件', 'error'))
                                  }}
                                  title="定位文件"
                                >
                                  <Icon name="folder" size={11} />
                                </IconButton>
                                <IconButton
                                  variant="ghost"
                                  size={26}
                                  onClick={() => {
                                    if (window.confirm('确定要删除此历史记录吗？将同时尝试删除本地文件。')) {
                                      dlthstry(track.track_id, true).then(() => {
                                        gthstry().then(res => setDownloadHistory(res))
                                      }).catch(console.error)
                                    }
                                  }}
                                  title="删除记录"
                                >
                                  <Icon name="trash" size={11} style={{ color: 'var(--system-error)' }} />
                                </IconButton>
                              </HStack>
                            </HStack>
                          </div>
                        ))}
                      </div>
                    )}
                  </VStack>
                </Card>
              )
            })}
          </VStack>
        )}
      </VStack>

    </VStack>
  )
}
