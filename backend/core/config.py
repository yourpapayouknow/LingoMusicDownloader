from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "LingoMusicDownloader Backend"
    API_V1_STR: str = "/api/v1"
    
    # Path settings
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    COOKIES_PATH: str = os.path.join(BASE_DIR, "cookies.txt")
    OUTPUT_PATH: str = os.path.join(BASE_DIR, "Apple Music")
    
    # Gamdl settings
    LOG_LEVEL: str = "INFO"
    DOWNLOAD_MODE: str = "ytdlp"
    SONG_CODEC_PRIORITY: str = "aac-legacy"

settings = Settings()
