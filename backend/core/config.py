# 系统配置与运行环境路径管理模块
from backend.head import BaseSettings, os, sys


class Settings(BaseSettings):
    # 核心配置项
    PROJECT_NAME: str = "LingoMusicDownloader Backend"
    API_V1_STR: str = "/api/v1"
    LOG_LEVEL: str = "INFO"
    DOWNLOAD_MODE: str = "ytdlp"
    SONG_CODEC_PRIORITY: str = "aac-legacy"

    # 获取基础运行目录
    def bsdir(self) -> str:
        if getattr(sys, "frozen", False):
            return os.path.dirname(sys.executable)
        return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    # 获取打包资源目录
    def bndldir(self) -> str:
        if getattr(sys, "frozen", False):
            return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
        return self.bsdir()

    # 获取Cookie文件路径
    def ckspth(self) -> str:
        return os.path.join(self.bsdir(), "cookies.txt")

    # 获取下载输出目录
    def outpth(self) -> str:
        return os.path.join(self.bsdir(), "Apple Music")

    # 获取转换输出目录
    def cnvtpth(self) -> str:
        return os.path.join(self.bsdir(), "Converted")

    # 获取二进制工具目录
    def bindir(self) -> str:
        candidates = [
            os.path.join(self.bndldir(), "bin"),
            os.path.join(self.bsdir(), "bin"),
        ]
        for c in candidates:
            if os.path.exists(c):
                return c
        return candidates[0]

    # 获取FFmpeg可执行文件路径
    def ffmpgpth(self) -> str:
        p = os.path.join(self.bindir(), "ffmpeg", "ffmpeg.exe")
        if os.path.exists(p):
            return p
        return os.path.join(self.bindir(), "ffmpeg.exe")

    # 获取mp4decrypt可执行文件路径
    def mp4dcrpth(self) -> str:
        return os.path.join(self.bindir(), "mp4decrypt.exe")


settings = Settings()
