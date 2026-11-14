// BottomNav组件
import { BtmBar } from '../ui/components'
import { Icn } from '../ui/primitives'
import type { AppStore } from '../app/useAppStore'

// BottomNav组件渲染入口
export function BtmNav({ store }: { store: AppStore }) {
  const {
    activeTab, downloadingCount, setActiveTab,
  } = store

  return (
    <BtmBar
      active={activeTab}
      onChange={(val) => setActiveTab(val as typeof activeTab)}
      items={[
        { value: 'search', label: '搜索', icon: <Icn name="search" size={20} filled={activeTab === 'search'} /> },
        { value: 'download', label: '下载', icon: <Icn name="download" size={20} filled={activeTab === 'download'} />, badge: downloadingCount > 0 ? downloadingCount : undefined },
        { value: 'settings', label: '设置', icon: <Icn name="settings" size={20} filled={activeTab === 'settings'} /> },
        { value: 'about', label: '关于', icon: <Icn name="info" size={20} filled={activeTab === 'about'} /> },
      ]}
    />
  )
}
