import re

app_path = "f:/College/Activ_CodeProjects/PycharmProjects/LingoMusicDownloader/frontend/src/App.tsx"

with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

old_init = """  useEffect(() => {
    // Initial fetch
    fetchStatusAndHealth()

    // Poll every 3 seconds
    const interval = setInterval(fetchStatusAndHealth, 3000)
    return () => clearInterval(interval)
  }, [fetchStatusAndHealth])"""

new_init = """  useEffect(() => {
    // Initial fetch
    fetchStatusAndHealth()
    
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

    // Poll every 3 seconds
    const interval = setInterval(fetchStatusAndHealth, 3000)
    return () => clearInterval(interval)
  }, [fetchStatusAndHealth])"""

if old_init in content:
    content = content.replace(old_init, new_init)
else:
    print("WARNING: Could not find old init block")

with open(app_path, "w", encoding="utf-8") as f:
    f.write(content)

print("App.tsx fixed init block.")
