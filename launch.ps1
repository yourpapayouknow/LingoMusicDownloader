# ==============================================================
#  LingoMusicDownloader Legacy - Launcher (Tauri + FastAPI)
#  用途：安全启动遗留版前端与后端
# ==============================================================
#requires -Version 7.0

$ErrorActionPreference = "Stop"
$host.UI.RawUI.WindowTitle = "LingoMusicDownloader Legacy - Launching"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectName = Split-Path -Leaf $ProjectDir
$ParentDir = Split-Path -Parent $ProjectDir
$PrimaryProjectDir = if ($ProjectName -like "*_legacy") {
    Join-Path $ParentDir ($ProjectName -replace "_legacy$", "")
} else {
    Join-Path $ParentDir "LingoMusicDownloader"
}

$LocalDotVenvPython = Join-Path $ProjectDir ".venv\Scripts\python.exe"
$VenvPython = if (Test-Path $LocalDotVenvPython) { $LocalDotVenvPython } else { $null }
$LockStamp = Join-Path $ProjectDir ".venv\.uv_lock.sha256"

$BackendEntry = Join-Path $ProjectDir "run_backend.py"
$BackendOut = Join-Path $ProjectDir "backend_live.out"
$BackendErr = Join-Path $ProjectDir "backend_live.err"
$FrontendDir = Join-Path $ProjectDir "frontend"
$NodeModulesDir = Join-Path $FrontendDir "node_modules"
$ReleaseExe = Join-Path $FrontendDir "src-tauri\target\release\lingo-music-downloader.exe"
$LegacyWrapperDir = Join-Path $ProjectDir "backend\wsl_wrapper"
$PrimaryWrapperDir = Join-Path $PrimaryProjectDir "backend\wsl_wrapper"
$LegacyWrapperBinary = Join-Path $LegacyWrapperDir "wrapper"
$LegacyWrapperLinker = Join-Path $LegacyWrapperDir "rootfs\system\bin\linker64"
$PrimaryWrapperBinary = Join-Path $PrimaryWrapperDir "wrapper"
$PrimaryWrapperLinker = Join-Path $PrimaryWrapperDir "rootfs\system\bin\linker64"
$LegacyBinDir = Join-Path $ProjectDir "bin"
$PrimaryBinDir = Join-Path $PrimaryProjectDir "bin"
$LegacyMp4Decrypt = Join-Path $LegacyBinDir "mp4decrypt.exe"
$LegacyFfmpeg = Join-Path $LegacyBinDir "ffmpeg\ffmpeg.exe"
$PrimaryMp4Decrypt = Join-Path $PrimaryBinDir "mp4decrypt.exe"
$PrimaryFfmpegDir = Join-Path $PrimaryBinDir "ffmpeg"
$PrimaryFfmpeg = Join-Path $PrimaryFfmpegDir "ffmpeg.exe"
$LegacyCookies = Join-Path $ProjectDir "cookies.txt"
$PrimaryCookies = Join-Path $PrimaryProjectDir "cookies.txt"

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

function Get-ListeningProcessId([int]$Port) {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $connection) {
        return $null
    }
    return [int]$connection.OwningProcess
}

function Get-ProcessCommandLine([int]$ProcessId) {
    try {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
        return [string]($proc.CommandLine)
    } catch {
        return ""
    }
}

function Stop-RepoBackendOnPort([int]$Port) {
    $processId = Get-ListeningProcessId $Port
    if ($null -eq $processId) {
        return
    }

    $cmd = Get-ProcessCommandLine $processId
    $procInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    $parentInfo = if ($procInfo) {
        Get-CimInstance Win32_Process -Filter "ProcessId = $($procInfo.ParentProcessId)" -ErrorAction SilentlyContinue
    } else {
        $null
    }
    $ownedByRepo = ($cmd -like "*$ProjectDir*") -or
        ($procInfo.ExecutablePath -like "$ProjectDir*") -or
        ($parentInfo.ExecutablePath -like "$ProjectDir*")
    if ($ownedByRepo -and $cmd -like "*run_backend.py*") {
        Write-Host "  [INFO] Port $Port is occupied by this project's backend, stopping it first..." -ForegroundColor DarkYellow
        Stop-Process -Id $processId -Force -ErrorAction Stop
        Start-Sleep -Milliseconds 800
        return
    }

    Write-Host "  [ERROR] Port $Port is occupied by an unrelated process." -ForegroundColor Red
    Write-Host "          PID: $processId" -ForegroundColor Yellow
    if ($cmd) {
        Write-Host "          Command: $cmd" -ForegroundColor Yellow
    }
    Read-Host "`n  Press Enter to exit"
    exit 1
}

function Find-LegacyFrontendProcess {
    try {
        $processes = Get-Process -Name "lingo-music-downloader" -ErrorAction SilentlyContinue
        foreach ($process in $processes) {
            try {
                if ($process.Path -and $process.Path.StartsWith($ProjectDir, [System.StringComparison]::OrdinalIgnoreCase)) {
                    return $process
                }
            } catch {
                continue
            }
        }
    } catch {
        return $null
    }
    return $null
}

function Ensure-LegacyCookies {
    if (Test-Path $LegacyCookies) {
        return
    }
    if (Test-Path $PrimaryCookies) {
        Copy-Item $PrimaryCookies $LegacyCookies -Force
        Write-Host "  [OK] Synced cookies.txt into the legacy workspace." -ForegroundColor Green
    }
}

function Ensure-LegacyWrapperAssets {
    $wrapperReady = (Test-Path $LegacyWrapperBinary) -and (Test-Path $LegacyWrapperLinker)
    if ($wrapperReady) {
        return
    }

    $primaryReady = (Test-Path $PrimaryWrapperBinary) -and (Test-Path $PrimaryWrapperLinker)
    if (-not $primaryReady) {
        Write-Host "  [WARN] Legacy Wrapper runtime files are missing, and no shared local copy was found." -ForegroundColor DarkYellow
        return
    }

    Write-Host "  [INFO] Syncing local legacy Wrapper runtime into the legacy workspace..." -ForegroundColor Gray
    New-Item -ItemType Directory -Force -Path $LegacyWrapperDir | Out-Null
    Copy-Item (Join-Path $PrimaryWrapperDir "*") $LegacyWrapperDir -Recurse -Force
    Write-Host "  [OK] Legacy Wrapper runtime synced." -ForegroundColor Green
}

function Ensure-LegacyBinaryAssets {
    $binsReady = (Test-Path $LegacyMp4Decrypt) -and (Test-Path $LegacyFfmpeg)
    if ($binsReady) {
        return
    }

    $primaryReady = (Test-Path $PrimaryMp4Decrypt) -and (Test-Path $PrimaryFfmpeg)
    if (-not $primaryReady) {
        Write-Host "  [WARN] Legacy binary tools are missing, and no shared local copy was found." -ForegroundColor DarkYellow
        Write-Host "         Please place mp4decrypt.exe and ffmpeg under: $LegacyBinDir" -ForegroundColor DarkYellow
        return
    }

    Write-Host "  [INFO] Syncing binary tools into the legacy workspace..." -ForegroundColor Gray
    New-Item -ItemType Directory -Force -Path $LegacyBinDir | Out-Null
    Copy-Item (Join-Path $PrimaryBinDir "*") $LegacyBinDir -Recurse -Force
    Write-Host "  [OK] Binary tools synced into legacy bin." -ForegroundColor Green
}

function Ensure-FrontendDependencies {
    if (Test-Path $NodeModulesDir) {
        return
    }

    Write-Host "  [INFO] Installing legacy frontend dependencies..." -ForegroundColor Gray
    Push-Location $FrontendDir
    try {
        & npm install
    } finally {
        Pop-Location
    }
    Write-Host "  [OK] Legacy frontend dependencies are ready." -ForegroundColor Green
}

function Resolve-UvBinary {
    # 查找uv可执行文件
    $uvCmd = Get-Command "uv" -ErrorAction SilentlyContinue
    if ($uvCmd) {
        return $uvCmd.Source
    }
    $userUv = Join-Path $env:USERPROFILE ".local\bin\uv.exe"
    if (Test-Path $userUv) {
        return $userUv
    }
    return $null
}

function Ensure-LegacyPythonEnv {
    # 使用uv创建并同步遗留端Python环境（唯一依赖源：pyproject.toml + uv.lock）
    $uvExe = Resolve-UvBinary
    if (-not $uvExe) {
        Write-Host "  [ERROR] uv is required but was not found in PATH." -ForegroundColor Red
        Write-Host "          Install uv from https://docs.astral.sh/uv/ and retry." -ForegroundColor Yellow
        Read-Host "`n  Press Enter to exit"
        exit 1
    }

    if (-not (Test-Path $LocalDotVenvPython)) {
        Write-Host "  [INFO] Creating isolated legacy Python environment with uv..." -ForegroundColor Gray
        & $uvExe venv (Join-Path $ProjectDir ".venv") --python 3.11
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $LocalDotVenvPython)) {
            Write-Host "  [ERROR] Failed to create the legacy virtual environment via uv." -ForegroundColor Red
            Read-Host "`n  Press Enter to exit"
            exit 1
        }
    }

    $syncTarget = Join-Path $ProjectDir "uv.lock"
    $currentHash = (Get-FileHash -Algorithm SHA256 $syncTarget).Hash
    $storedHash = if (Test-Path $LockStamp) {
        (Get-Content $LockStamp -ErrorAction SilentlyContinue | Select-Object -First 1)
    } else {
        ""
    }

    if ($currentHash -ne $storedHash) {
        Write-Host "  [INFO] Syncing legacy backend dependencies with uv..." -ForegroundColor Gray
        Push-Location $ProjectDir
        try {
            & $uvExe sync --locked
        } finally {
            Pop-Location
        }
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [ERROR] Failed to install legacy backend dependencies via uv." -ForegroundColor Red
            Read-Host "`n  Press Enter to exit"
            exit 1
        }
        Set-Content -Path $LockStamp -Value $currentHash -Encoding ASCII
        Write-Host "  [OK] Legacy backend dependencies are ready (uv)." -ForegroundColor Green
    }

    $script:VenvPython = $LocalDotVenvPython
    $VenvPython = $LocalDotVenvPython
}

function Wait-BackendReady {
    $deadline = [DateTime]::Now.AddSeconds(25)
    while ([DateTime]::Now -lt $deadline) {
        try {
            $null = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/status" -Method Get -TimeoutSec 3
            return $true
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    return $false
}

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "    LingoMusicDownloader Legacy - Starting" -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $BackendEntry)) {
    Write-Host "  [ERROR] Missing backend entry: $BackendEntry" -ForegroundColor Red
    Read-Host "`n  Press Enter to exit"
    exit 1
}

Ensure-LegacyPythonEnv
Ensure-LegacyCookies
Ensure-LegacyWrapperAssets
Ensure-LegacyBinaryAssets
Ensure-FrontendDependencies

Write-Host "  [1/2] Checking backend (http://127.0.0.1:8000)..." -ForegroundColor Yellow
Stop-RepoBackendOnPort 8000

if (-not (Test-TcpPort "127.0.0.1" 8000)) {
    Write-Host "  [INFO] Legacy backend is not running, starting now..." -ForegroundColor Gray
    if (Test-Path $BackendOut) { Remove-Item $BackendOut -Force }
    if (Test-Path $BackendErr) { Remove-Item $BackendErr -Force }

    Start-Process -FilePath $VenvPython `
        -ArgumentList "run_backend.py" `
        -WorkingDirectory $ProjectDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $BackendOut `
        -RedirectStandardError $BackendErr | Out-Null
}

if (Wait-BackendReady) {
    Write-Host "  [OK] Legacy backend is ready." -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Legacy backend failed to start on port 8000." -ForegroundColor Red
    Write-Host "          See: $BackendErr" -ForegroundColor Yellow
    Read-Host "`n  Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "  [2/2] Starting legacy desktop app..." -ForegroundColor Yellow

$existingFrontend = Find-LegacyFrontendProcess
if ($null -ne $existingFrontend) {
    Write-Host "  [OK] Legacy desktop app is already running." -ForegroundColor Green
} elseif (Test-Path $ReleaseExe) {
    Start-Process -FilePath $ReleaseExe -WorkingDirectory (Split-Path -Parent $ReleaseExe) | Out-Null
    Write-Host "  [OK] Legacy release app started." -ForegroundColor Green
} else {
    Write-Host "  [INFO] No legacy release build found, starting 'npm run tauri dev'..." -ForegroundColor Gray
    Start-Process -FilePath "pwsh" `
        -ArgumentList "-NoLogo", "-NoExit", "-Command", "npm run tauri dev" `
        -WorkingDirectory $FrontendDir | Out-Null
    Write-Host "  [OK] Legacy dev mode command launched." -ForegroundColor Green
}

Write-Host ""
Write-Host "  Legacy launcher finished." -ForegroundColor Cyan
Start-Sleep -Seconds 1
