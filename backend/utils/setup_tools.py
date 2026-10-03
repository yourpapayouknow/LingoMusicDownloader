# Bento4解密工具自动下载与部署实用工具
from backend.head import os, urllib, zipfile, shutil, logging
from backend.core.config import settings

# 模块日志记录器
logger = logging.getLogger(__name__)


# 下载并解压mp4decrypt二进制文件
def stmp4dc() -> str | None:
    bin_dir = settings.bindir()
    os.makedirs(bin_dir, exist_ok=True)
    mp4decrypt_path = settings.mp4dcrpth()

    if os.path.exists(mp4decrypt_path):
        return mp4decrypt_path

    logger.info("Downloading Bento4 (mp4decrypt)...")
    url = "https://github.com/axiomatic-systems/Bento4/releases/download/v1.6.0-641/Bento4-BIN-1.6.0-641-x86_64-unknown-windows.zip"
    zip_path = os.path.join(bin_dir, "bento4.zip")

    try:
        urllib.request.urlretrieve(url, zip_path)
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            for file_info in zip_ref.infolist():
                if file_info.filename.endswith("mp4decrypt.exe"):
                    file_info.filename = "mp4decrypt.exe"
                    zip_ref.extract(file_info, bin_dir)
                    break
        if os.path.exists(zip_path):
            os.remove(zip_path)
        logger.info("mp4decrypt downloaded successfully.")
        return mp4decrypt_path
    except Exception as e:
        logger.error(f"Failed to download mp4decrypt: {e}")
        return None


# 兼容性别名
setup_mp4decrypt = stmp4dc


# 命令行独立测试执行入口
if __name__ == "__main__":
    stmp4dc()
