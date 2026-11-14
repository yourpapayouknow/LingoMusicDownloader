#requires -Version 7.0

<#
.SYNOPSIS
Downloads the local binary tools required by LingoMusicDownloader.

.DESCRIPTION
Installs FFmpeg (ffmpeg.exe, ffprobe.exe) into bin\ffmpeg and mp4decrypt.exe into bin.

Sources:
- FFmpeg essentials build (GPLv3): https://www.gyan.dev/ffmpeg/builds/
- Bento4 SDK (GPL-2.0-only or commercial): https://www.bento4.com/downloads/

The downloaded binaries are third-party software and retain their own licenses.
#>
[CmdletBinding()]
param(
    [string]$Destination = $PSScriptRoot,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$FfmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$FfmpegShaUrl = "$FfmpegUrl.sha256"
$BentoUrl = "https://www.bok.net/Bento4/binaries/Bento4-SDK-1-6-0-641.x86_64-microsoft-win32.zip"

$BinDir = [System.IO.Path]::GetFullPath($Destination)
$FfmpegDir = Join-Path $BinDir "ffmpeg"
$FfmpegExe = Join-Path $FfmpegDir "ffmpeg.exe"
$FfprobeExe = Join-Path $FfmpegDir "ffprobe.exe"
$Mp4DecryptExe = Join-Path $BinDir "mp4decrypt.exe"

New-Item -ItemType Directory -Force -Path $FfmpegDir | Out-Null

if (-not $Force -and (Test-Path $FfmpegExe) -and (Test-Path $FfprobeExe) -and (Test-Path $Mp4DecryptExe)) {
    Write-Host "Binary tools already present. Use -Force to refresh." -ForegroundColor Yellow
    return
}

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("lingo-bin-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

# 下载文件到临时路径
function Get-RemoteFile {
    param([string]$Url, [string]$Path)
    Write-Host "Downloading $Url" -ForegroundColor Cyan
    Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing
}

# 解压zip到临时目录
function Expand-ZipArchive {
    param([string]$Path, [string]$Destination)
    Expand-Archive -LiteralPath $Path -DestinationPath $Destination -Force
}

try {
    # 安装FFmpeg与ffprobe
    $FfmpegZip = Join-Path $TempDir "ffmpeg.zip"
    Get-RemoteFile -Url $FfmpegUrl -Path $FfmpegZip
    $ExpectedHash = (Invoke-WebRequest -Uri $FfmpegShaUrl -UseBasicParsing).Content.Trim().Split()[0].ToLowerInvariant()
    $ActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $FfmpegZip).Hash.ToLowerInvariant()
    if ($ExpectedHash -and $ActualHash -ne $ExpectedHash) {
        throw "FFmpeg checksum mismatch."
    }
    $FfmpegExtract = Join-Path $TempDir "ffmpeg"
    Expand-ZipArchive -Path $FfmpegZip -Destination $FfmpegExtract
    $FfmpegSource = Get-ChildItem -Path $FfmpegExtract -Recurse -Filter ffmpeg.exe | Select-Object -First 1
    $FfprobeSource = Get-ChildItem -Path $FfmpegExtract -Recurse -Filter ffprobe.exe | Select-Object -First 1
    if (-not $FfmpegSource -or -not $FfprobeSource) {
        throw "FFmpeg executables not found in archive."
    }
    Copy-Item -LiteralPath $FfmpegSource.FullName -Destination $FfmpegExe -Force
    Copy-Item -LiteralPath $FfprobeSource.FullName -Destination $FfprobeExe -Force

    # 安装mp4decrypt
    $BentoZip = Join-Path $TempDir "bento4.zip"
    Get-RemoteFile -Url $BentoUrl -Path $BentoZip
    $BentoExtract = Join-Path $TempDir "bento4"
    Expand-ZipArchive -Path $BentoZip -Destination $BentoExtract
    $Mp4Source = Get-ChildItem -Path $BentoExtract -Recurse -Filter mp4decrypt.exe | Select-Object -First 1
    if (-not $Mp4Source) {
        throw "mp4decrypt.exe not found in archive."
    }
    Copy-Item -LiteralPath $Mp4Source.FullName -Destination $Mp4DecryptExe -Force

    Write-Host "Installed:" -ForegroundColor Green
    Write-Host "  $FfmpegExe"
    Write-Host "  $FfprobeExe"
    Write-Host "  $Mp4DecryptExe"
    Write-Host "Third-party licenses: FFmpeg GPLv3; mp4decrypt/Bento4 GPL-2.0-only or commercial." -ForegroundColor Yellow
}
finally {
    if (Test-Path $TempDir) {
        Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
    }
}