# 客户端设置读写、下载历史管理与全系统健康状态探针模块
from backend.head import (
    APIRouter, HTTPException, List, Dict, Any, Optional, os, time, logging, asyncio
)
from backend.services.downloader import manager
from backend.core.config import settings
from backend.db.database import (
    gtallstngs, svstngs, gthstry, dlthstry, gthstrybytrk
)
from backend.api.common import (
    WRAPPER_DECRYPT_PORT, WRAPPER_M3U8_PORT, WRAPPER_ACCOUNT_PORT,
    HEALTH_CACHE_TTL_SECONDS, wrprhlth
)

# 日志记录器与路由器
logger = logging.getLogger(__name__)
router = APIRouter()

# 内部健康检查缓存
_health_cache: Optional[tuple[float, Dict[str, Any]]] = None
_health_lock = asyncio.Lock()


# 读取全部客户端配置端点
@router.get("/settings")
async def gtstngsrtr() -> Dict[str, Any]:
    return await asyncio.to_thread(gtallstngs)


# 保存客户端配置键值端点
@router.post("/settings")
async def svstngsrtr(settings_dict: Dict[str, Any]):
    if not settings_dict or not all(
        isinstance(key, str) and key.startswith("lingomusic-") for key in settings_dict
    ):
        raise HTTPException(status_code=400, detail="配置键必须以 lingomusic- 开头")
    await asyncio.to_thread(svstngs, settings_dict)
    return {"success": True, "message": "Settings updated"}


# 获取全量历史下载记录端点
@router.get("/history")
async def gthstryrtr() -> List[Dict[str, Any]]:
    return await asyncio.to_thread(gthstry)


# 删除单条历史下载记录及关联文件端点
@router.delete("/history/{track_id}")
async def dlthstryrtr(track_id: str, delete_file: bool = False):
    file_deleted = False
    file_error = ""
    if delete_file:
        track = await asyncio.to_thread(gthstrybytrk, track_id)
        if track and track.get("file_path"):
            path = track["file_path"]
            try:
                if await asyncio.to_thread(os.path.exists, path):
                    await asyncio.to_thread(os.remove, path)
                    file_deleted = True
            except FileNotFoundError:
                file_deleted = True
            except Exception as exc:
                file_error = str(exc)
                logger.warning("Failed to delete history file: %s | %s", exc, path)
    await asyncio.to_thread(dlthstry, track_id)
    return {"success": True, "file_deleted": file_deleted, "file_error": file_error}


# 系统全链路运行健康检查端点
@router.get("/health")
async def hlthchkrtr() -> Dict[str, Any]:
    global _health_cache

    now_ts = time.time()
    if _health_cache and (now_ts - _health_cache[0] <= HEALTH_CACHE_TTL_SECONDS):
        return _health_cache[1]

    async with _health_lock:
        now_ts = time.time()
        if _health_cache and (now_ts - _health_cache[0] <= HEALTH_CACHE_TTL_SECONDS):
            return _health_cache[1]

        wrapper_health = await asyncio.to_thread(wrprhlth)
        decrypt_ok = wrapper_health["decrypt_ok"]
        m3u8_ok = wrapper_health["m3u8_ok"]
        account_ok = wrapper_health["account_ok"]

        cookies_path = settings.ckspth()
        cookies_ok = await asyncio.to_thread(
            lambda: os.path.exists(cookies_path) and os.path.getsize(cookies_path) > 10
        )
        payload = {
            "wrapper": {
                "decrypt_port": {"port": WRAPPER_DECRYPT_PORT, "reachable": decrypt_ok},
                "m3u8_port": {"port": WRAPPER_M3U8_PORT, "reachable": m3u8_ok},
                "account_port": {"port": WRAPPER_ACCOUNT_PORT, "reachable": account_ok},
                "all_ok": decrypt_ok and m3u8_ok and account_ok,
            },
            "cookies_ok": cookies_ok,
            "downloader_initialized": manager.is_initialized,
            "account_storefront": (getattr(manager.apple_music_api, "storefront", "") or "").lower(),
        }
        _health_cache = (time.time(), payload)
        return payload