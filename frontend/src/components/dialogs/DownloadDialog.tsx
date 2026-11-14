// DownloadDialog组件
import { gtrslbl } from '../../app/helpers'
import { Badge, Dialog } from '../../ui/components'
import { Box, HStack, Image, Text, VStack } from '../../ui/primitives'
import { gtarturl } from '../../utils/format'
import type { AppStore } from '../../app/useAppStore'

// DownloadDialog组件渲染入口
export function DownloadDialog({ store }: { store: AppStore }) {
  const {
    codec, downloadConfirmOpen, downloadConfirmTrack, handleConfirmDownload, resolution, setDownloadConfirmOpen, useWrapper,
  } = store

  if (!downloadConfirmTrack) return null

  return (
    <Dialog
        open={downloadConfirmOpen}
        title="确认提交下载"
        description=""
        confirmText="确认下载"
        cancelText="取消"
        onOpenChange={(next) => setDownloadConfirmOpen(next)}
        onConfirm={handleConfirmDownload}
      >
        <VStack gap="normal" style={{ marginBlock: '10px' }}>
          <Box padding="normal" surface border radius="container">
            <HStack gap="normal" align="center">
              <Image
                src={gtarturl(downloadConfirmTrack.attributes.artwork?.url, 120)}
                alt={downloadConfirmTrack.attributes.name}
                radius={6}
                style={{ width: '56px', height: '56px' }}
              />
              <VStack gap={2} style={{ minWidth: 0, flex: 1 }}>
                <Text weight={700} style={{ fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {downloadConfirmTrack.attributes.name}
                </Text>
                <Text tone="secondary" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {downloadConfirmTrack.type === 'artists'
                    ? '艺术家'
                    : (downloadConfirmTrack.attributes.artistName || '未知艺人')}
                </Text>
              </VStack>
              <Badge tone={downloadConfirmTrack.type === 'music-videos' ? 'info' : downloadConfirmTrack.type === 'artists' ? 'success' : 'default'}>
                {gtrslbl(downloadConfirmTrack.type)}
              </Badge>
            </HStack>
          </Box>

          <HStack justify="space-between" align="center">
            <Text style={{ fontSize: '0.86rem' }}>预计下载品质：</Text>
            <Badge tone="success">
              {downloadConfirmTrack.type === 'music-videos'
                ? (resolution === '4k' ? '4K Ultra HD 级画质' : '1080p Full HD 高清视频')
                : (useWrapper 
                    ? (codec === 'atmos' ? 'Dolby Atmos (杜比环绕音效)' : 'ALAC 24-bit/192kHz 无损母带')
                    : 'AAC 256kbps 标准音质'
                  )
              }
            </Badge>
          </HStack>
        </VStack>
      </Dialog>
  )
}
