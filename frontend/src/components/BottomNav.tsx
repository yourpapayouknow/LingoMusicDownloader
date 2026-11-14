// BottomNav组件
import { BottomBar } from '../ui/components'
import { Icon } from '../ui/primitives'
import type { AppStore } from '../app/useAppStore'

// BottomNav组件渲染入口
export function BottomNav({ store }: { store: AppStore }) {
  const {
    activeTab, downloadingCount, setActiveTab,
  } = store

  return (
    <BottomBar
      active={activeTab}
      onChange={(val) => setActiveTab(val as typeof activeTab)}
      items={[
        { value: 'search', label: '搜索', icon: <Icon name="search" size={20} filled={activeTab === 'search'} /> },
        { value: 'download', label: '下载', icon: <Icon name="download" size={20} filled={activeTab === 'download'} />, badge: downloadingCount > 0 ? downloadingCount : undefined },
        { value: 'settings', label: '设置', icon: <Icon name="settings" size={20} filled={activeTab === 'settings'} /> },
        { value: 'about', label: '关于', icon: <Icon name="info" size={20} filled={activeTab === 'about'} /> },
      ]}
    />
  )
}
