import asyncio
import os
import logging
from typing import List, Dict, Any, Optional

from gamdl.api import AppleMusicApi
from gamdl.downloader import (
    AppleMusicBaseDownloader,
    AppleMusicDownloader,
    AppleMusicMusicVideoDownloader,
    AppleMusicSongDownloader,
    AppleMusicUploadedVideoDownloader,
)
from gamdl.interface import (
    AppleMusicBaseInterface,
    AppleMusicInterface,
    AppleMusicMusicVideoInterface,
    AppleMusicSongInterface,
    AppleMusicUploadedVideoInterface,
    SongCodec,
    MusicVideoResolution
)

from backend.core.config import settings

logger = logging.getLogger(__name__)

class DownloadManager:
    def __init__(self):
        self.apple_music_api = None
        self.download_queue = []
        self.download_status: Dict[str, Any] = {}
        self.is_initialized = False

    async def initialize(self):
        if not os.path.exists(settings.COOKIES_PATH):
            logger.error(f"Cookies file not found at {settings.COOKIES_PATH}")
            return False

        try:
            self.apple_music_api = await AppleMusicApi.create_from_netscape_cookies(
                cookies_path=settings.COOKIES_PATH,
            )
            
            if not self.apple_music_api.active_subscription:
                logger.error("No active Apple Music subscription found.")
                return False

            self.is_initialized = True
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Gamdl downloader: {e}")
            return False

    async def _create_downloader(self, codec: str, video_resolution: str, use_wrapper: bool):
        base_interface = await AppleMusicBaseInterface.create(
            apple_music_api=self.apple_music_api,
            use_wrapper=use_wrapper
        )
        
        try:
            song_codec_enum = SongCodec(codec)
        except ValueError:
            song_codec_enum = SongCodec.AAC_LEGACY
            
        try:
            video_res_enum = MusicVideoResolution(video_resolution)
        except ValueError:
            video_res_enum = MusicVideoResolution.R1080P

        song_interface = AppleMusicSongInterface(
            base=base_interface,
            codec_priority=[song_codec_enum]
        )
        music_video_interface = AppleMusicMusicVideoInterface(
            base=base_interface,
            resolution=video_res_enum
        )
        uploaded_video_interface = AppleMusicUploadedVideoInterface(
            base=base_interface,
        )
        
        interface = AppleMusicInterface(
            song=song_interface,
            music_video=music_video_interface,
            uploaded_video=uploaded_video_interface,
        )
        
        base_downloader = AppleMusicBaseDownloader(
            interface=interface,
            output_path=settings.OUTPUT_PATH,
            mp4decrypt_path=settings.MP4DECRYPT_PATH,
            ffmpeg_path=settings.FFMPEG_PATH
        )
        
        song_downloader = AppleMusicSongDownloader(base=base_downloader)
        music_video_downloader = AppleMusicMusicVideoDownloader(base=base_downloader)
        uploaded_video_downloader = AppleMusicUploadedVideoDownloader(base=base_downloader)
        
        return AppleMusicDownloader(
            song=song_downloader,
            music_video=music_video_downloader,
            uploaded_video=uploaded_video_downloader,
        )

    async def add_to_queue(self, url: str, codec: str = "aac-legacy", video_resolution: str = "1080p", use_wrapper: bool = False) -> bool:
        if not self.is_initialized:
            logger.error("Downloader not initialized. Please check cookies.txt")
            return False
            
        self.download_status[url] = {
            "status": "pending", 
            "items": [], 
            "codec": codec,
            "resolution": video_resolution
        }
        
        downloader = await self._create_downloader(codec, video_resolution, use_wrapper)
        asyncio.create_task(self._process_url(downloader, url))
        return True

    async def _process_url(self, downloader, url: str):
        try:
            self.download_status[url]["status"] = "processing"
            download_items = []
            
            async for media in downloader.get_download_item_from_url(url):
                download_items.append(media)
                self.download_status[url]["items"].append({"status": "pending"})
            
            self.download_status[url]["status"] = "downloading"
            
            for index, item in enumerate(download_items):
                self.download_status[url]["items"][index]["status"] = "downloading"
                try:
                    await downloader.download(item)
                    self.download_status[url]["items"][index]["status"] = "completed"
                except Exception as e:
                    logger.error(f"Error downloading item: {e}")
                    self.download_status[url]["items"][index]["status"] = "error"
                    self.download_status[url]["items"][index]["error"] = str(e)
            
            self.download_status[url]["status"] = "completed"
            
        except Exception as e:
            logger.error(f"Error processing url {url}: {e}")
            self.download_status[url]["status"] = "error"
            self.download_status[url]["error"] = str(e)

manager = DownloadManager()
