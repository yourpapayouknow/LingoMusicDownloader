# ==============================================================
#  LingoMusicDownloader Legacy - Launcher (Tauri + FastAPI)
#  Purpose: start the frozen legacy frontend/backend pair safely
# ==============================================================

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

$LocalVenvPython = Join-Path $ProjectDir "venv\Scripts\python.exe"
$SharedVenvPython = Join-Path $PrimaryProjectDir "venv\Scripts\python.exe"
$VenvPython = $null
$RequirementsFile = Join-Path $ProjectDir "backend\requirements.txt"
$RequirementsStamp = Join-Path $ProjectDir "venv\.backend_requirements.sha256"

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
    if ($cmd -like "*run_backend.py*") {
        Write-Host "  [INFO] Port $Port is occupied by another project backend, stopping it first..." -ForegroundColor DarkYellow
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

function Resolve-BootstrapPython {
    if (Test-Path $SharedVenvPython) {
        return @{
            Path = $SharedVenvPython
            PrefixArgs = @()
        }
    }

    $pythonCmd = Get-Command "python" -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        return @{
            Path = $pythonCmd.Source
            PrefixArgs = @()
        }
    }

    $pyCmd = Get-Command "py" -ErrorAction SilentlyContinue
    if ($pyCmd) {
        return @{
            Path = $pyCmd.Source
            PrefixArgs = @("-3")
        }
    }

    return $null
}

function Ensure-LegacyPythonEnv {
    $bootstrap = Resolve-BootstrapPython
    if ($null -eq $bootstrap) {
        Write-Host "  [ERROR] Missing Python interpreter for legacy environment bootstrap." -ForegroundColor Red
        Write-Host "          Checked shared venv plus PATH commands: python / py" -ForegroundColor Yellow
        Read-Host "`n  Press Enter to exit"
        exit 1
    }

    if (-not (Test-Path $RequirementsFile)) {
        Write-Host "  [ERROR] Missing backend requirements file: $RequirementsFile" -ForegroundColor Red
        Read-Host "`n  Press Enter to exit"
        exit 1
    }

    if (-not (Test-Path $LocalVenvPython)) {
        Write-Host "  [INFO] Creating isolated legacy Python environment..." -ForegroundColor Gray
        $createArgs = @($bootstrap.PrefixArgs + @("-m", "venv", (Join-Path $ProjectDir "venv")))
        & $bootstrap.Path @createArgs
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $LocalVenvPython)) {
            Write-Host "  [ERROR] Failed to create the legacy virtual environment." -ForegroundColor Red
            Read-Host "`n  Press Enter to exit"
            exit 1
        }
    }

    $requirementsHash = (Get-FileHash -Algorithm SHA256 $RequirementsFile).Hash
    $storedHash = if (Test-Path $RequirementsStamp) {
        (Get-Content $RequirementsStamp -ErrorAction SilentlyContinue | Select-Object -First 1)
    } else {
        ""
    }

    if ($requirementsHash -ne $storedHash) {
        Write-Host "  [INFO] Syncing legacy backend dependencies..." -ForegroundColor Gray
        & $LocalVenvPython -m pip install --upgrade pip
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [ERROR] Failed to upgrade pip in the legacy environment." -ForegroundColor Red
            Read-Host "`n  Press Enter to exit"
            exit 1
        }
        & $LocalVenvPython -m pip install -r $RequirementsFile
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [ERROR] Failed to install legacy backend dependencies." -ForegroundColor Red
            Read-Host "`n  Press Enter to exit"
            exit 1
        }
        Set-Content -Path $RequirementsStamp -Value $requirementsHash -Encoding ASCII
        Write-Host "  [OK] Legacy backend dependencies are ready." -ForegroundColor Green
    }

    $script:VenvPython = $LocalVenvPython
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
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/K", "cd /d `"$FrontendDir`" && npm run tauri dev" `
        -WorkingDirectory $FrontendDir | Out-Null
    Write-Host "  [OK] Legacy dev mode command launched." -ForegroundColor Green
}

Write-Host ""
Write-Host "  Legacy launcher finished." -ForegroundColor Cyan
Start-Sleep -Seconds 1
