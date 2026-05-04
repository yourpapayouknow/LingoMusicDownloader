# ==============================================================
#  LingoMusicDownloader - Launch Script (PowerShell)
#  Startup order: WSL Wrapper -> Backend+Frontend (run_app.py)
# ==============================================================

$host.UI.RawUI.WindowTitle = "LingoMusicDownloader - Launching..."
$ErrorActionPreference = "Continue"

# ── Resolve paths ─────────────────────────────────────────────
$ProjectDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython   = Join-Path $ProjectDir "venv\Scripts\python.exe"
$RunApp       = Join-Path $ProjectDir "run_app.py"
$WrapperExe   = Join-Path $ProjectDir "backend\wsl_wrapper\wrapper"

# Convert Windows path to WSL path  (e.g. F:\Foo\Bar -> /mnt/f/Foo/Bar)
$driveLetter  = $ProjectDir.Substring(0, 1).ToLower()
$wslBase      = "/mnt/$driveLetter/" + $ProjectDir.Substring(3).Replace("\", "/")
$wslWrapperDir = "$wslBase/backend/wsl_wrapper"

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "    LingoMusicDownloader - Starting up..." -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check venv ────────────────────────────────────────
Write-Host "  [1/3] Checking Python virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path $VenvPython)) {
    Write-Host "  [ERROR] venv not found: $VenvPython" -ForegroundColor Red
    Write-Host "          Please run: python -m venv venv && pip install -r requirements.txt" -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "  [OK]   venv found." -ForegroundColor Green

# ── Step 2: Start WSL Wrapper ─────────────────────────────────
Write-Host ""
Write-Host "  [2/3] Starting Apple Music Wrapper in WSL..." -ForegroundColor Yellow

if (-not (Test-Path $WrapperExe)) {
    Write-Host "  [WARN] Wrapper binary not found at: $WrapperExe" -ForegroundColor DarkYellow
    Write-Host "         Run 'backend\utils\setup_wsl.py' to download it." -ForegroundColor DarkYellow
    Write-Host "         Skipping Wrapper. AAC downloads still work." -ForegroundColor DarkYellow
    $wrapperStarted = $false
} else {
    # Check WSL is available
    $wslCheck = & wsl --status 2>&1
    if ($LASTEXITCODE -ne 0 -and -not ($wslCheck -match "WSL")) {
        Write-Host "  [WARN] WSL does not appear to be running. Skipping Wrapper." -ForegroundColor DarkYellow
        $wrapperStarted = $false
    } else {
        # Set execute permission and launch wrapper in a new minimised window
        & wsl -e bash -c "chmod +x '$wslWrapperDir/wrapper'" 2>$null

        $wrapperArgs = "-e bash -c `"cd '$wslWrapperDir' && ./wrapper -H 0.0.0.0`""
        $wrapperProc = Start-Process -FilePath "wsl" `
                                     -ArgumentList $wrapperArgs `
                                     -WindowStyle Minimized `
                                     -PassThru

        Write-Host "  [OK]   WSL Wrapper started (PID $($wrapperProc.Id), minimised)." -ForegroundColor Green
        Write-Host "         Waiting 4 seconds for Wrapper to initialise..." -ForegroundColor Gray
        Start-Sleep -Seconds 4
        $wrapperStarted = $true
    }
}

# ── Step 3: Start Backend + Frontend (run_app.py) ─────────────
Write-Host ""
Write-Host "  [3/3] Launching LingoMusicDownloader (Backend + Frontend)..." -ForegroundColor Yellow
Write-Host ""

$host.UI.RawUI.WindowTitle = "LingoMusicDownloader - Running"

Set-Location $ProjectDir
$env:PYTHONPATH = $ProjectDir

& $VenvPython $RunApp

# ── Cleanup on exit ───────────────────────────────────────────
Write-Host ""
Write-Host "  Application closed. Cleaning up..." -ForegroundColor Cyan

if ($wrapperStarted -and $wrapperProc -and -not $wrapperProc.HasExited) {
    Write-Host "  Stopping WSL Wrapper..." -ForegroundColor Gray
    # Kill via WSL pkill to cleanly stop the wrapper process inside WSL
    & wsl -e bash -c "pkill -f './wrapper' 2>/dev/null; true" 2>$null
    Write-Host "  [OK]   Wrapper stopped." -ForegroundColor Green
}

Write-Host ""
Write-Host "  Goodbye!" -ForegroundColor Cyan
Start-Sleep -Seconds 2
