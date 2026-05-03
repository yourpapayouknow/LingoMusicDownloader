@echo off
set /p APPLE_ID="Enter your Apple ID: "
set /p APPLE_PW="Enter your Apple ID Password: "
echo Starting Wrapper in WSL...
wsl -e bash -c "cd /mnt/f/College/Activ_CodeProjects/PycharmProjects/LingoMusicDownloader/backend/wsl_wrapper && ./wrapper -L \"%APPLE_ID%:%APPLE_PW%\" -H 0.0.0.0"
pause
