# ==============================================================
#  LingoMusicDownloader - Launch Script (PowerShell)
#  Startup order: WSL Wrapper -> Backend+Frontend (run_app.py)
# ==============================================================

$host.UI.RawUI.WindowTitle = "LingoMusicDownloader - Launching..."
$ErrorActionPreference = "Continue"

# ── Resolve paths ──────────────────────────────────────────────
$ProjectDir     = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython     = Join-Path $ProjectDir "venv\Scripts\python.exe"
$RunApp         = Join-Path $ProjectDir "run_app.py"
$WrapperExe     = Join-Path $ProjectDir "backend\wsl_wrapper\wrapper"
$SessionMarker  = Join-Path $ProjectDir "backend\wsl_wrapper\.session_ready"

# Convert Windows path to WSL path  (e.g. F:\Foo\Bar -> /mnt/f/Foo/Bar)
$driveLetter    = $ProjectDir.Substring(0, 1).ToLower()
$wslWrapperDir  = "/mnt/$driveLetter/" + $ProjectDir.Substring(3).Replace("\", "/") + "/backend/wsl_wrapper"

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "    LingoMusicDownloader - Starting up..." -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check venv ─────────────────────────────────────────
Write-Host "  [1/3] Checking Python virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path $VenvPython)) {
    Write-Host "  [ERROR] Virtual environment not found." -ForegroundColor Red
    Write-Host "          Please run the following commands first:" -ForegroundColor Red
    Write-Host "            python -m venv venv" -ForegroundColor White
    Write-Host "            .\venv\Scripts\pip install -r backend\requirements.txt" -ForegroundColor White
    Write-Host "            .\venv\Scripts\pip install -r frontend\requirements.txt" -ForegroundColor White
    Read-Host "`n  Press Enter to exit"
    exit 1
}
Write-Host "  [OK]   venv found." -ForegroundColor Green

# ── Step 2: Start WSL Wrapper ──────────────────────────────────
Write-Host ""
Write-Host "  [2/3] Starting Apple Music Wrapper in WSL..." -ForegroundColor Yellow
$wrapperStarted = $false
$wrapperProc    = $null

if (-not (Test-Path $WrapperExe)) {
    Write-Host "  [WARN] Wrapper binary not found." -ForegroundColor DarkYellow
    Write-Host "         Run: python backend\utils\setup_wsl.py" -ForegroundColor DarkYellow
    Write-Host "         Skipping Wrapper. AAC downloads still work." -ForegroundColor DarkYellow
} else {
    # Check WSL availability
    try {
        $null = & wsl --status 2>&1
        $wslOk = $true
    } catch {
        $wslOk = $false
    }

    if (-not $wslOk) {
        Write-Host "  [WARN] WSL is not available on this system. Skipping Wrapper." -ForegroundColor DarkYellow
    } else {
        # Set execute permission
        & wsl -e bash -c "chmod +x '$wslWrapperDir/wrapper'" 2>$null

        # ── Check session marker written by setup_wsl.py ──────
        if (-not (Test-Path $SessionMarker)) {
            Write-Host ""
            Write-Host "  [WARN] No Wrapper session found." -ForegroundColor DarkYellow
            Write-Host "         ALAC / Atmos downloads require a one-time Apple ID login." -ForegroundColor DarkYellow
            Write-Host "         Please run the setup script in a terminal first:" -ForegroundColor DarkYellow
            Write-Host ""
            Write-Host "           python backend\utils\setup_wsl.py" -ForegroundColor White
            Write-Host ""
            Write-Host "         Skipping Wrapper for now. AAC downloads still work." -ForegroundColor DarkYellow
        } else {
            # ── Session exists: start Wrapper in server mode ───
            $serverCmd = "cd '$wslWrapperDir' && ./wrapper -H 0.0.0.0"
            $wrapperProc = Start-Process -FilePath "wsl" `
                                         -ArgumentList "-e", "bash", "-c", $serverCmd `
                                         -WindowStyle Minimized `
                                         -PassThru

            Write-Host "  [OK]   WSL Wrapper started (PID $($wrapperProc.Id), minimised)." -ForegroundColor Green
            Write-Host "         Waiting 4 seconds for Wrapper to initialise..." -ForegroundColor Gray
            Start-Sleep -Seconds 4
            $wrapperStarted = $true
        }
    }
}

# ── Step 3: Launch Backend + Frontend (run_app.py) ─────────────
Write-Host ""
Write-Host "  [3/3] Launching LingoMusicDownloader (Backend + Frontend)..." -ForegroundColor Yellow
Write-Host ""

$host.UI.RawUI.WindowTitle = "LingoMusicDownloader - Running"
Set-Location $ProjectDir
$env:PYTHONPATH = $ProjectDir

& $VenvPython $RunApp

# ── Cleanup on exit ────────────────────────────────────────────
Write-Host ""
Write-Host "  Application closed. Cleaning up..." -ForegroundColor Cyan

if ($wrapperStarted -and $wrapperProc -and -not $wrapperProc.HasExited) {
    Write-Host "  Stopping WSL Wrapper..." -ForegroundColor Gray
    & wsl -e bash -c "pkill -f './wrapper' 2>/dev/null; true" 2>$null
    Write-Host "  [OK]   Wrapper stopped." -ForegroundColor Green
}

Write-Host ""
Write-Host "  Goodbye!" -ForegroundColor Cyan
Start-Sleep -Seconds 2
