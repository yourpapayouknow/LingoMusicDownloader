# 音频下载投递、本地播放与目录操作端点模块
from backend.head import (
    APIRouter, HTTPException, FileResponse, Response, BaseModel, Field,
    Optional, Literal, Dict, Any, os, subprocess, Path, logging, asyncio
)
from backend.services.downloader import manager
from backend.services.storage import knownroots
from backend.services.local_library import (
    dtctlclcdc, dcdplbckpth, shlddcdweb, rdtxtflbck, rzsccovrcch, scnlcllb
)
from backend.core.config import settings
from backend.db.database import gthstrybytrk, updhstrylrc
from backend.api.common import wrprhlth
from backend.utils.common import nrmlcdclbl, fndsdcrlrc

# 日志记录器与路由器
logger = logging.getLogger(__name__)
router = APIRouter()


# 下载请求模型定义
class DownloadRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    codec: Literal["aac-legacy", "aac", "alac", "dolby"] = "aac-legacy"
    video_resolution: Literal["480p", "720p", "1080p", "2160p"] = "1080p"
    use_wrapper: bool = False
    metadata_region: Optional[str] = Field(default=None, pattern=r"^[A-Za-z]{2}$")


# 打开目录请求模型定义
class OpenFolderRequest(BaseModel):
    path: Optional[str] = Field(default=None, max_length=4096)


# 校验目录打开请求并限定在下载/转换目录内
def vldopnptr(raw_path: Optional[str]) -> Path:
    roots = [Path(item).resolve() for item in knownroots()]
    if not raw_path:
        return Path(settings.outpth()).resolve()
    try:
        resolved = Path(raw_path).expanduser().resolve(strict=False)
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"路径无效: {exc}")
    if not any(resolved == root or root in resolved.parents for root in roots):
        raise HTTPException(status_code=403, detail="只允许打开下载或转换目录内的路径")
    return resolved


# 在系统文件管理器中打开目录或定位文件
def opnptr(target: Path, is_file: bool) -> None:
    if os.name == "nt":
        if is_file:
            subprocess.run(["explorer", "/select,", str(target)])
        else:
            os.startfile(str(target))
    else:
        subprocess.run(["xdg-open", str(target)])


# 查询本地曲目历史并校验音频文件存在
def gttrckfl(track_id: str) -> Dict[str, Any]:
    track = gthstrybytrk(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track history not found")

    file_path = track.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")
    return track


# 提交单曲或专辑下载任务端点
@router.post("/download")
async def strtdwnld(request: DownloadRequest):
    if not await manager.ensinit():
        raise HTTPException(
            status_code=500,
            detail="Downloader not initialized. Please ensure cookies.txt is provided and valid."
        )

    normalized_codec = nrmlcdclbl(request.codec)
    if normalized_codec in {"alac", "dolby"} and not request.use_wrapper:
        raise HTTPException(
            status_code=400,
            detail="当前音质需要解密组件支持。请先启用并确保解密组件正在运行后重试。",
        )

    if request.use_wrapper:
        wrapper_health = await asyncio.to_thread(wrprhlth)
        if not wrapper_health.get("all_ok"):
            raise HTTPException(
                status_code=409,
                detail=(
                    "解密组件未就绪，已拒绝自动降级下载。"
                    f" 端口状态: decrypt={wrapper_health.get('decrypt_ok')},"
                    f" m3u8={wrapper_health.get('m3u8_ok')},"
                    f" account={wrapper_health.get('account_ok')}。"
                    " 请在“安装解密组件并登录”中重启解密组件后重试。"
                ),
            )

    added = await manager.adque(
        request.url,
        codec=normalized_codec,
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
    track = await asyncio.to_thread(gttrckfl, track_id)
    file_path = track["file_path"]

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


# 读取本地内嵌封面端点
@router.get("/local-artwork/{track_id}")
async def gtlchart(track_id: str):
    track = await asyncio.to_thread(gttrckfl, track_id)
    file_path = track["file_path"]

    try:
        result = await asyncio.to_thread(rzsccovrcch, track_id, file_path)
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
    track = await asyncio.to_thread(gttrckfl, track_id)
    file_path = track["file_path"]

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
    target_path = vldopnptr(request.path)
    if not target_path.exists():
        if request.path:
            raise HTTPException(status_code=404, detail="Target path not found")
        target_path.mkdir(parents=True, exist_ok=True)

    try:
        await asyncio.to_thread(opnptr, target_path, target_path.is_file())
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 打开音频格式转换输出目录端点
@router.post("/open-converted-folder")
async def opncnvtfldr():
    target_path = Path(settings.cnvtpth())
    target_path.mkdir(parents=True, exist_ok=True)
    try:
        await asyncio.to_thread(opnptr, target_path, False)
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