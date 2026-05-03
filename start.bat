@echo off
echo Starting LingoMusicDownloader Services...

:: Start the FastAPI backend in a new window
start "LingoMusic Backend" cmd /c ".\venv\Scripts\activate && uvicorn backend.main:app --host 127.0.0.1 --port 8000"

:: Wait a couple of seconds for backend to initialize
timeout /t 3 /nobreak >nul

:: Start the Flet frontend (Desktop App Mode)
echo Starting Flet UI...
.\venv\Scripts\activate && set PYTHONPATH=%cd% && python frontend/main.py
