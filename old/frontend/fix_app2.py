import re

app_path = "f:/College/Activ_CodeProjects/PycharmProjects/LingoMusicDownloader/frontend/src/App.tsx"

with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update fetchStatusAndHealth effect to also fetch db stuff initially
old_init_effect = """  useEffect(() => {
    // Initial fetch
    fetchStatusAndHealth()

    // Poll every 3 seconds
    const interval = setInterval(fetchStatusAndHealth, 3000)
    return () => clearInterval(interval)
  }, [fetchStatusAndHealth])"""

new_init_effect = """  useEffect(() => {
    // Initial fetch
    fetchStatusAndHealth()
    
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
    }).catch(console.error)

    // Poll every 3 seconds
    const interval = setInterval(fetchStatusAndHealth, 3000)
    return () => clearInterval(interval)
  }, [fetchStatusAndHealth])"""

if old_init_effect in content:
    content = content.replace(old_init_effect, new_init_effect)
else:
    print("WARNING: Could not find old init effect")


# 2. Replace the 4 effects with localStorage
old_storage_effects = """  // Save settings to localStorage on change
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

new_storage_effects = """  // Save settings to API on change
  useEffect(() => {
    saveSettingsApi({
      [SETTINGS_KEY_CODEC]: codec,
      [SETTINGS_KEY_RESOLUTION]: resolution,
      [SETTINGS_KEY_USE_WRAPPER]: useWrapper,
      [SETTINGS_KEY_VOLUME]: volume
    }).catch(console.error)
  }, [codec, resolution, useWrapper, volume])"""

if old_storage_effects in content:
    content = content.replace(old_storage_effects, new_storage_effects)
else:
    print("WARNING: Could not find old storage effects")

with open(app_path, "w", encoding="utf-8") as f:
    f.write(content)

print("App.tsx fixed successfully")
