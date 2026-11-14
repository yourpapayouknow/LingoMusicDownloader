![LingoMusic](assets/readme-badge.png)

# LingoMusicDownloader

<p align="center">
  <img alt="Backend-Python 3.11" src="https://img.shields.io/badge/Backend-Python%203.11-3776AB?logo=python&logoColor=white">
  <img alt="Backend-FastAPI" src="https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white">
  <img alt="Frontend-React 19" src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react&logoColor=black">
  <img alt="Frontend-TypeScript 6" src="https://img.shields.io/badge/Frontend-TypeScript%206-3178C6?logo=typescript&logoColor=white">
  <img alt="Frontend-Vite 8" src="https://img.shields.io/badge/Frontend-Vite%208-646CFF?logo=vite&logoColor=white">
  <img alt="Desktop-Tauri 2" src="https://img.shields.io/badge/Desktop-Tauri%202-24C8DB?logo=tauri&logoColor=white">
  <img alt="Platform-Windows 10/11" src="https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D4?logo=windows&logoColor=white">
</p>

A high-fidelity desktop music downloader for Windows, supporting ALAC and Dolby downloads, one-click transcoding, and a CLI.

## Features

| Capability | Details |
| --- | --- |
| Catalog search | Search songs, albums, artists, MVs, and playlists by keyword; paste a share link directly |
| Multi-format downloads | AAC, ALAC, **ALAC Hi-res**, Dolby; non-AAC formats require the decryption component |
| MV downloads | 1080p and 4K; files are saved to the download folder |
| Queue and history | Album/playlist grouping, per-track status, failure hints, history, and local rescan |
| Local playback | Local and preview sources, LRC lyrics, playlists, shuffle, and repeat |
| Optional transcoding | AAC→MP3/MP4/standard AAC; ALAC→FLAC/WAV/MP4 |
| Metadata region | Follow the account or choose from 28 regions |
| Entry points | Desktop GUI and CLI |

> [!IMPORTANT]
> Downloaded content is for **personal study and research only**; do not use it for commercial or infringing purposes. A valid subscription is required; delete downloaded content within **24 hours**. See the in-app About → Usage Notice for the full notice.

## Quick Start

Send this to an AI coding assistant:

```text
Install this repository and launch LingoMusic Downloader: https://github.com/yourpapayouknow/LingoMusicDownloader
```

## Traditional Start

### Requirements

| Component | Requirement |
| --- | --- |
| OS | Windows 10/11 (64-bit) |
| PowerShell | 7.0+ |
| Python | 3.11+ |
| uv | Latest; see the [uv docs](https://docs.astral.sh/uv/) |
| Node.js | 22.13+ |
| Rust | Required for source builds |
| FFmpeg | Provide locally |
| Music service | Valid subscription and sign-in |
| WSL2 | Bundled |

> [!NOTE]
> Standard AAC downloads, queue, history, local playback, lyrics, and transcoding do not require WSL2.

### 1. Get the Code

```powershell
git clone https://github.com/yourpapayouknow/LingoMusicDownloader.git
cd LingoMusicDownloader
```

### 2. Install Dependencies

```powershell
uv sync --locked

cd frontend
npm install
cd ..
```

### 3. Prepare Binary Tools

Install command:

```powershell
pwsh -NoLogo -NoProfile -File .\bin\install.ps1
```

| File | Purpose |
| --- | --- |
| `bin/ffmpeg/ffmpeg.exe` | Transcoding, MV muxing, ALAC/Dolby local playback decoding |
| `bin/ffmpeg/ffprobe.exe` | Audio codec and format probing |
| `bin/mp4decrypt.exe` | MV decryption |

Binary details: [bin/README.md](bin/README.md).

### 4. Launch

One-click launcher:

```powershell
pwsh -NoLogo -NoProfile -File .\launch.ps1
```

On launch, the script creates `.venv` as needed, syncs Python dependencies, installs frontend dependencies, checks port 8000, starts the backend, and opens the desktop app. If `frontend/src-tauri/target/release/lingo-music-downloader.exe` exists, it is reused; otherwise `npm run tauri dev` is used.

Manual launch (two terminals):

```powershell
# Terminal 1: backend
.\.venv\Scripts\python.exe run_backend.py
```

```powershell
# Terminal 2: desktop
cd frontend
npm run tauri dev
```

Desktop shortcut:

```powershell
pwsh -NoLogo -NoProfile -File .\create_shortcut.ps1
```

### 5. First-Time Setup

1. The first launch shows the user agreement; scroll to the bottom to enable "Agree and continue".
2. Click "Sign in" to sign in to the music service; credentials are saved to `cookies.txt`.
3. Install WSL2 and the decryption component as needed; choose "Enter anyway" to skip and reopen the setup wizard later from Settings.
4. Choose audio quality, MV quality, metadata region, and storage location in Settings.

The default download directory and `Converted/` transcode directory can be changed in Settings → Storage.

### 6. Enable High-Quality Audio

ALAC, Dolby Atmos, and high-quality MV require the decryption component:

1. Install WSL2 from Settings or the setup wizard (about 15 GB; D: preferred). In-app installation requires administrator rights and `gsudo`; run `wsl --install` first if `gsudo` is missing.
2. Install the decryption component and sign in with a separate account; enter the 2FA code when prompted.
3. Enable "High-quality downloads" in Settings and select ALAC or Dolby Atmos.

> [!WARNING]
> Without the decryption component, high-quality options are disabled. Installation status and progress are shown in Settings; detailed logs are in the install dialog.

## Usage

### Search and Download

- Enter a keyword or paste a share link in the search box, then press Enter or click "Search".
- Filter results with "All / Tracks / Albums / Artists / MVs"; click "Download" to confirm the task.
- The download queue refreshes every 3 seconds; albums and playlists expand per track, and failed tasks are marked.
- When complete, open the folder from the Downloads page; tracks can also be played locally or added to a playlist.

### Local Playback and Lyrics

- The top bar supports play/pause, previous/next, progress, volume, shuffle, and repeat-one.
- Local tracks are read from the `data/lingo.db` index; lyrics use a sidecar `.lrc` file.
- Shortcuts: Space toggles play/pause; Esc closes the lyrics panel, then the playlist panel.

### Settings

| Setting | Details |
| --- | --- |
| Audio quality | AAC standard, ALAC lossless (24-bit/192kHz Max), Dolby Atmos |
| MV quality | 1080p or 4K (Max) |
| Metadata region | Follow the account or choose one of 28 regions |
| Transcoding | AAC→MP3/MP4/standard AAC; ALAC→FLAC/WAV/MP4 |
| Login credentials | Paste Netscape-format cookies; restart the app if needed after saving |
| Storage location | Change the download and converted directories, or restore defaults |

## CLI

CLI and desktop share the backend logic, supporting batch and scripted use.

```powershell
.\.venv\Scripts\python.exe -m cli --help
```

| Subcommand | Purpose |
| --- | --- |
| `serve` | Start the backend API (default `127.0.0.1:8000`) |
| `search` | Search the music catalog |
| `download` | Submit a URL download task and wait for the result |
| `settings` | Read or write client settings |
| `library` | Scan the download directory or list local history |
| `wrapper` | Check, install, or start the decryption component |
| `wsl` | Check or install WSL2 |

```powershell
# Search
.\.venv\Scripts\python.exe -m cli search "Jay Chou" --limit 20

# Download ALAC (requires the decryption component)
.\.venv\Scripts\python.exe -m cli download "<share-link>" --codec alac --wrapper

# Scan the local library
.\.venv\Scripts\python.exe -m cli library scan
```

CLI details: [cli/README.md](cli/README.md).

## Directory Structure

```text
LingoMusicDownloader/
├── backend/
│   ├── api/            # FastAPI routes (search, download, settings, storage, WSL2, decryption component)
│   ├── core/           # configuration, paths, and binary resolution
│   ├── db/             # SQLite settings, history, and search preferences
│   ├── services/       # gamdl adapter, download queue, search, metadata, local library, transcoding
│   ├── utils/          # cross-layer helpers
│   ├── head.py         # unified Python dependency entry
│   └── main.py         # FastAPI application entry
├── cli/                # seven subcommands (serve/search/download/settings/library/wrapper/wsl)
├── frontend/
│   ├── src/            # React app (views/ components/ app/ ui/ ...)
│   └── src-tauri/      # Tauri2 Rust shell and icons
├── tests/              # 26 standard-library unittest tests
├── bin/                # local binary tools
├── data/               # SQLite and runtime data
├── assets/             # brand assets and README badge
├── launch.ps1          # one-click launcher
├── create_shortcut.ps1 # desktop shortcut creator
├── pyproject.toml      # Python dependencies
└── uv.lock             # locked dependencies
```

### Architecture

```text
Tauri2+React19 (frontend)
          │ HTTP
          ▼
FastAPI 127.0.0.1:8000 (backend)
   ├── SQLite: data/lingo.db
   ├── gamdl/music service API
   └── WSL2 decryption component (:10020 / :20020 / :30020)
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | FastAPI, Uvicorn, gamdl 3.5.2, httpx, yt-dlp, m3u8, mutagen, Pillow, pycryptodome |
| Frontend | React 19, TypeScript 6, Vite 8, MingCute Icons |
| Desktop | Tauri 2, Rust |
| Data | SQLite (`data/lingo.db`), JSON (`data/storage_paths.json`) |
| Media | FFmpeg, ffprobe, mp4decrypt |
| Environment | uv, PowerShell 7, WSL2 |

## Development and Testing

```powershell
# Backend tests
.\.venv\Scripts\python.exe -m unittest discover -s tests -v

# Frontend checks and build
cd frontend
npm run lint
npm run build

# Freeze the backend and bundle media tools
pwsh -NoLogo -NoProfile -File .\packaging\build_backend.ps1

# Build the desktop installer
npm run tauri build
```

> [!NOTE]
> Before running backend tests for the first time, start the backend once (`.\.venv\Scripts\python.exe -m cli serve` or `launch.ps1`) to create `data/lingo.db`; on a fresh checkout without `data/`, the `settings get` test fails due to a missing table.

## FAQ

| Symptom | Resolution |
| --- | --- |
| Search or download reports initialization failure | Credentials may have expired. Sign in to the music service again in Settings, or paste fresh cookies and restart the app. |
| High-quality audio, Dolby, or 4K is unavailable | The decryption component is not ready. Install and start WSL2/the decryption component and confirm the health check passes. |
| Download or transcoding reports missing FFmpeg/mp4decrypt | Place the binaries as described in [bin/README.md](bin/README.md), then restart the backend. |
| Launcher reports a port conflict | The backend uses 8000; the frontend dev server uses 5173. Close the process occupying the port and retry. |
| CLI-only use | Run `.\.venv\Scripts\python.exe -m cli serve`, then use `search`, `download`, and other subcommands in another terminal. |

## Disclaimer

- Downloaded content is for personal study and research only; do not use it for commercial or infringing purposes.
- No copyrighted audio, lyrics, artwork, or MV is hosted or distributed; all rights belong to their respective owners.
- Delete downloaded content within 24 hours.
- Account bans, copyright disputes, and other legal liability arising from use are borne by the user.

## Acknowledgements

- [gamdl](https://github.com/glomatico/gamdl): music download core
- [Tauri](https://github.com/tauri-apps/tauri), [React](https://github.com/facebook/react), [Vite](https://github.com/vitejs/vite): desktop shell and frontend
- [FastAPI](https://github.com/fastapi/fastapi): backend framework
- [MingCute Icons](https://github.com/Richard9394/MingCute): UI icons
- FFmpeg, mp4decrypt: media processing and decryption