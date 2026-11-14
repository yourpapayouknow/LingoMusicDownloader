// DownloadDialog组件
import { gtrslbl } from '../../app/helpers'
import { Bdg, Btn, Dlg } from '../../ui/components'
import { Bx, HStk, Img, Txt, VStk } from '../../ui/primitives'
import { gtarturl } from '../../utils/format'
import type { AppStore } from '../../app/useAppStore'

// DownloadDialog组件渲染入口
export function DwnDlg({ store }: { store: AppStore }) {
  const {
    codec, downloadConfirmOpen, downloadConfirmTrack, hdlcfdw, healthStatus, resolution,
    setActiveTab, setDownloadConfirmOpen, useWrapper,
  } = store

  if (!downloadConfirmTrack) return null

  const wrapperBlocked = useWrapper && !healthStatus?.wrapper.all_ok
  const codecBlocked = !useWrapper && (codec === 'alac' || codec === 'atmos')
  const blocked = wrapperBlocked || codecBlocked

  return (
    <Dlg
        open={downloadConfirmOpen}
        title="确认提交下载"
        description=""
        confirmText="确认下载"
        cancelText="取消"
        confirmDisabled={blocked}
        onOpenChange={(next) => setDownloadConfirmOpen(next)}
        onConfirm={hdlcfdw}
      >
        <VStk gap="normal" style={{ marginBlock: '10px' }}>
          <Bx padding="normal" surface border radius="container">
            <HStk gap="normal" align="center">
              <Img
                src={gtarturl(downloadConfirmTrack.attributes.artwork?.url, 120)}
                alt={downloadConfirmTrack.attributes.name}
                radius={6}
                style={{ width: '56px', height: '56px' }}
              />
              <VStk gap={2} style={{ minWidth: 0, flex: 1 }}>
                <Txt weight={700} style={{ fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {downloadConfirmTrack.attributes.name}
                </Txt>
                <Txt tone="secondary" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {downloadConfirmTrack.type === 'artists'
                    ? '艺术家'
                    : (downloadConfirmTrack.attributes.artistName || '未知歌手')}
                </Txt>
              </VStk>
              <Bdg tone={downloadConfirmTrack.type === 'music-videos' ? 'info' : downloadConfirmTrack.type === 'artists' ? 'success' : 'default'}>
                {gtrslbl(downloadConfirmTrack.type)}
              </Bdg>
            </HStk>
          </Bx>

          <HStk justify="space-between" align="center">
            <Txt style={{ fontSize: '0.86rem' }}>预计下载品质：</Txt>
            <Bdg tone="success">
              {downloadConfirmTrack.type === 'music-videos'
                ? (resolution === '4k' ? '4K Ultra HD 级画质' : '1080p Full HD 高清视频')
                : (useWrapper 
                    ? (codec === 'atmos' ? 'Dolby Atmos (杜比环绕音效)' : 'ALAC 24-bit/192kHz 无损母带')
                    : 'AAC 256kbps 标准音质'
                  )
              }
            </Bdg>
          </HStk>

          {blocked && (
            <HStk justify="space-between" align="center" gap="compact">
              <Txt tone="error" style={{ fontSize: '0.8rem' }}>
                {wrapperBlocked ? 'Wrapper未就绪，请先在设置中启动' : '当前音质需要Wrapper，请先启用高品音质下载'}
              </Txt>
              <Btn
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDownloadConfirmOpen(false)
                  setActiveTab('settings')
                }}
              >
                去设置
              </Btn>
            </HStk>
          )}
        </VStk>
      </Dlg>
  )
}
