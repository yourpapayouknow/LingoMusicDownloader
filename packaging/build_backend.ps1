#requires -Version 7.0

# 构建可独立运行的Python后端目录，供Tauri安装包作为资源携带
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DistRoot = Join-Path $ProjectRoot "frontend\src-tauri\backend-dist"
$BuildRoot = Join-Path $PSScriptRoot "build"
$SpecRoot = Join-Path $PSScriptRoot "spec"
$BackendOut = Join-Path $DistRoot "run_backend"

if (Test-Path -LiteralPath $DistRoot) {
    Remove-Item -LiteralPath $DistRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $DistRoot, $BuildRoot, $SpecRoot | Out-Null

Push-Location $ProjectRoot
try {
    $pyiArgs = @(
        "--noconfirm",
        "--clean",
        "--onedir",
        "--name", "run_backend",
        "--distpath", $DistRoot,
        "--workpath", $BuildRoot,
        "--specpath", $SpecRoot,
        "--collect-all", "gamdl",
        "--collect-all", "yt_dlp",
        "--collect-all", "m3u8",
        "--collect-all", "mutagen",
        "--collect-all", "Crypto",
        "--collect-all", "httpx",
        "--collect-all", "httpx_retries",
        "--collect-all", "uvicorn",
        "--collect-all", "fastapi",
        "--collect-all", "pydantic",
        "--collect-all", "pydantic_settings",
        "--collect-all", "pywidevine",
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan.on",
        "run_backend.py"
    )
    uv run --with pyinstaller pyinstaller @pyiArgs
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller failed."
    }
}
finally {
    Pop-Location
}

# 复制运行期二进制与许可文件
$BinSrc = Join-Path $ProjectRoot "bin"
$BinDst = Join-Path $BackendOut "bin"
$RequiredBins = @(
    (Join-Path $BinSrc "ffmpeg\ffmpeg.exe"),
    (Join-Path $BinSrc "ffmpeg\ffprobe.exe"),
    (Join-Path $BinSrc "mp4decrypt.exe")
)
foreach ($file in $RequiredBins) {
    if (-not (Test-Path -LiteralPath $file)) {
        throw "Missing $file. Run bin\install.ps1 first."
    }
}
New-Item -ItemType Directory -Force -Path (Join-Path $BinDst "ffmpeg") | Out-Null
Copy-Item -LiteralPath (Join-Path $BinSrc "ffmpeg\ffmpeg.exe") -Destination (Join-Path $BinDst "ffmpeg\ffmpeg.exe") -Force
Copy-Item -LiteralPath (Join-Path $BinSrc "ffmpeg\ffprobe.exe") -Destination (Join-Path $BinDst "ffmpeg\ffprobe.exe") -Force
Copy-Item -LiteralPath (Join-Path $BinSrc "mp4decrypt.exe") -Destination (Join-Path $BinDst "mp4decrypt.exe") -Force
Copy-Item -LiteralPath (Join-Path $ProjectRoot "LICENSE") -Destination (Join-Path $BackendOut "LICENSE") -Force
Copy-Item -LiteralPath (Join-Path $ProjectRoot "NOTICE") -Destination (Join-Path $BackendOut "NOTICE") -Force

Write-Host "Backend bundle: $BackendOut" -ForegroundColor Green
Get-Item -LiteralPath (Join-Path $BackendOut "run_backend.exe") | Select-Object FullName, Length