from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any

from backend.services.downloader import manager
from backend.core.config import settings

router = APIRouter()

class DownloadRequest(BaseModel):
    url: str

@router.post("/download")
async def start_download(request: DownloadRequest):
    if not manager.is_initialized:
        success = await manager.initialize()
        if not success:
            raise HTTPException(
                status_code=500, 
                detail="Downloader not initialized. Please ensure cookies.txt is provided and valid."
            )
    
    added = await manager.add_to_queue(request.url)
    if not added:
        raise HTTPException(status_code=500, detail="Failed to add to download queue")
        
    return {"message": "Download started", "url": request.url}

@router.get("/status")
async def get_status() -> Dict[str, Any]:
    return {
        "is_initialized": manager.is_initialized,
        "downloads": manager.download_status
    }
