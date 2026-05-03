from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Dict, Any, Optional

from backend.services.downloader import manager
from backend.core.config import settings

router = APIRouter()

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
