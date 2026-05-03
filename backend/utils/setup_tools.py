import os
import urllib.request
import zipfile
import shutil
import logging

logger = logging.getLogger(__name__)

def setup_mp4decrypt():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    bin_dir = os.path.join(base_dir, "bin")
    os.makedirs(bin_dir, exist_ok=True)
    
    mp4decrypt_path = os.path.join(bin_dir, "mp4decrypt.exe")
    
    if os.path.exists(mp4decrypt_path):
        return mp4decrypt_path
        
    logger.info("Downloading Bento4 (mp4decrypt)...")
    url = "https://github.com/axiomatic-systems/Bento4/releases/download/v1.6.0-641/Bento4-BIN-1.6.0-641-x86_64-unknown-windows.zip"
    zip_path = os.path.join(bin_dir, "bento4.zip")
    
    try:
        urllib.request.urlretrieve(url, zip_path)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Extract specifically mp4decrypt.exe
            for file_info in zip_ref.infolist():
                if file_info.filename.endswith('mp4decrypt.exe'):
                    file_info.filename = 'mp4decrypt.exe'
                    zip_ref.extract(file_info, bin_dir)
                    break
        os.remove(zip_path)
        logger.info("mp4decrypt downloaded successfully.")
        return mp4decrypt_path
    except Exception as e:
        logger.error(f"Failed to download mp4decrypt: {e}")
        return None

if __name__ == "__main__":
    setup_mp4decrypt()
