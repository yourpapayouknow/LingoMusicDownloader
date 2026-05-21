# ==============================================================
#  LingoMusicDownloader - Launcher (Tauri + FastAPI)
#  Start order: Backend API -> Desktop App
# ==============================================================

$ErrorActionPreference = "Stop"
$host.UI.RawUI.WindowTitle = "LingoMusicDownloader - Launching"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $ProjectDir "venv\Scripts\python.exe"
$BackendEntry = Join-Path $ProjectDir "run_backend.py"
$BackendOut = Join-Path $ProjectDir "backend_live.out"
$BackendErr = Join-Path $ProjectDir "backend_live.err"

$ReleaseExe = Join-Path $ProjectDir "frontend\src-tauri\target\release\lingo-music-downloader.exe"
$DebugExe = Join-Path $ProjectDir "frontend\src-tauri\target\debug\lingo-music-downloader.exe"

function Test-TcpPort([string]$Address, [int]$Port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect($Address, $Port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "    LingoMusicDownloader - Starting" -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $VenvPython)) {
    Write-Host "  [ERROR] Missing virtual environment: $VenvPython" -ForegroundColor Red
    Write-Host "          Run: python -m venv venv" -ForegroundColor Yellow
    Read-Host "`n  Press Enter to exit"
    exit 1
}

if (-not (Test-Path $BackendEntry)) {
    Write-Host "  [ERROR] Missing backend entry: run_backend.py" -ForegroundColor Red
    Read-Host "`n  Press Enter to exit"
    exit 1
}

Write-Host "  [1/2] Checking backend (http://127.0.0.1:8000)..." -ForegroundColor Yellow
if (-not (Test-TcpPort "127.0.0.1" 8000)) {
    Write-Host "  [INFO] Backend is not running, starting now..." -ForegroundColor Gray
    if (Test-Path $BackendOut) { Remove-Item $BackendOut -Force }
    if (Test-Path $BackendErr) { Remove-Item $BackendErr -Force }

    Start-Process -FilePath $VenvPython `
        -ArgumentList "run_backend.py" `
        -WorkingDirectory $ProjectDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $BackendOut `
        -RedirectStandardError $BackendErr | Out-Null

    $deadline = [DateTime]::Now.AddSeconds(20)
    while ([DateTime]::Now -lt $deadline) {
        if (Test-TcpPort "127.0.0.1" 8000) { break }
        Start-Sleep -Milliseconds 400
    }
}

if (Test-TcpPort "127.0.0.1" 8000) {
    Write-Host "  [OK] Backend is ready." -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Backend failed to start on port 8000." -ForegroundColor Red
    Write-Host "          See: backend_live.err" -ForegroundColor Yellow
    Read-Host "`n  Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "  [2/2] Starting desktop app..." -ForegroundColor Yellow

if (Test-Path $ReleaseExe) {
    Start-Process -FilePath $ReleaseExe -WorkingDirectory (Split-Path -Parent $ReleaseExe) | Out-Null
    Write-Host "  [OK] Release app started." -ForegroundColor Green
} elseif (Test-Path $DebugExe) {
    Start-Process -FilePath $DebugExe -WorkingDirectory (Split-Path -Parent $DebugExe) | Out-Null
    Write-Host "  [OK] Debug app started." -ForegroundColor Green
} else {
    Write-Host "  [WARN] Tauri executable not found, fallback to npm tauri dev..." -ForegroundColor DarkYellow
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/K", "cd /d `"$ProjectDir\frontend`" && npm run tauri dev" `
        -WorkingDirectory (Join-Path $ProjectDir "frontend") | Out-Null
    Write-Host "  [OK] Dev mode command launched." -ForegroundColor Green
}

Write-Host ""
Write-Host "  Launcher finished. Enjoy!" -ForegroundColor Cyan
Start-Sleep -Seconds 1
