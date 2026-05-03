@echo off
echo Starting Apple Music Wrapper...
echo Keep this window open while downloading ALAC or Atmos music.
docker run --privileged -v "%cd%\wrapper_data:/app/rootfs/data" -p 10020:10020 -p 20020:20020 -p 30020:30020 -e args="-H 0.0.0.0" ghcr.io/worldobservationlog/wrapper:local
