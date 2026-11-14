// DownloadsView组件
import { Bdg, Btn, Crd, IcBtn, Spn } from '../ui/components'
import { Bx, HStk, Hdg, Icn, Img, Txt, VStk } from '../ui/primitives'
import { gtlclart, opncnvtfldr, opnfldr } from '../utils/api'
import { gterrmsg, nrmlcdclbl } from '../utils/format'
import type { AppStore } from '../app/useAppStore'
import type { QueueItem } from '../app/types'

// DownloadsView组件渲染入口
export function DwnVw({ store }: { store: AppStore }) {
  const {
    addlcpl, dlhsttrk, dlquim, deletingHistoryGroupId, downloadHistory, downloadQueue, hdladhp, hdladqp, hdlclhg, historyAlbumGroups, isPlaying, openAlbums, openHistoryAlbums, pllcltr, playingTrack, pshtst, rfrhst, scanningLocal, setActiveTab, setOpenAlbums, setOpenHistoryAlbums, stlclpl, trglscn,
  } = store

  return (
    <VStk gap="normal">
      {/* Header Folder Trigger Btn */}
      <HStk justify="flex-start" gap="compact">
        <Btn
          variant="secondary"
          leadingIcon={<Icn name="folder" size={15} />}
          onClick={() => {
            opnfldr().catch((err) => pshtst('打开目录失败', gterrmsg(err) || '无法打开目录', 'error'))
          }}
        >
          打开下载文件夹
        </Btn>
        <Btn
          variant="secondary"
          leadingIcon={<Icn name="search" size={15} />}
          onClick={trglscn}
          disabled={scanningLocal}
        >
          {scanningLocal ? '扫描中...' : '扫描歌曲'}
        </Btn>
        <Btn
          variant="secondary"
          leadingIcon={<Icn name="folder" size={15} />}
          onClick={() => {
            opncnvtfldr().catch((err) => pshtst('打开目录失败', gterrmsg(err) || '无法打开转换目录', 'error'))
          }}
        >
          打开转换文件夹
        </Btn>
      </HStk>

      <VStk gap="compact">
        <Hdg level={3}>任务列表</Hdg>
        {downloadQueue.length === 0 ? (
          <Crd style={{ paddingBlock: '32px' }}>
            <VStk align="center" gap="normal">
              <Icn name="download" size={24} style={{ color: 'var(--text-secondary)' }} />
              <Txt tone="secondary">下载列表为空，先去搜索歌曲吧</Txt>
            <Btn variant="secondary" size="sm" onClick={() => setActiveTab('search')}>去搜索</Btn>
            </VStk>
          </Crd>
        ) : (
          <VStk gap="compact">
            {downloadQueue.map((item) => {
              const isCompleted = item.status === 'completed'
              const isErr = item.status === 'error'
              const isDownloading = item.status === 'downloading'
              const isAlbum = item.type === 'album'
              const isAlbumOpen = openAlbums[item.id]

              return (
                <Crd key={item.id} style={{ borderLeft: isErr ? '4px solid var(--system-error)' : undefined }}>
                  <VStk gap="compact">
                    <HStk justify="space-between" align="center">
                      {/* Left side Cover and title */}
                      <HStk gap="normal" align="center" style={{ minWidth: 0, flex: 1 }}>
                        <Img
                          src={item.cover}
                          alt={item.title}
                          radius={6}
                          style={{ width: '48px', height: '48px', flexShrink: 0 }}
                        />
                        <VStk gap={2} style={{ minWidth: 0 }}>
                          <Txt weight={700} style={{ fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </Txt>
                          <HStk gap="compact" align="center">
                            <Txt tone="secondary" style={{ fontSize: '0.76rem' }}>
                              {isAlbum
                                ? `专辑曲目: ${item.tracks?.length || 0} 首`
                                : (item.artistName || item.albumName || '本地任务')}
                            </Txt>
                            <Bdg tone={isCompleted ? 'success' : isErr ? 'error' : 'info'}>
                              {item.quality}
                            </Bdg>
                          </HStk>
                        </VStk>
                      </HStk>

                      {/* Right side operations */}
                      <HStk gap="compact" align="center">
                        {isDownloading && (
                          <HStk gap="compact" align="center">
                            <Spn size={16} />
                            <Txt tone="secondary" style={{ fontSize: '0.8rem' }}>下载中</Txt>
                          </HStk>
                        )}

                        {isErr && (
                          <HStk gap="compact" align="center">
                            <Icn name="alert" size={16} style={{ color: 'var(--system-error)' }} />
                            <IcBtn
                              variant="ghost"
                              size={32}
                              onClick={() => dlquim(item.id)}
                              title="删除任务"
                            >
                              <Icn name="trash" size={15} style={{ color: 'var(--system-error)' }} />
                            </IcBtn>
                          </HStk>
                        )}

                        {isCompleted && (
                          <HStk gap="compact">
                            {isAlbum && (
                              <Btn
                                variant="ghost"
                                size="sm"
                                trailingIcon={<Icn name="chevronDown" size={12} style={{ transform: isAlbumOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                                onClick={() => setOpenAlbums(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                              >
                                {isAlbumOpen ? '收起曲目' : '查看曲目'}
                              </Btn>
                            )}
                            <IcBtn
                              variant="ghost"
                              size={32}
                              onClick={() => {
                                opnfldr(item.file_path).catch((err) => pshtst('定位失败', gterrmsg(err) || '无法定位本地文件', 'error'))
                              }}
                              title="定位文件"
                            >
                              <Icn name="folder" size={14} />
                            </IcBtn>
                            {item.type === 'track' && (
                              <>
                                <IcBtn
                                  variant="secondary"
                                  size={32}
                                  onClick={() => pllcltr(item)}
                                  title="播放"
                                >
                                  <Icn name="play" size={14} filled={playingTrack?.id === (item.trackId || item.id) && isPlaying} />
                                </IcBtn>
                                <IcBtn
                                  variant="ghost"
                                  size={32}
                                  onClick={() => hdladqp(item)}
                                  title="添加到播放列表"
                                >
                                  <Icn name="plus" size={14} />
                                </IcBtn>
                              </>
                            )}
                          </HStk>
                        )}
                      </HStk>
                    </HStk>

                    {/* Album Subtracks list */}
                    {isAlbum && isAlbumOpen && item.tracks && (
                      <div className="album-subtracks">
                        {item.tracks.map((track, i) => (
                          <div key={track.trackId || `${item.id}-${i}`} className="album-subtrack-item">
                            <HStk justify="space-between" align="center">
                              <Txt style={{ fontSize: '0.84rem' }}>
                                {i + 1}. {track.artistName ? `${track.artistName} - ` : ''}{track.name}
                              </Txt>
                              <HStk gap="compact">
                                <Bdg tone={track.status === 'error' ? 'error' : track.status === 'completed' ? 'success' : 'info'}>
                                  {track.status === 'error' ? '失败' : track.status === 'completed' ? '已下载' : '下载中'}
                                </Bdg>
                                <IcBtn
                                  variant="ghost"
                                  size={26}
                                  onClick={() => {
                                    opnfldr(track.file_path || item.file_path).catch((err) => pshtst('定位失败', gterrmsg(err) || '无法定位本地文件', 'error'))
                                  }}
                                  title="定位文件"
                                >
                                  <Icn name="folder" size={11} />
                                </IcBtn>
                                <IcBtn
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
                                    pllcltr(subTrackItem)
                                  }}
                                  title="播放单曲"
                                  disabled={track.status !== 'completed'}
                                >
                                  <Icn name="play" size={11} filled={playingTrack?.id === track.trackId && isPlaying} />
                                </IcBtn>
                                <IcBtn
                                  variant="ghost"
                                  size={26}
                                  onClick={() => {
                                    if (!track.trackId) {
                                      pshtst('添加失败', '该曲目缺少 track_id，无法加入播放列表', 'error')
                                      return
                                    }
                                    addlcpl(
                                      track.trackId,
                                      {
                                        name: track.name,
                                        artistName: track.artistName || '未知歌手',
                                        artworkUrl: track.cover || item.cover,
                                      },
                                      false
                                    )
                                    pshtst('已添加', `已加入播放列表：${track.name}`, 'success')
                                  }}
                                  title="添加到播放列表"
                                  disabled={track.status !== 'completed'}
                                >
                                  <Icn name="plus" size={11} />
                                </IcBtn>
                              </HStk>
                            </HStk>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error Details */}
                    {isErr && item.errorDetails && (
                      <Bx style={{ background: 'rgba(232, 17, 35, 0.08)', padding: '8px 12px', borderRadius: '4px', marginTop: '4px' }}>
                        <Txt tone="error" style={{ fontSize: '0.78rem' }}>
                          故障详情: {item.errorDetails}
                        </Txt>
                      </Bx>
                    )}
                  </VStk>
                </Crd>
              )
            })}
          </VStk>
        )}
      </VStk>

      {/* DOWNLOAD HISTORY */}
      <VStk gap="compact" style={{ marginTop: '16px' }}>
        <HStk justify="space-between" align="center">
          <Hdg level={3}>历史已下载 ({downloadHistory.length})</Hdg>
          <Btn variant="ghost" size="sm" onClick={() => void rfrhst()}>刷新</Btn>
        </HStk>
        {historyAlbumGroups.length === 0 ? (
          <Txt tone="secondary" style={{ fontSize: '0.85rem' }}>暂无历史下载记录</Txt>
        ) : (
          <VStk gap="compact">
            {historyAlbumGroups.map((group) => {
              const isHistoryOpen = !!openHistoryAlbums[group.id]
              const firstTrack = group.tracks[0]

              return (
                <Crd key={group.id}>
                  <VStk gap="compact">
                    <HStk justify="space-between" align="center">
                      <HStk gap="normal" align="center" style={{ minWidth: 0, flex: 1 }}>
                        <Img
                          src={group.cover}
                          alt={group.title}
                          radius={6}
                          style={{ width: '48px', height: '48px', flexShrink: 0 }}
                        />
                        <VStk gap={2} style={{ minWidth: 0 }}>
                          <Txt weight={700} style={{ fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {group.title}
                          </Txt>
                          <HStk gap="compact" align="center">
                            <Txt tone="secondary" style={{ fontSize: '0.76rem' }}>
                              {group.artistName} · {group.tracks.length} 首
                            </Txt>
                            <Bdg tone="info">专辑</Bdg>
                          </HStk>
                        </VStk>
                      </HStk>

                      <HStk gap="compact" align="center">
                        <Btn
                          variant="ghost"
                          size="sm"
                          trailingIcon={<Icn name="chevronDown" size={12} style={{ transform: isHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                          onClick={() => setOpenHistoryAlbums(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                        >
                          {isHistoryOpen ? '收起曲目' : '查看曲目'}
                        </Btn>
                        <IcBtn
                          variant="ghost"
                          size={32}
                          onClick={() => hdlclhg(group.id, group.title, group.tracks)}
                          title={group.tracks.length > 1 ? '删除整专' : '删除记录'}
                          disabled={deletingHistoryGroupId === group.id}
                        >
                          {deletingHistoryGroupId === group.id ? (
                            <Spn size={14} />
                          ) : (
                            <Icn name="trash" size={14} style={{ color: 'var(--system-error)' }} />
                          )}
                        </IcBtn>
                        <IcBtn
                          variant="ghost"
                          size={32}
                          onClick={() => {
                            opnfldr(group.folderPath || firstTrack?.file_path).catch((err) => pshtst('定位失败', gterrmsg(err) || '无法定位本地文件', 'error'))
                          }}
                          title="定位专辑目录"
                        >
                          <Icn name="folder" size={14} />
                        </IcBtn>
                      </HStk>
                    </HStk>

                    {isHistoryOpen && (
                      <div className="album-subtracks">
                        {group.tracks.map((track, index) => (
                          <div key={track.id} className="album-subtrack-item">
                            <HStk justify="space-between" align="center">
                              <Txt style={{ fontSize: '0.84rem' }}>
                                {index + 1}. {track.name}
                              </Txt>
                              <HStk gap="compact">
                                <Bdg tone="success">{nrmlcdclbl(track.codec)}</Bdg>
                                <IcBtn
                                  variant="secondary"
                                  size={26}
                                  onClick={() => {
                                    stlclpl(
                                      track.track_id,
                                      { name: track.name, artistName: track.artist_name, artworkUrl: track.artwork_url || gtlclart(track.track_id) },
                                      true
                                    )
                                  }}
                                  title="本地播放"
                                >
                                  <Icn name="play" size={11} filled={playingTrack?.id === track.track_id && isPlaying} />
                                </IcBtn>
                                <IcBtn
                                  variant="ghost"
                                  size={26}
                                  onClick={() => hdladhp(track)}
                                  title="添加到播放列表"
                                >
                                  <Icn name="plus" size={11} />
                                </IcBtn>
                                <IcBtn
                                  variant="ghost"
                                  size={26}
                                  onClick={() => {
                                    opnfldr(track.file_path).catch((err) => pshtst('定位失败', gterrmsg(err) || '无法定位本地文件', 'error'))
                                  }}
                                  title="定位文件"
                                >
                                  <Icn name="folder" size={11} />
                                </IcBtn>
                                <IcBtn
                                  variant="ghost"
                                  size={26}
                                  onClick={() => dlhsttrk(track)}
                                  title="删除记录"
                                >
                                  <Icn name="trash" size={11} style={{ color: 'var(--system-error)' }} />
                                </IcBtn>
                              </HStk>
                            </HStk>
                          </div>
                        ))}
                      </div>
                    )}
                  </VStk>
                </Crd>
              )
            })}
          </VStk>
        )}
      </VStk>

    </VStk>
  )
}
