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
)

from backend.core.config import settings

logger = logging.getLogger(__name__)

class DownloadManager:
    def __init__(self):
        self.apple_music_api = None
        self.downloader = None
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

            base_interface = await AppleMusicBaseInterface.create(
                apple_music_api=self.apple_music_api,
            )
            
            # Setup Interfaces
            song_interface = AppleMusicSongInterface(base=base_interface)
            music_video_interface = AppleMusicMusicVideoInterface(base=base_interface)
            uploaded_video_interface = AppleMusicUploadedVideoInterface(base=base_interface)
            
            interface = AppleMusicInterface(
                song=song_interface,
                music_video=music_video_interface,
                uploaded_video=uploaded_video_interface,
            )
            
            # Setup Downloaders
            base_downloader = AppleMusicBaseDownloader(
                interface=interface,
                output_path=settings.OUTPUT_PATH
            )
            
            song_downloader = AppleMusicSongDownloader(base=base_downloader)
            music_video_downloader = AppleMusicMusicVideoDownloader(base=base_downloader)
            uploaded_video_downloader = AppleMusicUploadedVideoDownloader(base=base_downloader)
            
            self.downloader = AppleMusicDownloader(
                song=song_downloader,
                music_video=music_video_downloader,
                uploaded_video=uploaded_video_downloader,
            )
            
            self.is_initialized = True
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Gamdl downloader: {e}")
            return False

    async def add_to_queue(self, url: str) -> bool:
        if not self.is_initialized:
            logger.error("Downloader not initialized. Please check cookies.txt")
            return False
            
        self.download_status[url] = {"status": "pending", "items": []}
        asyncio.create_task(self._process_url(url))
        return True

    async def _process_url(self, url: str):
        try:
            self.download_status[url]["status"] = "processing"
            download_items = []
            
            async for media in self.downloader.get_download_item_from_url(url):
                download_items.append(media)
                # Store some minimal info if possible
                self.download_status[url]["items"].append({"status": "pending"})
            
            self.download_status[url]["status"] = "downloading"
            
            for index, item in enumerate(download_items):
                self.download_status[url]["items"][index]["status"] = "downloading"
                try:
                    await self.downloader.download(item)
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
