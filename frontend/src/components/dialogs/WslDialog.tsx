// WslDialog组件
import { Badge, Button, IconButton, Spinner } from '../../ui/components'
import { Box, HStack, Heading, Icon, Text, VStack } from '../../ui/primitives'
import type { AppStore } from '../../app/useAppStore'

// WslDialog组件渲染入口
export function WslDialog({ store }: { store: AppStore }) {
  const {
    handleCloseWslInstallDialog, handleConfirmInstallWsl2, wslInstallDialogOpen, wslInstallLoading, wslInstallPrecheck, wslInstallStatusData,
  } = store

  if (!wslInstallDialogOpen) return null

  return (
      <div className="wsl-install-mask" role="dialog" aria-modal="true" aria-label="安装WSL2">
        <div className="wsl-install-card">
          <VStack gap="normal" style={{ height: '100%' }}>
            <HStack justify="space-between" align="flex-start">
              <VStack gap={4}>
                <Heading level={3}>安装WSL2</Heading>
                <Text tone="secondary" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
                  将安装Ubuntu于D:\WSL2，若D盘不存在，则将安装在C盘默认位置
                </Text>
              </VStack>
              <IconButton
                variant="ghost"
                size={30}
                onClick={handleCloseWslInstallDialog}
                disabled={wslInstallStatusData?.running}
                title={wslInstallStatusData?.running ? '安装进行中，暂不可关闭' : '关闭'}
              >
                <Icon name="close" size={14} />
              </IconButton>
            </HStack>

            <Box surface border radius="container" padding="normal">
              <VStack gap={6}>
                <Text style={{ fontSize: '0.82rem' }}>
                  预检查结果：{wslInstallPrecheck?.message || '正在检查磁盘空间与安装条件...'}
                </Text>
                {wslInstallStatusData?.message && (
                  <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                    当前状态：{wslInstallStatusData.message}（阶段：{wslInstallStatusData.stage || 'idle'}）
                  </Text>
                )}
                <HStack gap="compact" style={{ flexWrap: 'wrap' }}>
                  <Badge tone={wslInstallPrecheck?.d_drive_exists ? 'default' : 'error'}>
                    D盘: {wslInstallPrecheck?.d_drive_exists ? '存在' : '不存在'} · {wslInstallPrecheck?.d_free_gb ?? 0} GB
                  </Badge>
                  <Badge tone="default">
                    C盘可用: {wslInstallPrecheck?.c_free_gb ?? 0} GB
                  </Badge>
                  <Badge tone={wslInstallPrecheck?.is_admin ? 'success' : 'error'}>
                    权限: {wslInstallPrecheck?.is_admin ? '管理员' : '非管理员'}
                  </Badge>
                  <Badge tone={wslInstallPrecheck?.already_installed ? 'success' : 'default'}>
                    WSL2: {wslInstallPrecheck?.already_installed ? '已安装' : '未安装'}
                  </Badge>
                </HStack>
                {wslInstallPrecheck?.install_hint && (
                  <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                    检测依据：{wslInstallPrecheck.install_hint}
                  </Text>
                )}
                {(wslInstallStatusData?.target_path || wslInstallPrecheck?.target_path) && (
                  <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                    安装目标：{wslInstallStatusData?.target_path || wslInstallPrecheck?.target_path}
                  </Text>
                )}
              </VStack>
            </Box>

            {(wslInstallStatusData?.logs?.length || 0) > 0 && (
              <div className="wsl-install-log-panel">
                {wslInstallStatusData?.logs?.map((line, index) => (
                  <div key={`wsl-log-${index}`}>{line}</div>
                ))}
              </div>
            )}

            {wslInstallLoading && (
              <HStack gap="compact" align="center">
                <Spinner size={14} />
                <Text tone="secondary" style={{ fontSize: '0.8rem' }}>
                  正在处理安装流程，请稍候...
                </Text>
              </HStack>
            )}

            <HStack justify="space-between" align="center" style={{ marginTop: 'auto' }}>
              <Button
                variant="secondary"
                onClick={handleCloseWslInstallDialog}
                disabled={wslInstallStatusData?.running}
              >
                关闭
              </Button>
              <Button
                className="init-guide-primary-btn"
                onClick={handleConfirmInstallWsl2}
                disabled={
                  wslInstallLoading
                  || wslInstallStatusData?.running
                  || wslInstallPrecheck?.already_installed
                  || !wslInstallPrecheck?.can_install
                }
                leadingIcon={wslInstallLoading ? <Spinner size={14} /> : undefined}
              >
                {wslInstallStatusData?.running
                  ? '安装中...'
                  : wslInstallPrecheck?.already_installed
                    ? '已安装完成'
                    : '确认安装'}
              </Button>
            </HStack>
          </VStack>
        </div>
      </div>
  )
}
