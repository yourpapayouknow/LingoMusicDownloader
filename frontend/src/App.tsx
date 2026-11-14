// 前端应用外壳与视图装配入口
import { useAppStore } from './app/useAppStore'
import { TopBar } from './components/TopBar'
import { LyricsPanel } from './components/LyricsPanel'
import { PlaylistPanel } from './components/PlaylistPanel'
import { BottomNav } from './components/BottomNav'
import { WslDialog } from './components/dialogs/WslDialog'
import { WrapperDialog } from './components/dialogs/WrapperDialog'
import { DownloadDialog } from './components/dialogs/DownloadDialog'
import { SearchView } from './views/SearchView'
import { DownloadsView } from './views/DownloadsView'
import { SettingsView } from './views/SettingsView'
import { AboutView } from './views/AboutView'
import { ToastViewport } from './ui/components'
import { ScrollView, VStack } from './ui/primitives'
import './app.css'

// 前端应用根组件
export default function App() {
  const store = useAppStore()

  return (
    <div className="app-shell">
      <audio
        ref={store.setAudioEl}
        preload="metadata"
        onTimeUpdate={store.onAudioTimeUpdate}
        onLoadedMetadata={store.onAudioLoadedMetadata}
        onEnded={store.onAudioEnded}
      />

      <TopBar store={store} />
      <LyricsPanel store={store} />
      <PlaylistPanel store={store} />

      <ScrollView className="app-main" height="calc(100vh - 150px)">
        <VStack gap="loose" className="app-sections">
          {store.activeTab === 'search' && <SearchView store={store} />}
          {store.activeTab === 'download' && <DownloadsView store={store} />}
          {store.activeTab === 'settings' && <SettingsView store={store} />}
          {store.activeTab === 'about' && <AboutView store={store} />}
        </VStack>
      </ScrollView>

      <WslDialog store={store} />
      <WrapperDialog store={store} />
      <DownloadDialog store={store} />
      <ToastViewport items={store.toasts} onDismiss={store.removeToast} />
      <BottomNav store={store} />
    </div>
  )
}