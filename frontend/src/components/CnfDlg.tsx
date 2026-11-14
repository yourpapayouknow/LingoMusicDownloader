// 应用内确认弹窗组件
import { Dlg } from '../ui/components'
import type { AppStore } from '../app/useAppStore'

// 确认弹窗渲染入口
export function CnfDlg({ store }: { store: AppStore }) {
  const { confirmPrompt, closeConfirm, runConfirm } = store

  return (
    <Dlg
      open={Boolean(confirmPrompt)}
      title={confirmPrompt?.title || ''}
      description={confirmPrompt?.description}
      confirmText={confirmPrompt?.confirmText || '确认'}
      cancelText="取消"
      confirmVariant={confirmPrompt?.tone === 'error' ? 'danger' : 'primary'}
      onOpenChange={(open) => {
        if (!open) closeConfirm()
      }}
      onConfirm={() => void runConfirm()}
    />
  )
}