# Binary Placeholders

This repository intentionally does **not** track large binary executables.

Expected local files:
- `bin/ffmpeg/ffmpeg.exe`
- `bin/ffmpeg/ffprobe.exe`
- `bin/ffmpeg/ffplay.exe`
- `bin/mp4decrypt.exe`

How to prepare locally:
1. Place FFmpeg binaries under `bin/ffmpeg/`.
2. Place `mp4decrypt.exe` at `bin/mp4decrypt.exe`.
3. Keep folder names unchanged because backend paths are fixed in `backend/core/config.py`.

For CI/release packaging, include these binaries in the release asset package instead of committing them to Git.
