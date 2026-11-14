// WslDialog组件
import { useEffect, useRef } from '../../head'
import { Bdg, Btn, IcBtn, Spn } from '../../ui/components'
import { Bx, HStk, Hdg, Icn, Txt, VStk } from '../../ui/primitives'
import { stglbl } from '../../app/helpers'
import type { AppStore } from '../../app/useAppStore'

// WslDialog组件渲染入口
export function WslDlg({ store }: { store: AppStore }) {
  const {
    hdlclws, hdlcfw2, wslInstallDialogOpen, wslInstallLoading, wslInstallPrecheck, wslInstallStatusData,
  } = store

  const cardRef = useRef<HTMLDivElement>(null)

  // 弹窗打开时聚焦并支持Esc后台关闭
  useEffect(() => {
    if (!wslInstallDialogOpen) return
    cardRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hdlclws()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wslInstallDialogOpen, hdlclws])

  if (!wslInstallDialogOpen) return null

  return (
      <div className="wsl-install-mask" role="dialog" aria-modal="true" aria-label="安装WSL2">
        <div className="wsl-install-card" ref={cardRef} tabIndex={-1}>
          <VStk gap="normal" style={{ height: '100%' }}>
            <HStk justify="space-between" align="flex-start">
              <VStk gap={4}>
                <Hdg level={3}>安装WSL2</Hdg>
                <Txt tone="secondary" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
                  将安装Ubuntu于D:\WSL2，若D盘不存在，则将安装在C盘默认位置
                </Txt>
              </VStk>
              <IcBtn
                variant="ghost"
                size={30}
                onClick={hdlclws}
                title={wslInstallStatusData?.running ? '后台运行' : '关闭'}
              >
                <Icn name="close" size={14} />
              </IcBtn>
            </HStk>

            <Bx surface border radius="container" padding="normal">
              <VStk gap={6}>
                <Txt style={{ fontSize: '0.82rem' }}>
                  预检查结果：{wslInstallPrecheck?.message || '正在检查磁盘空间与安装条件...'}
                </Txt>
                {wslInstallStatusData?.message && (
                  <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>
                    当前状态：{wslInstallStatusData.message}（阶段：{stglbl(wslInstallStatusData.stage || 'idle')}）
                  </Txt>
                )}
                <HStk gap="compact" style={{ flexWrap: 'wrap' }}>
                  <Bdg tone={wslInstallPrecheck?.d_drive_exists ? 'default' : 'error'}>
                    D盘: {wslInstallPrecheck?.d_drive_exists ? '存在' : '不存在'} · {wslInstallPrecheck?.d_free_gb ?? 0} GB
                  </Bdg>
                  <Bdg tone="default">
                    C盘可用: {wslInstallPrecheck?.c_free_gb ?? 0} GB
                  </Bdg>
                  <Bdg tone={wslInstallPrecheck?.is_admin ? 'success' : 'error'}>
                    权限: {wslInstallPrecheck?.is_admin ? '管理员' : '非管理员'}
                  </Bdg>
                  <Bdg tone={wslInstallPrecheck?.already_installed ? 'success' : 'default'}>
                    WSL2: {wslInstallPrecheck?.already_installed ? '已安装' : '未安装'}
                  </Bdg>
                </HStk>
                {wslInstallPrecheck?.install_hint && (
                  <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>
                    检测依据：{wslInstallPrecheck.install_hint}
                  </Txt>
                )}
                {(wslInstallStatusData?.target_path || wslInstallPrecheck?.target_path) && (
                  <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>
                    安装目标：{wslInstallStatusData?.target_path || wslInstallPrecheck?.target_path}
                  </Txt>
                )}
              </VStk>
            </Bx>

            {(wslInstallStatusData?.logs?.length || 0) > 0 && (
              <div className="wsl-install-log-panel">
                {wslInstallStatusData?.logs?.map((line, index) => (
                  <div key={`wsl-log-${index}`}>{line}</div>
                ))}
              </div>
            )}

            {wslInstallLoading && (
              <HStk gap="compact" align="center">
                <Spn size={14} />
                <Txt tone="secondary" style={{ fontSize: '0.8rem' }}>
                  正在处理安装流程，请稍候...
                </Txt>
              </HStk>
            )}

            <HStk justify="space-between" align="center" style={{ marginTop: 'auto' }}>
              <Btn variant="secondary" onClick={hdlclws}>
                {wslInstallStatusData?.running ? '后台运行' : '关闭'}
              </Btn>
              <Btn
                className="init-guide-primary-btn"
                onClick={hdlcfw2}
                disabled={
                  wslInstallLoading
                  || wslInstallStatusData?.running
                  || wslInstallPrecheck?.already_installed
                  || !wslInstallPrecheck?.can_install
                }
                leadingIcon={wslInstallLoading ? <Spn size={14} /> : undefined}
              >
                {wslInstallStatusData?.running
                  ? '安装中...'
                  : wslInstallPrecheck?.already_installed
                    ? '已安装完成'
                    : '确认安装'}
              </Btn>
            </HStk>
          </VStk>
        </div>
      </div>
  )
}
