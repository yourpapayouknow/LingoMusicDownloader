from pydantic_settings import BaseSettings
import os
import sys

class Settings(BaseSettings):
    PROJECT_NAME: str = "LingoMusicDownloader Backend"
    API_V1_STR: str = "/api/v1"
    
    # Gamdl settings
    LOG_LEVEL: str = "INFO"
    DOWNLOAD_MODE: str = "ytdlp"
    SONG_CODEC_PRIORITY: str = "aac-legacy"

    @property
    def BASE_DIR(self) -> str:
        if getattr(sys, 'frozen', False):
            return os.path.dirname(sys.executable)
        return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
    @property
    def BUNDLE_DIR(self) -> str:
        if getattr(sys, 'frozen', False):
            return getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
        return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    @property
    def COOKIES_PATH(self) -> str:
        return os.path.join(self.BASE_DIR, "cookies.txt")

    @property
    def OUTPUT_PATH(self) -> str:
        return os.path.join(self.BASE_DIR, "Apple Music")

    @property
    def CONVERTED_PATH(self) -> str:
        return os.path.join(self.BASE_DIR, "Converted")

    @property
    def BIN_DIR(self) -> str:
        candidates = [
            os.path.join(self.BUNDLE_DIR, "bin"),
            os.path.join(self.BASE_DIR, "bin"),
        ]

        base_name = os.path.basename(self.BASE_DIR)
        if base_name.endswith("_legacy"):
            sibling_name = base_name[:-len("_legacy")]
            sibling_dir = os.path.join(os.path.dirname(self.BASE_DIR), sibling_name)
            candidates.append(os.path.join(sibling_dir, "bin"))

        for candidate in candidates:
            if os.path.exists(candidate):
                return candidate

        return candidates[0]
    
    @property
    def FFMPEG_PATH(self) -> str:
        # Check in bin/ffmpeg/ffmpeg.exe
        path = os.path.join(self.BIN_DIR, "ffmpeg", "ffmpeg.exe")
        if os.path.exists(path):
            return path
        # Fallback to bin/ffmpeg.exe
        return os.path.join(self.BIN_DIR, "ffmpeg.exe")
        
    @property
    def MP4DECRYPT_PATH(self) -> str:
        return os.path.join(self.BIN_DIR, "mp4decrypt.exe")

settings = Settings()
