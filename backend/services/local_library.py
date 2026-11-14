# 本地音乐库扫描、元数据读取、封面缓存与试听转码服务
from backend.head import (
    os, subprocess, shutil, Path, re, hashlib, logging,
    Any, Dict, List, Optional
)
from backend.core.config import settings
from backend.db.database import gthstrybytrk, inshstry
from backend.utils.common import nrmlcdclbl, fndsdcrlrc

# 日志记录器
logger = logging.getLogger(__name__)

# 本地扫描支持的音频扩展名
LOCAL_SCAN_EXTENSIONS = {".m4a", ".aac", ".mp4", ".m4v"}
# 本地媒体资源API基址
LOCAL_API_BASE_URL = "http://127.0.0.1:8000/api"


# 强制转换媒体元数据标签值
def crctagval(value: Any) -> str:
    if isinstance(value, (list, tuple)):
        if not value:
            return ""
        value = value[0]
    if value is None:
        return ""
    if isinstance(value, bytes):
        for encoding in ("utf-8", "utf-16", "latin-1"):
            try:
                return value.decode(encoding).strip()
            except Exception:
                continue
        return ""
    return str(value).strip()


# 读取媒体标签字典候选键值
def rdtag(tags: Any, keys: List[str]) -> str:
    if not tags:
        return ""
    for key in keys:
        try:
            if key in tags:
                val = crctagval(tags.get(key))
                if val:
                    return val
        except Exception:
            continue
    return ""


# 检测本地音频文件的编码格式
def dtctlclcdc(file_path: str) -> str:
    # 惰性导入：避免启动期加载mutagen重型依赖
    from mutagen import File as MutagenFile
    try:
        audio = MutagenFile(file_path)
        info = getattr(audio, "info", None)
        raw = getattr(info, "codec", None)
        if raw:
            return nrmlcdclbl(str(raw))
    except Exception as e:
        logger.warning("Failed to detect local codec: %s | file=%s", e, file_path)
    suffix = Path(file_path).suffix.lower()
    return nrmlcdclbl(suffix.lstrip("."))


# 提取音频文件中内嵌的封面图像
def extrcovr(file_path: str) -> Optional[tuple[bytes, str]]:
    # 惰性导入：避免启动期加载mutagen重型依赖
    from mutagen import File as MutagenFile
    from mutagen.mp4 import MP4Cover
    audio = MutagenFile(file_path)
    tags = getattr(audio, "tags", None)
    if not tags:
        return None

    covers = tags.get("covr")
    if not covers:
        return None

    first = covers[0]
    cover_bytes = bytes(first)
    imageformat = getattr(first, "imageformat", None)
    if imageformat == MP4Cover.FORMAT_PNG:
        return cover_bytes, "image/png"
    return cover_bytes, "image/jpeg"


# 自动降级编码读取歌词文本文件
def rdtxtflbck(file_path: str) -> str:
    encodings = ["utf-8-sig", "utf-8", "gb18030", "big5", "cp1252", "latin-1"]
    for enc in encodings:
        try:
            return Path(file_path).read_text(encoding=enc)
        except Exception:
            continue
    raise RuntimeError("Unable to decode lyrics file with fallback encodings")


# 判断是否需要为浏览器播放转码为WAV
def shlddcdweb(codec_label: str) -> bool:
    return codec_label in {"alac", "dolby"}


# 生成安全的文件名标识
def sftrkidfn(track_id: str) -> str:
    safe = re.sub(r"[^\w\-\.]", "_", track_id)
    return safe[:128] if safe else "track"


# 选择高质量PCM采样深度
def slctpcmcdc(source_path: str) -> str:
    # 惰性导入：避免启动期加载mutagen重型依赖
    from mutagen import File as MutagenFile
    try:
        audio = MutagenFile(source_path)
        info = getattr(audio, "info", None)
        bits_per_sample = int(getattr(info, "bits_per_sample", 16) or 16)
        if bits_per_sample >= 24:
            return "pcm_s24le"
    except Exception:
        pass
    return "pcm_s16le"


# 转换无损音频至PCM用于网页端实时试听
def dcdplbckpth(track_id: str, source_path: str) -> str:
    cache_root = os.path.join(settings.bsdir(), "data", "playback_cache")
    os.makedirs(cache_root, exist_ok=True)

    stat = os.stat(source_path)
    fingerprint = f"{stat.st_mtime_ns}_{stat.st_size}"
    safe_id = sftrkidfn(track_id)
    output_name = f"{safe_id}_{fingerprint}.wav"
    target_path = os.path.join(cache_root, output_name)

    if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
        return target_path

    ffmpeg_bin = settings.ffmpgpth()
    if not os.path.exists(ffmpeg_bin):
        ffmpeg_bin = shutil.which("ffmpeg") or ""
    if not ffmpeg_bin:
        raise RuntimeError("FFmpeg not found; cannot decode ALAC/Dolby for browser playback")

    prefix = f"{safe_id}_"
    for name in os.listdir(cache_root):
        if name.startswith(prefix) and name != output_name:
            try:
                os.remove(os.path.join(cache_root, name))
            except OSError:
                pass

    pcm_codec = slctpcmcdc(source_path)
    command = [
        ffmpeg_bin,
        "-y",
        "-i",
        source_path,
        "-vn",
        "-c:a",
        pcm_codec,
        target_path,
    ]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=300)
    if completed.returncode != 0 or not os.path.exists(target_path):
        raise RuntimeError(
            "FFmpeg decode failed: "
            + (completed.stderr or completed.stdout or "unknown error")[-500:]
        )
    return target_path


# 基于文件绝对路径生成备用track_id
def flbcktrkid(file_path: str) -> str:
    normalized = os.path.normcase(os.path.abspath(file_path))
    digest = hashlib.sha1(normalized.encode("utf-8", errors="ignore")).hexdigest()[:20]
    return f"local-{digest}"


# 解析本地音频文件元数据构造记录字典
def extrlclhst(file_path: str) -> Dict[str, Any]:
    file_size = os.path.getsize(file_path)
    stem_title = Path(file_path).stem
    lyrics_path = fndsdcrlrc(file_path) or ""

    track_id = ""
    name = stem_title
    artist_name = "Unknown Artist"
    album_name = "Unknown Album"
    artwork_url = ""
    codec = dtctlclcdc(file_path)
    has_embedded_cover = False

    try:
        # 惰性导入：避免启动期加载mutagen重型依赖
        from mutagen import File as MutagenFile
        audio = MutagenFile(file_path)
        tags = getattr(audio, "tags", None)
        if tags:
            if tags.get("covr"):
                has_embedded_cover = True
            name = rdtag(tags, ["©nam", "title"]) or name
            artist_name = rdtag(tags, ["©ART", "aART", "artist"]) or artist_name
            album_name = rdtag(tags, ["©alb", "album"]) or album_name
            raw_track_id = rdtag(
                tags,
                [
                    "cnID",
                    "atID",
                    "xid ",
                    "----:com.apple.iTunes:cnID",
                ],
            )
            if raw_track_id:
                sanitized = re.sub(r"[^\w\-.:]", "", raw_track_id)
                track_id = sanitized or raw_track_id
    except Exception as e:
        logger.warning("Failed to read local media tags: %s | file=%s", e, file_path)

    if not track_id:
        track_id = flbcktrkid(file_path)

    if has_embedded_cover:
        artwork_url = f"{LOCAL_API_BASE_URL}/local-artwork/{track_id}"

    return {
        "track_id": str(track_id),
        "name": name,
        "artist_name": artist_name,
        "album_name": album_name,
        "artwork_url": artwork_url,
        "codec": codec,
        "file_path": file_path,
        "lyrics_path": lyrics_path,
        "file_size": file_size,
    }


# 扫描本地下载目录同步历史记录
def scnlcllb(root_path: str) -> Dict[str, Any]:
    summary = {
        "scanned_files": 0,
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "failed": 0,
        "errors": [],
    }

    if not os.path.exists(root_path):
        return summary

    for root, _, files in os.walk(root_path):
        for filename in files:
            suffix = Path(filename).suffix.lower()
            if suffix not in LOCAL_SCAN_EXTENSIONS:
                continue

            summary["scanned_files"] += 1
            full_path = os.path.join(root, filename)
            try:
                row = extrlclhst(full_path)
                existing = gthstrybytrk(row["track_id"])

                if existing:
                    existing_artwork = str(existing.get("artwork_url") or "")
                    new_artwork = str(row.get("artwork_url") or "")

                    if existing_artwork.startswith("http") and "/api/local-artwork/" not in existing_artwork and new_artwork.startswith(LOCAL_API_BASE_URL):
                        row["artwork_url"] = existing_artwork

                    unchanged = all(
                        str(existing.get(key) or "") == str(row.get(key) or "")
                        for key in [
                            "name",
                            "artist_name",
                            "album_name",
                            "artwork_url",
                            "codec",
                            "file_path",
                            "lyrics_path",
                            "file_size",
                        ]
                    )
                    if unchanged:
                        summary["skipped"] += 1
                        continue

                inshstry(row)
                if existing:
                    summary["updated"] += 1
                else:
                    summary["inserted"] += 1
            except Exception as e:
                summary["failed"] += 1
                if len(summary["errors"]) < 8:
                    summary["errors"].append(f"{filename}: {str(e)}")

    return summary


# 压缩内嵌封面至最大512px并落盘缓存
def rzsccovrcch(track_id: str, file_path: str) -> tuple[bytes, str]:
    # 惰性导入：避免启动期加载PIL重型依赖
    import io
    from PIL import Image
    cache_dir = os.path.join(settings.bsdir(), "data", "artwork_cache")
    os.makedirs(cache_dir, exist_ok=True)
    stat = os.stat(file_path)
    cache_name = f"{sftrkidfn(track_id)}_{stat.st_mtime_ns}.jpg"
    cache_path = os.path.join(cache_dir, cache_name)
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 0:
        return Path(cache_path).read_bytes(), "image/jpeg"

    cover_bytes, _ = extrcovr(file_path)
    with Image.open(io.BytesIO(cover_bytes)) as img:
        img = img.convert("RGB")
        img.thumbnail((512, 512))
        img.save(cache_path, "JPEG", quality=85)

    prefix = f"{sftrkidfn(track_id)}_"
    for name in os.listdir(cache_dir):
        if name.startswith(prefix) and name != cache_name:
            try:
                os.remove(os.path.join(cache_dir, name))
            except OSError:
                pass
    return Path(cache_path).read_bytes(), "image/jpeg"