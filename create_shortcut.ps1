# ==============================================================
#  create_shortcut.ps1 - Creates Desktop shortcut
#  Target: powershell.exe -> launch.ps1
# ==============================================================

$ProjectDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$LaunchScript = Join-Path $ProjectDir "launch.ps1"
$IconPath     = Join-Path $ProjectDir "frontend\assets\icon.ico"
$DesktopPath  = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "LingoMusicDownloader.lnk"
$PowerShellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

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

# Target: powershell.exe with -File argument pointing to launch.ps1
# This is the most reliable way to launch a PS1 from a desktop shortcut
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
