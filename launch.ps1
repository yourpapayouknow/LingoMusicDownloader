# ==============================================================
#  LingoMusicDownloader - Launch Script (PowerShell)
#  Startup order: WSL Wrapper -> Backend+Frontend (run_app.py)
# ==============================================================

$host.UI.RawUI.WindowTitle = "LingoMusicDownloader - Launching..."
$ErrorActionPreference = "Stop"   # Fail fast so errors are visible

# ── Resolve paths ──────────────────────────────────────────────
$ProjectDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython    = Join-Path $ProjectDir "venv\Scripts\python.exe"
$RunApp        = Join-Path $ProjectDir "run_app.py"
$WrapperExe    = Join-Path $ProjectDir "backend\wsl_wrapper\wrapper"

# Session DB written by wrapper after successful login (mirrors entrypoint.sh)
$SessionDB = Join-Path $ProjectDir `
    "backend\wsl_wrapper\rootfs\data\data\com.apple.android.music\files\mpl_db\kvs.sqlitedb"

# Convert Windows path to WSL path  (e.g. F:\Foo\Bar -> /mnt/f/Foo/Bar)
$driveLetter   = $ProjectDir.Substring(0, 1).ToLower()
$wslWrapperDir = "/mnt/$driveLetter/" + $ProjectDir.Substring(3).Replace("\", "/") + "/backend/wsl_wrapper"

# ── Port utilities (avoid $Host — that is a PowerShell reserved variable) ──
function Test-TcpPort ([string]$Addr, [int]$Port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect($Addr, $Port)
        $tcp.Close()
        return $true
    } catch { return $false }
}

function Wait-TcpPort ([string]$Addr, [int]$Port, [int]$TimeoutSec) {
    $deadline = [DateTime]::Now.AddSeconds($TimeoutSec)
    while ([DateTime]::Now -lt $deadline) {
        if (Test-TcpPort $Addr $Port) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# ── Banner ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "    LingoMusicDownloader - Starting up..." -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check venv ─────────────────────────────────────────
Write-Host "  [1/3] Checking Python virtual environment..." -ForegroundColor Yellow
if (-not (Test-Path $VenvPython)) {
    Write-Host "  [ERROR] Virtual environment not found." -ForegroundColor Red
    Write-Host "          Run these commands first:" -ForegroundColor Red
    Write-Host "            python -m venv venv" -ForegroundColor White
    Write-Host "            .\venv\Scripts\pip install -r backend\requirements.txt" -ForegroundColor White
    Write-Host "            .\venv\Scripts\pip install -r frontend\requirements.txt" -ForegroundColor White
    Read-Host "`n  Press Enter to exit"
    exit 1
}
Write-Host "  [OK]   venv found." -ForegroundColor Green

# ── Step 2: WSL Wrapper ────────────────────────────────────────
Write-Host ""
Write-Host "  [2/3] Apple Music Wrapper..." -ForegroundColor Yellow
$wrapperStarted = $false
$wrapperProc    = $null

if (-not (Test-Path $WrapperExe)) {
    Write-Host "  [SKIP] Wrapper binary not found." -ForegroundColor DarkYellow
    Write-Host "         Run: python backend\utils\setup_wsl.py" -ForegroundColor DarkYellow
} else {
    # ── 2a. Check if wrapper is already running ────────────────
    if (Test-TcpPort "127.0.0.1" 10020) {
        Write-Host "  [OK]   Wrapper already running on port 10020." -ForegroundColor Green
        $wrapperStarted = $true
    } else {
        # ── 2b. Check WSL availability ─────────────────────────
        $wslOk = $false
        try { $null = wsl --status 2>&1; $wslOk = $true } catch {}

        if (-not $wslOk) {
            Write-Host "  [SKIP] WSL not available. AAC-only mode." -ForegroundColor DarkYellow
        } else {
            & wsl bash -c "chmod +x '$wslWrapperDir/wrapper'" 2>$null

            if (-not (Test-Path $SessionDB)) {
                # ── 2c. First-run: interactive Apple ID login ──
                Write-Host ""
                Write-Host "  -------------------------------------------------------" -ForegroundColor Yellow
                Write-Host "   First-time Setup: Apple ID Login" -ForegroundColor Yellow
                Write-Host "  -------------------------------------------------------" -ForegroundColor Yellow
                Write-Host "  1. Enter your Apple ID credentials below." -ForegroundColor White
                Write-Host "  2. A Wrapper window opens — approve 2FA on your phone." -ForegroundColor White
                Write-Host "  3. When the Wrapper shows it is serving," -ForegroundColor White
                Write-Host "     return here and press Enter." -ForegroundColor White
                Write-Host "  NOTE: Keep the Wrapper window open while the app runs." -ForegroundColor Yellow
                Write-Host "  -------------------------------------------------------" -ForegroundColor Yellow
                Write-Host ""

                $appleId  = Read-Host "  Apple ID (email)"
                $securePw = Read-Host "  Apple ID password" -AsSecureString
                $bstr     = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePw)
                $plainPw  = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
                [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

                # Use cmd.exe /K so the window stays open and the user can see output.
                # bash -lc uses a login shell for the full WSL environment.
                $loginBashCmd = "cd '$wslWrapperDir' && ./wrapper -L '$appleId`:$plainPw' -H 0.0.0.0"
                $wrapperProc = Start-Process "cmd.exe" `
                    -ArgumentList "/K", "wsl bash -lc `"$loginBashCmd`"" `
                    -WindowStyle Normal -PassThru

                Write-Host ""
                Write-Host "  Wrapper is starting — approve 2FA on your phone." -ForegroundColor Cyan
                Write-Host ""
                Read-Host "  Press Enter here once the Wrapper window shows it is serving"

                if (Test-TcpPort "127.0.0.1" 10020) {
                    Write-Host "  [OK]   Wrapper confirmed on port 10020." -ForegroundColor Green
                    $wrapperStarted = $true
                } else {
                    Write-Host "  [WARN] Port 10020 not open — Wrapper may not have started." -ForegroundColor DarkYellow
                    Write-Host "         ALAC/Atmos downloads will not work." -ForegroundColor DarkYellow
                }

            } else {
                # ── 2d. Session exists: start in server mode ───
                Write-Host "  Session found — starting Wrapper in server mode..." -ForegroundColor Gray

                # Use cmd.exe /K so the window stays open and errors are visible.
                # bash -lc uses a login shell for the full WSL environment.
                $serverBashCmd = "cd '$wslWrapperDir' && ./wrapper -H 0.0.0.0"
                $wrapperProc = Start-Process "cmd.exe" `
                    -ArgumentList "/K", "wsl bash -lc `"$serverBashCmd`"" `
                    -WindowStyle Normal -PassThru

                Write-Host "  Waiting for port 10020 (up to 20 s)..." -ForegroundColor Gray
                if (Wait-TcpPort "127.0.0.1" 10020 20) {
                    Write-Host "  [OK]   Port 10020 open." -ForegroundColor Green

                    Write-Host "  Waiting for port 20020 (up to 10 s)..." -ForegroundColor Gray
                    if (Wait-TcpPort "127.0.0.1" 20020 10) {
                        Write-Host "  [OK]   Port 20020 open. Wrapper fully ready." -ForegroundColor Green
                    } else {
                        Write-Host "  [WARN] Port 20020 not ready yet." -ForegroundColor DarkYellow
                    }
                    $wrapperStarted = $true
                } else {
                    Write-Host ""
                    Write-Host "  [ERROR] Wrapper did not start in 20 s." -ForegroundColor Red
                    Write-Host "          Check the Wrapper window for error messages." -ForegroundColor Red
                    Write-Host "          Common fix: re-run  python backend\utils\setup_wsl.py" -ForegroundColor White
                    Write-Host ""
                    Read-Host "  Press Enter to continue in AAC-only mode"
                }
            }
        }
    }
}

# ── Step 3: Launch Backend + Frontend ─────────────────────────
Write-Host ""
Write-Host "  [3/3] Launching LingoMusicDownloader..." -ForegroundColor Yellow
Write-Host ""

$host.UI.RawUI.WindowTitle = "LingoMusicDownloader - Running"
Set-Location $ProjectDir
$env:PYTHONPATH = $ProjectDir

& $VenvPython $RunApp

# ── Cleanup ────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Application closed. Cleaning up..." -ForegroundColor Cyan
if ($wrapperStarted) {
    & wsl bash -c "pkill -f './wrapper' 2>/dev/null; true" 2>$null
    Write-Host "  [OK]   Wrapper stopped." -ForegroundColor Green
}
Write-Host ""
Write-Host "  Goodbye!" -ForegroundColor Cyan
Start-Sleep -Seconds 2
