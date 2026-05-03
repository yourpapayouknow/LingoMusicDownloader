@echo off
setlocal
echo ===================================================
echo     Apple Music Wrapper Setup (For ALAC / Atmos)
echo ===================================================
echo.
echo The Wrapper is a Linux-only tool, so it MUST be run via Docker on Windows.
echo Please ensure Docker Desktop is installed and running before proceeding.
echo.

set /p APPLE_ID="Enter your Apple ID: "
set /p APPLE_PW="Enter your Apple ID Password: "

echo.
echo Building Wrapper Docker Image...
docker build --tag ghcr.io/worldobservationlog/wrapper:local https://github.com/WorldObservationLog/wrapper.git#main

echo.
echo Initializing Login (Please interact if 2FA is required)...
docker run --privileged --rm -it -v "%cd%\wrapper_data:/app/rootfs/data" --entrypoint ./wrapper ghcr.io/worldobservationlog/wrapper:local -L "%APPLE_ID%:%APPLE_PW%" -H 0.0.0.0

echo.
echo Setup complete. 
echo To run the Wrapper in the background, use 'run_wrapper.bat'.
pause
