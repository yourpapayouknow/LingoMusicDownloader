# LingoMusicDownloader

A powerful desktop application for downloading Apple Music tracks in AAC, ALAC Lossless, and Dolby Atmos formats. Built with a FastAPI backend and a Flet desktop frontend, with WSL2 integration for advanced audio formats.

---

## Features

| Feature | Details |
|---|---|
| 🎵 **Multiple Formats** | AAC (Standard), ALAC Lossless, Dolby Atmos |
| 🔍 **Built-in Search** | Search songs, albums, and music videos directly in the app |
| 📥 **Download Queue** | Real-time progress monitoring for all downloads |
| 🖥️ **Desktop UI** | Native desktop window via Flet |
| 🔧 **WSL2 Wrapper** | Integrated WSL2-based service for lossless & Atmos decryption |
| 🚀 **One-Click Launch** | `launch.ps1` starts everything in the correct order |

---

## Prerequisites

- **Windows 10/11** (64-bit)
- **Python 3.10+**
- **WSL2** — Required for ALAC Lossless and Dolby Atmos downloads
  - Install via: `wsl --install` in an elevated PowerShell
- **Apple Music Subscription** — An active subscription is required
- **Apple Music Cookies** — Used to authenticate with Apple Music

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
# Install dependencies directly via the venv pip (no activation needed)
.\venv\Scripts\pip install -r backend\requirements.txt
.\venv\Scripts\pip install -r frontend\requirements.txt
```

> **Note**: Avoid running `.\venv\Scripts\Activate.ps1` directly — Windows blocks unsigned PS1 scripts by default.
> If you prefer to use `activate`, run this once first:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### 3. Set Up the WSL2 Wrapper (for ALAC / Atmos)

The wrapper is a Linux binary that runs inside WSL2. Download and configure it by running:

```powershell
python backend\utils\setup_wsl.py
```

This will:
- Download the `wrapper` binary into `backend\wsl_wrapper\`
- Set the correct execute permissions via WSL2

> **Note**: Skip this step if you only need standard AAC downloads.

### 4. Create the Desktop Shortcut (Optional)

```powershell
powershell -ExecutionPolicy Bypass -File .\create_shortcut.ps1
```

This creates a **"LingoMusicDownloader"** shortcut on your Desktop for one-click launch.

---

## Usage

### Launching the Application

**Option A — Desktop Shortcut** (recommended):
Double-click **LingoMusicDownloader** on your Desktop.

**Option B — PowerShell script directly**:
```powershell
powershell -ExecutionPolicy Bypass -File .\launch.ps1
```

**Option C — Python directly** (no wrapper):
```powershell
.\venv\Scripts\python.exe run_app.py
```

The launcher (`launch.ps1`) starts services in this order:
1. **WSL2 Wrapper** — Started in a minimised window in WSL2 (ports 10020 / 20020 / 30020)
2. **FastAPI Backend** — Started as a background thread on `http://127.0.0.1:8000`
3. **Flet Frontend** — The desktop UI window

---

### First-Time Setup: Apple Music Cookies

On first launch (or if cookies are missing), a dialog will appear:

1. Open [music.apple.com](https://music.apple.com) in your browser and log in.
2. Install a cookie export extension such as [Cookie-Editor](https://cookie-editor.com/).
3. Export cookies in **Netscape** format.
4. Paste the exported content into the dialog and click **Save & Continue**.

The cookies are saved to `cookies.txt` in the project root.

---

### Search & Download

1. Type a search term (e.g., `Taylor Swift Lover`) and press **Enter** or click 🔍.
2. Select the desired **Audio Codec** and **MV Resolution** from the dropdowns.
3. If downloading ALAC or Atmos, tick **"Use Wrapper (For ALAC/Atmos)"**.
4. Click **Download** on any result card.
5. Monitor progress in the **Download Queue** panel on the right.

Downloaded files are saved to the `Apple Music/` folder in the project root.

---

## Advanced Formats (ALAC / Atmos)

For lossless or Atmos content:

1. Ensure WSL2 is installed and running.
2. Run `python backend\utils\setup_wsl.py` to download the wrapper binary.
3. Launch the app via `launch.ps1` (the wrapper starts automatically).
4. In the app, select **ALAC Lossless** or **Dolby Atmos** from the codec dropdown.
5. Check **"Use Wrapper (For ALAC/Atmos)"** before downloading.

---

## Project Structure

```
LingoMusicDownloader/
├── backend/
│   ├── api/            # FastAPI route definitions
│   ├── core/           # Settings / configuration
│   ├── services/       # Download manager (gamdl integration)
│   ├── utils/          # WSL setup, tool downloader utilities
│   ├── wsl_wrapper/    # WSL2 wrapper binary (git-ignored)
│   └── main.py         # FastAPI application entry point
├── frontend/
│   ├── assets/         # Icons and images
│   ├── components/     # Reusable UI components
│   ├── utils/          # API client (requests to backend)
│   ├── views/          # Page/view definitions
│   └── main.py         # Flet application entry point
├── bin/                # ffmpeg, mp4decrypt binaries (git-ignored)
├── run_app.py          # Unified entry point (backend thread + frontend)
├── launch.ps1          # One-click launcher (Wrapper → App)
└── create_shortcut.ps1 # Creates a Desktop shortcut for launch.ps1
```

---

## Dependencies

| Component | Library |
|---|---|
| Backend API | FastAPI, Uvicorn |
| Downloader | [gamdl](https://github.com/WorldObservationLog/gamdl) |
| Frontend UI | [Flet](https://flet.dev) |
| HTTP Client | Requests |
| Settings | Pydantic-Settings |

---

## License

MIT License — see [LICENSE](LICENSE) for details.
