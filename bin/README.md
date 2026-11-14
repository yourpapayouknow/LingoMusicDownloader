# Binary Placeholders

This repository intentionally does **not** track large binary executables.

Expected local files:
- `bin/ffmpeg/ffmpeg.exe`
- `bin/ffmpeg/ffprobe.exe`
- `bin/mp4decrypt.exe`

Quick install:

```powershell
pwsh -NoLogo -NoProfile -File .\bin\install.ps1
```

The script downloads the binaries into the paths above. Use `-Force` to refresh and `-Destination <path>` to install elsewhere.

Manual install:
1. Place FFmpeg binaries under `bin/ffmpeg/`.
2. Place `mp4decrypt.exe` at `bin/mp4decrypt.exe`.
3. Keep folder names unchanged because backend paths are fixed in `backend/core/config.py`.

For CI/release packaging, do not commit binaries to Git. FFmpeg is GPLv3; include its corresponding source or written offer and notices. mp4decrypt is part of Bento4 (GPL-2.0-only or commercial) and is not part of the GPL-3.0 project; distribute it separately under its own terms unless you have a commercial license.
