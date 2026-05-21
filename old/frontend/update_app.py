import re
import os

app_path = "f:/College/Activ_CodeProjects/PycharmProjects/LingoMusicDownloader/frontend/src/App.tsx"

with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
# Find: import { searchAppleMusic, submitDownload, getStatus, getHealth, saveCookies, DownloadQueueItem, HealthStatus, SearchResult } from './utils/api'
import_pattern = r"import\s*\{([^}]+)\}\s*from\s*'./utils/api'"
def repl_imports(m):
    original_imports = m.group(1)
    new_imports = original_imports + ", getSettingsApi, saveSettingsApi, getHistoryApi, deleteHistoryApi, getRecommendationsApi, reportSearchApi, getLocalPlayUrl, HistoryItem"
    return f"import {{{new_imports}}} from './utils/api'"
content = re.sub(import_pattern, repl_imports, content, count=1)

# 2. Add history state and recommendation state
# We can find `const [health, setHealth] = useState<HealthStatus | null>(null)`
health_state_pattern = r"const \[health, setHealth\] = useState<HealthStatus \| null>\(null\)"
new_state = """const [health, setHealth] = useState<HealthStatus | null>(null)
  
  // DB States
  const [downloadHistory, setDownloadHistory] = useState<HistoryItem[]>([])
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)"""
content = content.replace("const [health, setHealth] = useState<HealthStatus | null>(null)", new_state, 1)

# 3. Add useEffect to fetch initial DB data
# Find:   useEffect(() => {
#    fetchHealth()
#  }, [])
init_effect_pattern = r"  useEffect\(\(\) => \{\n    fetchHealth\(\)\n  \}, \[\]\)"
new_init_effect = """  useEffect(() => {
    fetchHealth()
    
    // Fetch Settings
    getSettingsApi().then(settings => {
      if (settings[SETTINGS_KEY_CODEC]) setCodec(settings[SETTINGS_KEY_CODEC])
      if (settings[SETTINGS_KEY_RESOLUTION]) setResolution(settings[SETTINGS_KEY_RESOLUTION])
      if (settings[SETTINGS_KEY_USE_WRAPPER] !== undefined) setUseWrapper(settings[SETTINGS_KEY_USE_WRAPPER] === 'true' || settings[SETTINGS_KEY_USE_WRAPPER] === true)
      if (settings[SETTINGS_KEY_VOLUME]) {
        const v = parseFloat(settings[SETTINGS_KEY_VOLUME])
        setVolume(v)
        setIsMuted(v === 0)
      }
    }).catch(console.error)

    // Fetch Recommendations
    getRecommendationsApi().then(res => setRecommendations(res.recommendations || [])).catch(console.error)
    
    // Fetch History
    getHistoryApi().then(res => {
      setDownloadHistory(res)
      setHistoryLoaded(true)
    }).catch(console.error)
  }, [])"""
content = content.replace("  useEffect(() => {\n    fetchHealth()\n  }, [])", new_init_effect, 1)

# 4. Modify saving settings
# Replace localStorage.setItem calls with an api call
# There is an effect for this:
#  useEffect(() => {
#    localStorage.setItem(SETTINGS_KEY_CODEC, codec)
#  }, [codec])
# etc...
# We can just replace the whole section.
settings_effect_pattern = r"  // Save settings to localStorage on change(.*?)// Audio lifecycle bindings"
new_settings_effect = """  // Save settings to DB on change
  useEffect(() => {
    saveSettingsApi({
      [SETTINGS_KEY_CODEC]: codec,
      [SETTINGS_KEY_RESOLUTION]: resolution,
      [SETTINGS_KEY_USE_WRAPPER]: useWrapper,
      [SETTINGS_KEY_VOLUME]: volume
    }).catch(console.error)
  }, [codec, resolution, useWrapper, volume])

  // Audio lifecycle bindings"""
content = re.sub(settings_effect_pattern, new_settings_effect, content, flags=re.DOTALL)

# 5. Intercept Search to report keyword
# const handleSearch = async (e: React.FormEvent) => { ...
#       const res = await searchAppleMusic(searchQuery)
search_call_pattern = r"const res = await searchAppleMusic\(searchQuery\)"
new_search_call = """const res = await searchAppleMusic(searchQuery)
      reportSearchApi(searchQuery).catch(console.error)"""
content = content.replace("const res = await searchAppleMusic(searchQuery)", new_search_call, 1)

# 6. Intercept Play to use Local Play if available
# const handlePlayPreview = (result: any) => { ...
#     let previewUrl = '' ...
play_pattern = r"const handlePlayPreview = \(result: any\) => \{"
new_play = """const handlePlayPreview = (result: any) => {
    // Check if we have this track in local history
    const trackId = result.id
    const localTrack = downloadHistory.find(h => h.track_id === trackId)
    if (localTrack && localTrack.file_path) {
      const localUrl = getLocalPlayUrl(trackId)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = localUrl
        audioRef.current.load()
        audioRef.current.play().then(() => setIsPlaying(true)).catch(err => {
          console.error('Local Audio play failed:', err)
          setIsPlaying(false)
        })
      }
      setCurrentPlaying(result)
      return
    }"""
content = content.replace("const handlePlayPreview = (result: any) => {", new_play, 1)

with open(app_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated App.tsx via python script")
