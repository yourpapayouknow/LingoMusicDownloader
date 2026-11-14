# Apple Music与iTunes音乐目录检索端点模块
from backend.head import (
    APIRouter, HTTPException, Query, Request, Response, BaseModel, Field,
    Dict, Any, Optional, List, time, logging, asyncio
)
from backend.services.downloader import manager
from backend.services.search import srchfast, nrmlsrchrst, prsaplurl
from backend.db.database import rprtsrch, gtrecmdtn
from backend.utils.common import SEARCH_CATEGORY_KEYS

# 日志记录器与路由器
logger = logging.getLogger(__name__)
router = APIRouter()


# 请求模型定义
class ReportSearchRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=128)


# 搜索端点预检响应
@router.head("/search", include_in_schema=False)
async def srchhd():
    return Response()


# 音乐与媒体目录搜索端点
@router.get("/search")
async def srchaplrtr(request: Request, term: str = Query(..., description="Search term")):
    if not await manager.ensinit():
        raise HTTPException(status_code=500, detail="Downloader not initialized.")

    try:
        item_type, item_id = prsaplurl(term)
        if item_type and item_id:
            results: Dict[str, Any] = {
                category: {"data": []} for category in SEARCH_CATEGORY_KEYS
            }

            if item_type == "songs":
                song = await manager.apple_music_api.get_song(item_id)
                if "data" in song:
                    results["songs"]["data"] = song["data"]
            elif item_type == "albums":
                album = await manager.apple_music_api.get_album(item_id)
                if "data" in album:
                    results["albums"]["data"] = album["data"]
            elif item_type == "playlists":
                playlist = await manager.apple_music_api.get_playlist(item_id)
                if "data" in playlist:
                    results["playlists"]["data"] = playlist["data"]
            elif item_type == "music-videos":
                mv = await manager.apple_music_api.get_music_video(item_id)
                if "data" in mv:
                    results["music-videos"]["data"] = mv["data"]
            elif item_type == "artists":
                get_artist = getattr(manager.apple_music_api, "get_artist", None)
                if callable(get_artist):
                    artist = await get_artist(item_id)
                    if isinstance(artist, dict) and "data" in artist:
                        results["artists"]["data"] = artist["data"]

            return {"success": True, "results": nrmlsrchrst(results)}

        start_ts = time.perf_counter()
        raw_results = await srchfast(term=term)
        elapsed_ms = (time.perf_counter() - start_ts) * 1000
        try:
            result_groups = raw_results.get("results", {}) or {}
            counts = {
                category: len((result_groups.get(category, {}) or {}).get("data", []) or [])
                for category in SEARCH_CATEGORY_KEYS
            }
            logger.info("Apple Music search completed in %.1fms (%s)", elapsed_ms, counts)
        except Exception:
            pass
        return {"success": True, "results": nrmlsrchrst(raw_results)}
    except TimeoutError as e:
        logger.warning("Apple Music search timeout: %s", e)
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        logger.exception("Error during Apple Music search")
        raise HTTPException(status_code=500, detail=str(e))


# 获取搜索热词推荐列表端点
@router.get("/recommendations")
async def gtrecmdrtr() -> Dict[str, Any]:
    recs = await asyncio.to_thread(gtrecmdtn, 10)
    return {"success": True, "recommendations": recs}


# 上报搜索热词记录端点
@router.post("/recommendations/report")
async def rprtsrchrtr(request: ReportSearchRequest):
    await asyncio.to_thread(rprtsrch, request.keyword)
    return {"success": True}