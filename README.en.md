# LingoMusicDownloader

A high-fidelity Apple Music desktop downloader with a **FastAPI backend** and **React + Vite + Tauri frontend**. It supports AAC, ALAC Lossless, Dolby/Atmos-capable workflows, MV downloads, local library playback, lyrics display, and optional format conversion pipelines.

---

## Features

| Feature | Details |
|---|---|
| 🎵 **Multiple Formats** | AAC, ALAC Lossless, Dolby/Atmos-capable workflow |
| 🎬 **MV Download** | Apple Music MV search + download with local playback |
| 🔍 **Built-in Search** | Search songs, albums, artists, playlists, and MVs |
| 📥 **Queue + History** | Real-time task queue, grouped album/history display |
| 🖥️ **Desktop App** | Native desktop shell via Tauri (custom themed UI) |
| 🔐 **Init Wizard** | First-run agreement, Cookies login, Wrapper setup entrance |
| 🎼 **Local Playback** | Local file playback, LRC lyric sync, playlist management |
| 🔄 **Optional Transcode** | AAC/ALAC auto-convert pipeline (MP3/MP4/FLAC/WAV) |

---

## Prerequisites

- **Windows 10/11** (64-bit)
- **Python 3.10+**
- **Node.js 18+** (for frontend build/dev)
- **Rust toolchain** (only needed if you build Tauri binaries yourself)
- **Apple Music Subscription** — an active subscription is required
- **WSL2** — required for advanced Wrapper-based ALAC/Atmos/MV capabilities

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourpapayouknow/LingoMusicDownloader.git
cd LingoMusicDownloader
```

### 2. Set Up Python Virtual Environment

```powershell
python -m venv venv
.\venv\Scripts\pip install -r backend\requirements.txt
```

### 3. Set Up Frontend Dependencies

```powershell
cd frontend
npm install
cd ..
```

### 4. Prepare Binary Tools (FFmpeg / mp4decrypt)

Large binaries are intentionally **not committed** to Git.

Place these files locally:
- `bin/ffmpeg/ffmpeg.exe`
- `bin/ffmpeg/ffprobe.exe`
- `bin/ffmpeg/ffplay.exe`
- `bin/mp4decrypt.exe`

See [bin/README.md](bin/README.md) for details.

### 5. Optional: Prepare Wrapper Runtime (Advanced Quality)

Use the app's initialization/setup flow to install or restart Wrapper.

> If you only need standard AAC downloads, Wrapper is optional.

---

## Usage

### Launching the Application

**Option A — Script launcher** (recommended for source-run):
```powershell
powershell -ExecutionPolicy Bypass -File .\launch.ps1
```

**Option B — Start backend + run Tauri dev manually**:
```powershell
# Terminal 1
.\venv\Scripts\python.exe run_backend.py

# Terminal 2
cd frontend
npm run tauri dev
```

**Option C — Run packaged executable**:
Use a built `lingo-music-downloader.exe` release package.

---

### First-Time Setup (In-App Wizard)

On first launch, the app shows a guided initialization flow:

1. Read and accept the user agreement/disclaimer.
2. Open Apple Music login page and complete Cookies acquisition.
3. Configure WSL2 / Wrapper if high-quality features are needed.

The wizard can also be reopened from **Settings**.

---

### Search & Download

1. Search songs/albums/artists/MVs from the Search tab.
2. Choose codec and MV resolution from Settings.
3. Submit tasks and monitor queue progress.
4. Downloaded content is indexed into history/local library.

Default download output:
- `Apple Music/`

Optional converted output:
- `Converted/`

---

## Advanced Formats (ALAC / Atmos / MV)

For advanced-quality workflows:

1. Ensure WSL2 is available.
2. Complete Wrapper setup/login in the app.
3. Enable high-quality mode in Settings.
4. If Wrapper is not healthy, download submission will fail fast (no silent downgrade).

---

## Project Structure

```
LingoMusicDownloader/
├── backend/
│   ├── api/              # FastAPI routes
│   ├── core/             # runtime settings/config
│   ├── db/               # sqlite + settings/history storage
│   ├── services/         # downloader/orchestration logic
│   ├── utils/            # helper scripts/tools
│   └── main.py           # backend app entry
├── frontend/
│   ├── src/              # React app source
│   ├── src-tauri/        # Tauri Rust wrapper + config
│   ├── package.json      # frontend scripts/deps
│   └── vite.config.ts    # Vite build config
├── bin/                  # local binary tools (placeholders tracked)
├── old/                  # archived legacy/temporary assets
├── run_backend.py        # backend launcher
└── launch.ps1            # unified launcher (backend -> desktop app)
```

---

## Dependencies

| Component | Library |
|---|---|
| Backend API | FastAPI, Uvicorn |
| Downloader Core | [gamdl](https://github.com/glomatico/gamdl) |
| Frontend UI | React, Vite |
| Desktop Shell | Tauri |
| Media Processing | FFmpeg, mp4decrypt |

---

## License

MIT License — see [LICENSE](LICENSE) for details.
