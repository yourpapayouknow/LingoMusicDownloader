// 前端应用外壳与视图装配入口
import { useStor } from './app/useAppStore'
import { TpBar } from './components/TopBar'
import { LyrPnl } from './components/LyricsPanel'
import { PlsPnl } from './components/PlaylistPanel'
import { BtmNav } from './components/BottomNav'
import { WslDlg } from './components/dialogs/WslDialog'
import { WrpDlg } from './components/dialogs/WrapperDialog'
import { DwnDlg } from './components/dialogs/DownloadDialog'
import { CnfDlg } from './components/CnfDlg'
import { SrchVw } from './views/SearchView'
import { DwnVw } from './views/DownloadsView'
import { SetVw } from './views/SettingsView'
import { AbtVw } from './views/AboutView'
import { TstVw } from './ui/components'
import { ScrVw, VStk } from './ui/primitives'
import './app.css'

// 前端应用根组件
export default function App() {
  const store = useStor()

  return (
    <div className="app-shell">
      <audio
        ref={store.setaud}
        preload="metadata"
        onTimeUpdate={store.onatmu}
        onLoadedMetadata={store.onatlm}
        onEnded={store.onated}
      />

      <TpBar store={store} />
      <LyrPnl store={store} />
      <PlsPnl store={store} />

      <ScrVw className="app-main">
        <VStk gap="loose" className="app-sections">
          {store.activeTab === 'search' && <SrchVw store={store} />}
          {store.activeTab === 'download' && <DwnVw store={store} />}
          {store.activeTab === 'settings' && <SetVw store={store} />}
          {store.activeTab === 'about' && <AbtVw store={store} />}
        </VStk>
      </ScrVw>

      <WslDlg store={store} />
      <WrpDlg store={store} />
      <DwnDlg store={store} />
      <CnfDlg store={store} />
      <TstVw items={store.toasts} onDismiss={store.rmtst} />
      <BtmNav store={store} />
    </div>
  )
}