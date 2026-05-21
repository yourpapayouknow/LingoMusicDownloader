import re

app_path = "f:/College/Activ_CodeProjects/PycharmProjects/LingoMusicDownloader/frontend/src/App.tsx"

with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix imports
content = content.replace("  getSettingsApi, saveSettingsApi, getHistoryApi, deleteHistoryApi, getRecommendationsApi, reportSearchApi, getLocalPlayUrl, HistoryItem} from './utils/api'",
                          "  getSettingsApi, saveSettingsApi, getHistoryApi, deleteHistoryApi, getRecommendationsApi, reportSearchApi, getLocalPlayUrl, type HistoryItem} from './utils/api'")

# 2. Add states around healthStatus
if "  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)" in content:
    states = """  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  
  // Backend States
  const [downloadHistory, setDownloadHistory] = useState<HistoryItem[]>([])
  const [recommendations, setRecommendations] = useState<string[]>([])"""
    content = content.replace("  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)", states)

# 3. Add to initialization effect
old_effect = """  // Initial fetch
  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])"""

new_effect = """  // Initial fetch
  useEffect(() => {
    fetchHealth()
    
    // Fetch Settings
    getSettingsApi().then(settings => {
      if (settings['lingomusic-codec']) setCodec(settings['lingomusic-codec'])
      if (settings['lingomusic-resolution']) setResolution(settings['lingomusic-resolution'])
      if (settings['lingomusic-use-wrapper'] !== undefined) setUseWrapper(settings['lingomusic-use-wrapper'] === 'true' || settings['lingomusic-use-wrapper'] === true)
      if (settings['lingomusic-volume']) {
        const v = parseFloat(settings['lingomusic-volume'])
        setVolume(v)
        setIsMuted(v === 0)
      }
    }).catch(console.error)

    // Fetch Recommendations
    getRecommendationsApi().then(res => setRecommendations(res.recommendations || [])).catch(console.error)
    
    // Fetch History
    getHistoryApi().then(res => {
      setDownloadHistory(res)
    }).catch(console.error)
  }, [fetchHealth])"""

if old_effect in content:
    content = content.replace(old_effect, new_effect)
else:
    print("Could not find old effect")

# 4. Save settings using API
old_save_settings = """  // Save settings to localStorage on change
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY_CODEC, codec)
  }, [codec])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY_RESOLUTION, resolution)
  }, [resolution])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY_USE_WRAPPER, String(useWrapper))
  }, [useWrapper])

  useEffect(() => {
    // Only save volume if we're not muted, or if we want to save 0
    // Actually simpler to just save volume. Muted state is temporary or re-derived.
    localStorage.setItem(SETTINGS_KEY_VOLUME, String(volume))
  }, [volume])"""

new_save_settings = """  // Save settings to Backend DB
  useEffect(() => {
    saveSettingsApi({
      [SETTINGS_KEY_CODEC]: codec,
      [SETTINGS_KEY_RESOLUTION]: resolution,
      [SETTINGS_KEY_USE_WRAPPER]: useWrapper,
      [SETTINGS_KEY_VOLUME]: volume
    }).catch(console.error)
  }, [codec, resolution, useWrapper, volume])"""

if old_save_settings in content:
    content = content.replace(old_save_settings, new_save_settings)
else:
    print("Could not find old save settings")

# 5. Fix reportSearchApi usage
old_search_call = """      const response = await searchAppleMusic(searchKeyword)
      let list: SearchResult[] = []"""
new_search_call = """      const response = await searchAppleMusic(searchKeyword)
      reportSearchApi(searchKeyword).catch(console.error)
      let list: SearchResult[] = []"""

if old_search_call in content:
    content = content.replace(old_search_call, new_search_call)
else:
    print("Could not find search call")

with open(app_path, "w", encoding="utf-8") as f:
    f.write(content)

print("App.tsx fixed.")
