# 音频下载投递、转码播放、本地歌词封面与目录扫描管理模块
from backend.head import (
    APIRouter, HTTPException, FileResponse, Response, BaseModel,
    Optional, List, Dict, Any, os, time, subprocess, shutil, Path,
    re, hashlib, unicodedata, logging, asyncio
)
from backend.services.downloader import manager
from backend.core.config import settings
from backend.db.database import (
    gthstrybytrk, inshstry, updhstrylrc
)
from backend.api.common import (
    nrmlcdclbl, wrprhlth, LOCAL_SCAN_EXTENSIONS, LOCAL_API_BASE_URL,
    fnmkey, strptrkprfx, fndsdcrlrc
)

# 日志记录器与路由器
logger = logging.getLogger(__name__)
router = APIRouter()


# 请求模型定义
class DownloadRequest(BaseModel):
    url: str
    codec: str = "aac-legacy"
    video_resolution: str = "1080p"
    use_wrapper: bool = False
    metadata_region: Optional[str] = None


class OpenFolderRequest(BaseModel):
    path: Optional[str] = None


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
    completed = subprocess.run(command, capture_output=True, text=True)
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


# 提交单曲或专辑下载任务端点
@router.post("/download")
async def strtdwnld(request: DownloadRequest):
    if not await manager.ensure_initialized():
        raise HTTPException(
            status_code=500,
            detail="Downloader not initialized. Please ensure cookies.txt is provided and valid."
        )

    normalized_codec = nrmlcdclbl(request.codec)
    if normalized_codec in {"alac", "dolby"} and not request.use_wrapper:
        raise HTTPException(
            status_code=400,
            detail="当前音质需要Wrapper支持。请先启用并确保Wrapper正在运行后重试。",
        )

    if request.use_wrapper:
        wrapper_health = await asyncio.to_thread(wrprhlth)
        if not wrapper_health.get("all_ok"):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Wrapper未就绪，已拒绝自动降级下载。"
                    f" 端口状态: decrypt={wrapper_health.get('decrypt_ok')},"
                    f" m3u8={wrapper_health.get('m3u8_ok')},"
                    f" account={wrapper_health.get('account_ok')}。"
                    " 请在“安装Wrapper并登录”中重启Wrapper后重试。"
                ),
            )

    added = await manager.add_to_queue(
        request.url,
        codec=request.codec,
        video_resolution=request.video_resolution,
        use_wrapper=request.use_wrapper,
        metadata_region=request.metadata_region,
    )
    if not added:
        raise HTTPException(status_code=500, detail="Failed to add to download queue")

    return {"message": "Download started", "url": request.url}


# 获取下载队列状态端点
@router.get("/status")
async def gtdwnldstts() -> Dict[str, Any]:
    return {
        "is_initialized": manager.is_initialized,
        "downloads": manager.download_status
    }


# 本地音频流式试听播放端点
@router.get("/local-play/{track_id}")
async def strmlclad(track_id: str):
    track = gthstrybytrk(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track history not found")

    file_path = track.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    codec = nrmlcdclbl(str(track.get("codec") or ""))
    if codec not in {"aac", "alac", "dolby"}:
        codec = await asyncio.to_thread(dtctlclcdc, file_path)

    serve_path = file_path
    headers = {"Accept-Ranges": "bytes"}

    if shlddcdweb(codec):
        try:
            serve_path = await asyncio.to_thread(dcdplbckpth, track_id, file_path)
            headers["X-Playback-Decoded"] = codec
        except Exception as e:
            logger.error("Local playback decode failed: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to decode local audio: {e}")

    media_type = "audio/wav" if serve_path.lower().endswith(".wav") else "audio/mp4"
    return FileResponse(serve_path, media_type=media_type, headers=headers)


# 获取本地音频内嵌封面图像端点
@router.get("/local-artwork/{track_id}")
async def gtlchart(track_id: str):
    track = gthstrybytrk(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track history not found")

    file_path = track.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    try:
        result = await asyncio.to_thread(extrcovr, file_path)
    except Exception as e:
        logger.warning("Read local artwork failed: %s | %s", e, file_path)
        result = None

    if not result:
        raise HTTPException(status_code=404, detail="No embedded artwork found")

    cover_bytes, media_type = result
    return Response(
        content=cover_bytes,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


# 获取本地伴随LRC歌词文本端点
@router.get("/local-lyrics/{track_id}")
async def gtlcllrc(track_id: str):
    track = gthstrybytrk(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track history not found")

    file_path = track.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    preferred_path = str(track.get("lyrics_path") or "").strip() or None
    lrc_path = await asyncio.to_thread(fndsdcrlrc, file_path, preferred_path)
    if not lrc_path or not os.path.exists(lrc_path):
        raise HTTPException(status_code=404, detail="LRC lyrics file not found")

    if lrc_path != preferred_path:
        await asyncio.to_thread(updhstrylrc, track_id, lrc_path)

    try:
        content = await asyncio.to_thread(rdtxtflbck, lrc_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read lyrics file: {e}")

    return {
        "success": True,
        "track_id": track_id,
        "path": lrc_path,
        "content": content,
    }


# 打开下载资源管理器目录端点
@router.post("/open-folder")
async def opndwnldfldr(request: OpenFolderRequest):
    path = request.path
    target_path = path or settings.outpth()
    if not os.path.exists(target_path) and not path:
        os.makedirs(target_path, exist_ok=True)

    if path and not os.path.exists(target_path):
        target_path = os.path.dirname(target_path)
        if not os.path.exists(target_path):
            raise HTTPException(status_code=404, detail="Target path not found")

    try:
        if os.name == "nt":
            if path and os.path.isfile(path):
                subprocess.run(["explorer", "/select,", os.path.normpath(path)])
            else:
                os.startfile(os.path.normpath(target_path))
        else:
            subprocess.run(["xdg-open", target_path])
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 打开音频格式转换输出目录端点
@router.post("/open-converted-folder")
async def opncnvtfldr():
    target_path = settings.cnvtpth()
    os.makedirs(target_path, exist_ok=True)
    try:
        if os.name == "nt":
            os.startfile(os.path.normpath(target_path))
        else:
            subprocess.run(["xdg-open", target_path])
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 触发本地音乐目录重扫描端点
@router.post("/scan-local")
async def scnlcllbrtr():
    try:
        root_path = settings.outpth()
        os.makedirs(root_path, exist_ok=True)
        summary = await asyncio.to_thread(scnlcllb, root_path)
        return {"success": True, "root_path": root_path, **summary}
    except Exception as e:
        logger.exception("Failed to scan local library")
        raise HTTPException(status_code=500, detail=str(e))


# 兼容性别名
start_download = strtdwnld
get_status = gtdwnldstts
stream_local_audio = strmlclad
get_local_artwork = gtlchart
get_local_lyrics = gtlcllrc
open_download_folder = opndwnldfldr
open_converted_folder = opncnvtfldr
scan_local_library = scnlcllbrtr
_scan_local_library_impl = scnlcllb
