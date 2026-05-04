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

        # ── Detect first run: check for session marker from setup_wsl.py ──
        $isFirstRun = -not (Test-Path $SessionMarker)

        if ($isFirstRun) {
            # ── First run: need Apple ID login ────────────────
            Write-Host ""
            Write-Host "  -------------------------------------------------------" -ForegroundColor Yellow
            Write-Host "   First Run: Apple ID Login Required" -ForegroundColor Yellow
            Write-Host "  -------------------------------------------------------" -ForegroundColor Yellow
            Write-Host "  The Wrapper must authenticate with Apple Music once." -ForegroundColor White
            Write-Host "  If 2FA is needed, you will be prompted in this window." -ForegroundColor White
            Write-Host "  -------------------------------------------------------" -ForegroundColor Yellow
            Write-Host ""
            $appleId = Read-Host "  Enter your Apple ID (email)"
            $securePw = Read-Host "  Enter your Apple ID password" -AsSecureString
            $bstr    = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePw)
            $plainPw = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

            Write-Host ""
            Write-Host "  Logging in... complete any 2FA prompt that appears." -ForegroundColor Cyan

            # Run visibly so the user can interact with 2FA
            $loginCmd = "cd '$wslWrapperDir' && ./wrapper -L '${appleId}:${plainPw}' -H 0.0.0.0"
            $wrapperProc = Start-Process -FilePath "wsl" `
                                         -ArgumentList "-e", "bash", "-c", $loginCmd `
                                         -PassThru  # Normal (visible) window for 2FA interaction

            Write-Host "  Waiting 10 seconds for login to complete..." -ForegroundColor Gray
            Start-Sleep -Seconds 10
            $wrapperStarted = $true
        } else {
            # ── Normal start: session already exists ──────────
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
