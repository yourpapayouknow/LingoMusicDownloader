# ==============================================================
#  LingoMusicDownloader - Launch Script (PowerShell)
#  Startup order: WSL Wrapper -> Backend+Frontend (run_app.py)
# ==============================================================

$host.UI.RawUI.WindowTitle = "LingoMusicDownloader - Launching..."
$ErrorActionPreference = "Continue"

# ── Resolve paths ──────────────────────────────────────────────
$ProjectDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython    = Join-Path $ProjectDir "venv\Scripts\python.exe"
$RunApp        = Join-Path $ProjectDir "run_app.py"
$WrapperExe    = Join-Path $ProjectDir "backend\wsl_wrapper\wrapper"

# Session is confirmed by the SQLite database the wrapper writes after login.
# Path mirrors entrypoint.sh: TOKEN_DB_PATH="/app/rootfs/data/data/.../kvs.sqlitedb"
$SessionDB     = Join-Path $ProjectDir `
    "backend\wsl_wrapper\rootfs\data\data\com.apple.android.music\files\mpl_db\kvs.sqlitedb"

# Convert Windows path to WSL path  (e.g. F:\Foo\Bar -> /mnt/f/Foo/Bar)
$driveLetter   = $ProjectDir.Substring(0, 1).ToLower()
$wslWrapperDir = "/mnt/$driveLetter/" + $ProjectDir.Substring(3).Replace("\", "/") + "/backend/wsl_wrapper"

# ── Helper: poll a TCP port until open or timeout ──────────────
function Wait-Port {
    param(
        [string]$Host   = "127.0.0.1",
        [int]   $Port   = 10020,
        [int]   $Timeout = 20   # seconds
    )
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $Timeout) {
        try {
            $tcp = [System.Net.Sockets.TcpClient]::new()
            $tcp.Connect($Host, $Port)
            $tcp.Close()
            return $true
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

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
        Write-Host "  [WARN] WSL is not available. Skipping Wrapper." -ForegroundColor DarkYellow
    } else {
        # Set execute permission
        & wsl -e bash -c "chmod +x '$wslWrapperDir/wrapper'" 2>$null

        $isLoggedIn = Test-Path $SessionDB

        if (-not $isLoggedIn) {
            # ── First run: interactive Apple ID login ──────────
            Write-Host ""
            Write-Host "  -------------------------------------------------------" -ForegroundColor Yellow
            Write-Host "   Wrapper: First-time Apple ID Login" -ForegroundColor Yellow
            Write-Host "  -------------------------------------------------------" -ForegroundColor Yellow
            Write-Host "  Step 1: Enter your Apple ID credentials below." -ForegroundColor White
            Write-Host "  Step 2: A new window will open - watch for output." -ForegroundColor White
            Write-Host "  Step 3: Approve the 2FA request on your phone." -ForegroundColor White
            Write-Host "  Step 4: Once you see the Wrapper serving, come back" -ForegroundColor White
            Write-Host "          here and press Enter to launch the app." -ForegroundColor White
            Write-Host "  NOTE:   Do NOT close the Wrapper window - it must" -ForegroundColor Yellow
            Write-Host "          stay open while the app is running." -ForegroundColor Yellow
            Write-Host "  -------------------------------------------------------" -ForegroundColor Yellow
            Write-Host ""

            $appleId  = Read-Host "  Enter your Apple ID (email)"
            $securePw = Read-Host "  Enter your Apple ID password" -AsSecureString
            $bstr     = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePw)
            $plainPw  = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

            $loginCmd = "cd '$wslWrapperDir' && ./wrapper -L '${appleId}:${plainPw}' -H 0.0.0.0"

            # Visible window: user interacts with 2FA.
            # Do NOT kill this process - it IS the serving instance.
            $wrapperProc = Start-Process -FilePath "wsl" `
                                         -ArgumentList "-e", "bash", "-c", $loginCmd `
                                         -WindowStyle Normal `
                                         -PassThru

            Write-Host ""
            Write-Host "  Wrapper is starting in the new window." -ForegroundColor Cyan
            Write-Host "  Approve the 2FA notification on your phone." -ForegroundColor Cyan
            Write-Host ""
            Read-Host "  Press Enter here once the Wrapper window shows it is serving"

            if (Test-Path $SessionDB) {
                Write-Host "  [OK]   Session confirmed (database found)." -ForegroundColor Green
            } else {
                Write-Host "  [WARN] Session database not found yet - may still be writing." -ForegroundColor DarkYellow
            }

            # Verify port 10020 is actually open (the login window should have it open)
            Write-Host "  Verifying Wrapper port 10020..." -ForegroundColor Gray
            if (Wait-Port -Port 10020 -Timeout 10) {
                Write-Host "  [OK]   Wrapper port 10020 is open." -ForegroundColor Green
                $wrapperStarted = $true
            } else {
                Write-Host "  [WARN] Port 10020 not responding. Wrapper may not have started." -ForegroundColor DarkYellow
                Write-Host "         ALAC/Atmos downloads may not work." -ForegroundColor DarkYellow
                $wrapperStarted = $false
            }

        } else {
            # ── Session exists: start Wrapper in server mode ───
            Write-Host "  Session found. Starting Wrapper in server mode..." -ForegroundColor Gray
            $serverCmd = "cd '$wslWrapperDir' && ./wrapper -H 0.0.0.0"

            # Start in a NORMAL window first so any startup errors are visible.
            # We will minimise it after confirming the port is open.
            $wrapperProc = Start-Process -FilePath "wsl" `
                                         -ArgumentList "-e", "bash", "-c", $serverCmd `
                                         -WindowStyle Normal `
                                         -PassThru

            Write-Host "  Waiting for Wrapper port 10020 (up to 20 seconds)..." -ForegroundColor Gray
            if (Wait-Port -Port 10020 -Timeout 20) {
                Write-Host "  [OK]   Wrapper is running on port 10020." -ForegroundColor Green

                # Also wait briefly for port 20020 (M3U8 proxy)
                if (Wait-Port -Port 20020 -Timeout 10) {
                    Write-Host "  [OK]   Wrapper M3U8 proxy on port 20020 is ready." -ForegroundColor Green
                } else {
                    Write-Host "  [WARN] Port 20020 (M3U8 proxy) not open yet." -ForegroundColor DarkYellow
                    Write-Host "         ALAC/Atmos may not work." -ForegroundColor DarkYellow
                }

                $wrapperStarted = $true
            } else {
                Write-Host "" -ForegroundColor Red
                Write-Host "  [ERROR] Wrapper failed to start within 20 seconds." -ForegroundColor Red
                Write-Host "          Check the Wrapper window above for error messages." -ForegroundColor Red
                Write-Host "          If you see 'Login required', run setup again:" -ForegroundColor Red
                Write-Host "            python backend\utils\setup_wsl.py" -ForegroundColor White
                Write-Host ""
                Write-Host "          AAC downloads will still work without the Wrapper." -ForegroundColor DarkYellow
                Read-Host "  Press Enter to continue anyway (AAC only)"
                $wrapperStarted = $false
            }
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
