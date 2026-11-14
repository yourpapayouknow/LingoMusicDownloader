// TopBar组件
import type { CSSProperties } from '../head'
import { Bdg, IcBtn, Tgl } from '../ui/components'
import { HStk, Icn, Img, Txt, VStk } from '../ui/primitives'
import { fmttm, gtarturl } from '../utils/format'
import { clswin, istri, maxwin, minwin } from '../utils/tauri'
import logoImage from '../assets/lingomusiclogo-sm.png'
import type { AppStore } from '../app/useAppStore'

// TopBar组件渲染入口
export function TpBar({ store }: { store: AppStore }) {
  const {
    hdlnxt, hdlplps, hdlprv, hdlprgc, hdlvolc, isMuted, isPlaying, isRepeat, isShuffle, lyricsOpen, mode, playbackDuration, playbackTime, playingTrack, playlistEntries, playlistOpen, searchResults, setIsRepeat, setIsShuffle, setLyricsOpen, setPlaylistOpen, tglmod, tglmut, volume,
  } = store

  return (
    <header 
      className="ui-topbar" 
      style={{ 
        paddingBlock: '8px', 
        minHeight: '64px', 
        paddingRight: istri() ? '154px' : '20px' 
      }} 
      data-tauri-drag-region
    >
      {/* Left branding */}
      <HStk align="center" gap="compact" data-tauri-drag-region>
        <img src={logoImage} className="topbar-logo" alt="LingoMusic Logo" data-tauri-drag-region />
        <VStk gap={0} align="flex-start" data-tauri-drag-region>
          <Txt weight={700} style={{ fontSize: '1.05rem', lineHeight: '1.2' }} data-tauri-drag-region>LingoMusic</Txt>
          <Txt tone="secondary" style={{ fontSize: '0.68rem' }} data-tauri-drag-region>Downloader</Txt>
        </VStk>
      </HStk>

      {/* Center player */}
      <div className="am-player">
        <div className="am-controls">
          <button
            className="am-btn"
            onClick={hdlprv}
            title="上一首"
            disabled={playlistEntries.length === 0 && searchResults.length === 0}
          >
            <Icn name="prev" size={16} filled />
          </button>
          <button
            className="am-btn"
            onClick={hdlplps}
            style={{ width: '36px', height: '36px' }}
            title={isPlaying ? '暂停' : '播放'}
          >
            <Icn name={isPlaying ? 'pause' : 'play'} size={19} filled />
          </button>
          <button
            className="am-btn"
            onClick={hdlnxt}
            title="下一首"
            disabled={playlistEntries.length === 0 && searchResults.length === 0}
          >
            <Icn name="next" size={16} filled />
          </button>
        </div>

        <div className="am-display">
          <Img
            src={playingTrack ? gtarturl(playingTrack.attributes.artwork?.url, 64) : logoImage}
            className="am-artwork"
            radius={4}
          />
          <div className="am-info-progress">
            <div className="am-info-text">
              {playingTrack ? (
                <>
                  <span>{playingTrack.attributes.name}</span>
                  <span className="am-info-artist"> — {playingTrack.attributes.artistName}</span>
                  <Bdg tone={playingTrack.attributes.url.includes('/local-play/') ? 'success' : 'info'}>
                    {playingTrack.attributes.url.includes('/local-play/') ? '本地' : '预览'}
                  </Bdg>
                </>
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>暂无播放内容</span>
              )}
            </div>
            <span className="am-time am-time-remaining">
              {playbackDuration > 0
                ? `-${fmttm(Math.max(0, playbackDuration - playbackTime))}`
                : '-00:00'}
            </span>
          </div>
        </div>

        <div className="am-volume-wrapper">
          <button className="am-btn" onClick={tglmut} title={isMuted ? '取消静音' : '静音'}>
            <Icn name={isMuted || volume === 0 ? 'volumeMute' : 'volume'} size={15} filled={isMuted || volume === 0} />
          </button>
          <input
            type="range"
            className="am-volume-slider"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={hdlvolc}
            style={{
              '--track-bg': `linear-gradient(to right, var(--action-primary) 0%, var(--action-primary) ${
                (isMuted ? 0 : volume) * 100
              }%, var(--component-wrapped-bg) ${
                (isMuted ? 0 : volume) * 100
              }%, var(--component-wrapped-bg) 100%)`,
              '--thumb-bg': 'var(--action-primary)'
            } as CSSProperties}
          />
        </div>

        <div className="am-controls">
          <button
            className="am-btn"
            style={{ color: isShuffle ? 'var(--action-primary)' : 'inherit' }}
            onClick={() => setIsShuffle(!isShuffle)}
            title="随机试听"
          >
            <Icn name="shuffle" size={14} filled={isShuffle} />
          </button>
          <button
            className="am-btn"
            style={{ color: isRepeat ? 'var(--action-primary)' : 'inherit' }}
            onClick={() => setIsRepeat(!isRepeat)}
            title="单曲循环"
          >
            <Icn name="repeat" size={14} filled={isRepeat} />
          </button>
        </div>
        <div className="am-progress-edge-wrapper">
          <input
            type="range"
            className="am-progress-slider am-progress-edge-slider"
            min={0}
            max={playbackDuration || 30}
            value={playbackTime}
            onChange={hdlprgc}
            style={{
              '--track-bg': playingTrack
                ? `linear-gradient(to right, var(--action-primary) 0%, var(--action-primary) ${
                    (playbackTime / (playbackDuration || 30)) * 100
                  }%, color-mix(in srgb, var(--component-wrapped-bg) 62%, transparent) ${
                    (playbackTime / (playbackDuration || 30)) * 100
                  }%, color-mix(in srgb, var(--component-wrapped-bg) 62%, transparent) 100%)`
                : 'color-mix(in srgb, var(--component-wrapped-bg) 62%, transparent)',
              '--thumb-bg': playingTrack ? 'var(--action-primary)' : 'var(--component-wrapped-bg)',
            } as CSSProperties}
          />
        </div>
      </div>

      {/* Right tools and window buttons */}
      <HStk align="center" gap="compact">
        <IcBtn
          variant={lyricsOpen ? 'primary' : 'ghost'}
          size={36}
          onClick={() => {
            const next = !lyricsOpen
            setLyricsOpen(next)
            if (next) setPlaylistOpen(false)
          }}
          title="歌词"
        >
          <Icn name="lyrics" size={16} filled={lyricsOpen} />
        </IcBtn>
        <IcBtn
          variant={playlistOpen ? 'primary' : 'ghost'}
          size={36}
          onClick={() => {
            const next = !playlistOpen
            setPlaylistOpen(next)
            if (next) setLyricsOpen(false)
          }}
          title={`播放列表 (${playlistEntries.length})`}
        >
          <Icn name="playlist" size={16} filled={playlistOpen} />
        </IcBtn>
        <Tgl checked={mode === 'dark'} onChange={tglmod} label={mode === 'dark' ? '深色' : '浅色'} />

        {istri() && (
          <div className="win-controls" style={{ position: 'absolute', right: 0, top: 0, bottom: 0 }}>
            <button className="win-btn" onClick={minwin} title="最小化">
              <Icn name="minimize" size={12} />
            </button>
            <button className="win-btn" onClick={maxwin} title="最大化">
              <Icn name="maximize" size={12} />
            </button>
            <button className="win-btn win-btn-close" onClick={clswin} title="关闭">
              <Icn name="close" size={12} />
            </button>
          </div>
        )}
      </HStk>
    </header>
  )
}
