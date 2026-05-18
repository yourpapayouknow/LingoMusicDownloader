from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Dict, Any, Optional
import socket

from backend.services.downloader import manager
from backend.core.config import settings

router = APIRouter()

# Wrapper ports as defined by the gamdl library defaults
WRAPPER_DECRYPT_PORT = 10020   # wrapper_decrypt_ip
WRAPPER_M3U8_PORT    = 20020   # wrapper_m3u8_ip


def _check_port(host: str, port: int, timeout: float = 1.5) -> bool:
    """Return True if something is listening on host:port."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


class DownloadRequest(BaseModel):
    url: str
    codec: str = "aac-legacy"
    video_resolution: str = "1080p"
    use_wrapper: bool = False

@router.post("/download")
async def start_download(request: DownloadRequest):
    if not manager.is_initialized:
        success = await manager.initialize()
        if not success:
            raise HTTPException(
                status_code=500, 
                detail="Downloader not initialized. Please ensure cookies.txt is provided and valid."
            )
    
    added = await manager.add_to_queue(
        request.url, 
        codec=request.codec, 
        video_resolution=request.video_resolution,
        use_wrapper=request.use_wrapper
    )
    if not added:
        raise HTTPException(status_code=500, detail="Failed to add to download queue")
        
    return {"message": "Download started", "url": request.url}

@router.get("/status")
async def get_status() -> Dict[str, Any]:
    return {
        "is_initialized": manager.is_initialized,
        "downloads": manager.download_status
    }


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Check wrapper port connectivity and cookies status."""
    import os
    decrypt_ok = _check_port("127.0.0.1", WRAPPER_DECRYPT_PORT)
    m3u8_ok    = _check_port("127.0.0.1", WRAPPER_M3U8_PORT)
    cookies_ok = (
        os.path.exists(settings.COOKIES_PATH)
        and os.path.getsize(settings.COOKIES_PATH) > 10
    )
    return {
        "wrapper": {
            "decrypt_port": {"port": WRAPPER_DECRYPT_PORT, "reachable": decrypt_ok},
            "m3u8_port":    {"port": WRAPPER_M3U8_PORT,    "reachable": m3u8_ok},
            "all_ok": decrypt_ok and m3u8_ok,
        },
        "cookies_ok": cookies_ok,
        "downloader_initialized": manager.is_initialized,
    }

@router.get("/search")
async def search_apple_music(term: str = Query(..., description="Search term")):
    if not manager.is_initialized:
        success = await manager.initialize()
        if not success:
            raise HTTPException(status_code=500, detail="Downloader not initialized.")
            
    try:
        results = await manager.apple_music_api.get_search_results(term=term)
        return {"success": True, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
