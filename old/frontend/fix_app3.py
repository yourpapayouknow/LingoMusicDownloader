import re

app_path = "f:/College/Activ_CodeProjects/PycharmProjects/LingoMusicDownloader/frontend/src/App.tsx"

with open(app_path, "r", encoding="utf-8") as f:
    content = f.read()

old_settings_block = """  // Persist Settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY_CODEC, codec)
  }, [codec])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY_RESOLUTION, resolution)
  }, [resolution])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY_USE_WRAPPER, String(useWrapper))
    // Automatically turn switch off if WSL Wrapper is not running
    if (healthStatus && !healthStatus.wrapper.all_ok && useWrapper) {
      setUseWrapper(false)
      pushToast('辅助组件异常', '检测到解密代理容器未运行，已自动关闭高品音质下载', 'error')
    }
  }, [useWrapper, healthStatus, pushToast])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY_VOLUME, String(volume))
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])"""

new_settings_block = """  // Persist Settings to API
  useEffect(() => {
    saveSettingsApi({
      [SETTINGS_KEY_CODEC]: codec,
      [SETTINGS_KEY_RESOLUTION]: resolution,
      [SETTINGS_KEY_USE_WRAPPER]: useWrapper,
      [SETTINGS_KEY_VOLUME]: volume
    }).catch(console.error)
  }, [codec, resolution, useWrapper, volume])

  useEffect(() => {
    // Automatically turn switch off if WSL Wrapper is not running
    if (healthStatus && !healthStatus.wrapper.all_ok && useWrapper) {
      setUseWrapper(false)
      pushToast('辅助组件异常', '检测到解密代理容器未运行，已自动关闭高品音质下载', 'error')
    }
  }, [useWrapper, healthStatus, pushToast])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])"""

if old_settings_block in content:
    content = content.replace(old_settings_block, new_settings_block)
else:
    print("WARNING: Could not find old settings block")

with open(app_path, "w", encoding="utf-8") as f:
    f.write(content)

print("App.tsx fixed settings saving.")
