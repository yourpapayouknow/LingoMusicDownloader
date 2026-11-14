# ==============================================================
#  create_shortcut.ps1 - 创建桌面快捷方式
#  目标：pwsh.exe -> launch.ps1
# ==============================================================
#requires -Version 7.0

$ProjectDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$LaunchScript = Join-Path $ProjectDir "launch.ps1"
$IconPath     = Join-Path $ProjectDir "frontend\src-tauri\icons\icon.ico"
$DesktopPath  = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "LingoMusicDownloader.lnk"
$PowerShellExe = (Get-Command "pwsh.exe" -ErrorAction SilentlyContinue).Source
if (-not $PowerShellExe) {
    Write-Host "  [ERROR] pwsh.exe was not found in PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $IconPath)) {
    # Fallback: use a generic app icon from shell32
    $IconPath = "$env:SystemRoot\System32\shell32.dll,109"
}

Write-Host ""
Write-Host "  =================================================="
Write-Host "    LingoMusicDownloader - Shortcut Creator"
Write-Host "  =================================================="
Write-Host ""

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

# 目标：pwsh.exe 以 -File 参数启动 launch.ps1
$Shortcut.TargetPath       = $PowerShellExe
$Shortcut.Arguments        = "-ExecutionPolicy Bypass -NoProfile -File `"$LaunchScript`""
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.WindowStyle      = 1                    # 1 = Normal window
$Shortcut.Description      = "Launch LingoMusicDownloader (WSL Wrapper + Backend + Frontend)"
$Shortcut.IconLocation     = $IconPath

$Shortcut.Save()

Write-Host "  [OK] Shortcut created successfully:" -ForegroundColor Green
Write-Host "       $ShortcutPath" -ForegroundColor White
Write-Host ""
Write-Host "  Target : $PowerShellExe" -ForegroundColor Gray
Write-Host "  Script : $LaunchScript" -ForegroundColor Gray
Write-Host ""
Write-Host "  Double-click 'LingoMusicDownloader' on your Desktop to launch!" -ForegroundColor Cyan
Write-Host ""
