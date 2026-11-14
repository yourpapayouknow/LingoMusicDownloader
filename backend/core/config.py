# 系统配置与运行环境路径管理模块
from backend.head import BaseSettings, os, sys, json


class Settings(BaseSettings):
    # 核心配置项
    PROJECT_NAME: str = "LingoMusicDownloader Backend"
    API_V1_STR: str = "/api/v1"
    LOG_LEVEL: str = "INFO"

    # 获取可写数据目录
    def bsdir(self) -> str:
        if getattr(sys, "frozen", False):
            override = os.environ.get("LINGOMUSIC_DATA_DIR")
            if override:
                return os.path.abspath(override)
            local = os.environ.get("LOCALAPPDATA")
            if local:
                return os.path.join(local, "LingoMusicDownloader")
            return os.path.dirname(sys.executable)
        return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    # 获取打包资源根目录
    def resdir(self) -> str:
        if getattr(sys, "frozen", False):
            return os.path.dirname(sys.executable)
        return self.bsdir()

    # 获取打包资源目录
    def bndldir(self) -> str:
        if getattr(sys, "frozen", False):
            return getattr(sys, "_MEIPASS", self.resdir())
        return self.bsdir()

    # 获取Cookie文件路径
    def ckspth(self) -> str:
        return os.path.join(self.bsdir(), "cookies.txt")

    # 读取存储路径覆盖配置
    def _ovrpath(self, key: str, default: str) -> str:
        try:
            cfg_path = os.path.join(self.bsdir(), "data", "storage_paths.json")
            with open(cfg_path, "r", encoding="utf-8") as fh:
                payload = json.load(fh)
            value = str(payload.get(key) or "").strip()
            if value:
                return value
        except Exception:
            pass
        return default

    # 获取下载输出目录
    def outpth(self) -> str:
        return self._ovrpath("download_dir", os.path.join(self.bsdir(), "Apple Music"))

    # 获取转换输出目录
    def cnvtpth(self) -> str:
        return self._ovrpath("converted_dir", os.path.join(self.bsdir(), "Converted"))

    # 获取二进制工具目录
    def bindir(self) -> str:
        candidates = [
            os.path.join(self.bndldir(), "bin"),
            os.path.join(self.resdir(), "bin"),
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
