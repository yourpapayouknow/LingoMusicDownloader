from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging

from backend.core.config import settings
from backend.api.routes import router as api_router
from backend.services.downloader import manager

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper()))
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, this should be restricted
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing gamdl downloader...")
    success = await manager.initialize()
    if success:
        logger.info("Downloader initialized successfully.")
    else:
        logger.warning("Downloader initialization failed. Ensure cookies.txt is present.")

@app.get("/")
def read_root():
    return {"message": "Welcome to LingoMusicDownloader API"}

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
