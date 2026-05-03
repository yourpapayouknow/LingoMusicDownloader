# LingoMusicDownloader

A powerful and user-friendly Apple Music downloader with support for AAC, ALAC Lossless, and Dolby Atmos.

## Features
- **High Quality**: Support for AAC (Standard), ALAC (Lossless), and Dolby Atmos.
- **Search Integration**: Built-in Apple Music search for songs, albums, and music videos.
- **Visual Queue**: Real-time download progress and status monitoring.
- **WSL2 Wrapper**: Seamless integration with WSL2 to handle decryption and advanced formats.

## Prerequisites
- **Python 3.8+**
- **WSL2 (Windows Subsystem for Linux)**: Required for ALAC and Dolby Atmos downloads.
- **Apple Music Cookies**: Required to authenticate with Apple Music.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourpapayouknow/LingoMusicDownloader.git
   cd LingoMusicDownloader
   ```

2. **Set up the virtual environment**:
   ```bash
   python -m venv venv
   ./venv/Scripts/activate
   pip install -r frontend/requirements.txt
   pip install -r backend/requirements.txt
   ```

3. **Initialize the WSL2 Wrapper**:
   Run the setup script to prepare the WSL2 environment and dependencies (ffmpeg, mp4decrypt, etc.):
   ```bash
   ./wrapper_setup.bat
   ```

## Usage

1. **Start the Application**:
   Double-click `start.bat` or run:
   ```bash
   ./start.bat
   ```

2. **Configure Cookies**:
   Upon first launch, the application will ask for your Apple Music cookies.
   - Log in to [music.apple.com](https://music.apple.com).
   - Use a browser extension (like Cookie-Editor) to export cookies in **Netscape** format.
   - Paste the content into the application's dialog.

3. **Search & Download**:
   - Enter keywords (e.g., "Justin Bieber Baby") and search.
   - Select your desired format and resolution.
   - Click "Download" and monitor the "Download Queue".

## Advanced Formats
For ALAC Lossless or Dolby Atmos, ensure the **"Use Wrapper"** checkbox is selected. This will route the download through the WSL2-based backend for proper decryption.

## License
MIT License
