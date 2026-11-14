# Apple Music与iTunes音乐目录检索、推荐与防抖缓存模块
from backend.head import (
    APIRouter, HTTPException, Query, Request, Response, BaseModel, Field, Optional, List, Dict, Any,
    time, json, re, logging, asyncio, httpx, urlparse, parse_qs,
    APPLE_MUSIC_SEARCH_API_URI, APPLE_MUSIC_AMP_API_URL
)
from backend.services.downloader import manager
from backend.db.database import rprtsrch, gtrecmdtn
from backend.api.common import (
    SEARCH_CATEGORY_KEYS, FAST_SEARCH_TYPES, FAST_SEARCH_LIMIT,
    FAST_SEARCH_TIMEOUT_SECONDS, FAST_SEARCH_DIRECT_TIMEOUT_SECONDS,
    ITUNES_SEARCH_TIMEOUT_SECONDS, SEARCH_CACHE_TTL_SECONDS,
    SEARCH_CACHE_STALE_SECONDS, SEARCH_CACHE_MAX_ENTRIES,
)
from backend.utils.common import itnsarttmpl

# 日志记录器与路由器
logger = logging.getLogger(__name__)
router = APIRouter()

# 内部搜索缓存与并发去重结构
_search_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}
_search_inflight: Dict[str, "asyncio.Task[Dict[str, Any]]"] = {}


# 请求模型定义
class ReportSearchRequest(BaseModel):
    keyword: str = Field(min_length=1, max_length=128)


# 规整化Apple Music搜索响应分类字典
def nrmlsrchrst(raw_payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    source = raw_payload.get("results", raw_payload) if isinstance(raw_payload, dict) else {}
    normalized: Dict[str, Dict[str, Any]] = {}

    for category in SEARCH_CATEGORY_KEYS:
        bucket = source.get(category, {}) if isinstance(source, dict) else {}
        if not isinstance(bucket, dict):
            normalized[category] = {"data": []}
            continue

        data = bucket.get("data", [])
        normalized_bucket: Dict[str, Any] = {"data": data if isinstance(data, list) else []}
        if "href" in bucket:
            normalized_bucket["href"] = bucket["href"]
        if "next" in bucket:
            normalized_bucket["next"] = bucket["next"]
        normalized[category] = normalized_bucket

    if isinstance(source, dict):
        for key, value in source.items():
            if key in normalized:
                continue
            if isinstance(value, dict) and isinstance(value.get("data"), list):
                extra_bucket: Dict[str, Any] = {"data": value["data"]}
                if "href" in value:
                    extra_bucket["href"] = value["href"]
                if "next" in value:
                    extra_bucket["next"] = value["next"]
                normalized[key] = extra_bucket

    return normalized


# 生成搜索缓存键标识
def srchckey(term: str, limit: int) -> str:
    sf = getattr(manager.apple_music_api, "storefront", "") or "cn"
    return f"{sf.lower()}::{term.strip().lower()}::{limit}"


# 清理超期与过载的搜索缓存条目
def prnsrchc(now_ts: float) -> None:
    expired = [
        key for key, (saved_ts, _) in _search_cache.items()
        if now_ts - saved_ts > SEARCH_CACHE_STALE_SECONDS
    ]
    for key in expired:
        _search_cache.pop(key, None)

    if len(_search_cache) <= SEARCH_CACHE_MAX_ENTRIES:
        return

    ordered = sorted(_search_cache.items(), key=lambda item: item[1][0], reverse=True)
    keep = dict(ordered[:SEARCH_CACHE_MAX_ENTRIES])
    _search_cache.clear()
    _search_cache.update(keep)


# 查询命中且有效的内存搜索缓存
def gtcdsrch(term: str, limit: int, allow_stale: bool = False) -> Optional[Dict[str, Any]]:
    key = srchckey(term, limit)
    cached = _search_cache.get(key)
    if not cached:
        return None

    saved_ts, payload = cached
    age = time.time() - saved_ts
    if age <= SEARCH_CACHE_TTL_SECONDS:
        return payload
    if allow_stale and age <= SEARCH_CACHE_STALE_SECONDS:
        return payload

    _search_cache.pop(key, None)
    return None


# 存储搜索结果至内存缓存
def svcdsrch(term: str, limit: int, payload: Dict[str, Any]) -> None:
    now_ts = time.time()
    _search_cache[srchckey(term, limit)] = (now_ts, payload)
    prnsrchc(now_ts)


# 将iTunes歌曲转换为标准搜索条目
def itnssngitm(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    track_id = item.get("trackId")
    if not track_id:
        return None
    return {
        "id": str(track_id),
        "type": "songs",
        "attributes": {
            "name": item.get("trackName") or item.get("trackCensoredName") or "",
            "artistName": item.get("artistName") or "",
            "albumName": item.get("collectionName") or item.get("collectionCensoredName") or "",
            "url": item.get("trackViewUrl") or item.get("collectionViewUrl") or "",
            "artwork": {
                "url": itnsarttmpl(item.get("artworkUrl100") or item.get("artworkUrl60") or ""),
                "width": 100,
                "height": 100,
            },
            "previews": ([{"url": item.get("previewUrl")}] if item.get("previewUrl") else []),
        },
    }


# 将iTunes专辑转换为标准搜索条目
def itnsalbitm(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    collection_id = item.get("collectionId")
    if not collection_id:
        return None
    return {
        "id": str(collection_id),
        "type": "albums",
        "attributes": {
            "name": item.get("collectionName") or item.get("collectionCensoredName") or "",
            "artistName": item.get("artistName") or "",
            "url": item.get("collectionViewUrl") or "",
            "artwork": {
                "url": itnsarttmpl(item.get("artworkUrl100") or item.get("artworkUrl60") or ""),
                "width": 100,
                "height": 100,
            },
        },
    }


# 将iTunes艺人转换为标准搜索条目
def itnsartst(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    artist_id = item.get("artistId")
    if not artist_id:
        return None
    return {
        "id": str(artist_id),
        "type": "artists",
        "attributes": {
            "name": item.get("artistName") or "",
            "artistName": item.get("artistName") or "",
            "url": item.get("artistLinkUrl") or "",
            "artwork": {"url": "", "width": 100, "height": 100},
        },
    }


# 将iTunes音乐视频转换为标准搜索条目
def itnsmvitm(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    track_id = item.get("trackId")
    if not track_id:
        return None
    return {
        "id": str(track_id),
        "type": "music-videos",
        "attributes": {
            "name": item.get("trackName") or item.get("trackCensoredName") or "",
            "artistName": item.get("artistName") or "",
            "url": item.get("trackViewUrl") or "",
            "artwork": {
                "url": itnsarttmpl(item.get("artworkUrl100") or item.get("artworkUrl60") or ""),
                "width": 100,
                "height": 100,
            },
            "previews": ([{"url": item.get("previewUrl")}] if item.get("previewUrl") else []),
        },
    }


# 通过iTunes公开接口进行回退检索
async def srchitnsfb(term: str, limit: int) -> Dict[str, Any]:
    storefront = "cn"
    language = "zh-CN"
    if manager.apple_music_api:
        storefront = manager.apple_music_api.storefront or storefront
        language = manager.apple_music_api.language or language

    entity_specs = {
        "songs": ("song", itnssngitm),
        "albums": ("album", itnsalbitm),
        "artists": ("musicArtist", itnsartst),
        "music-videos": ("musicVideo", itnsmvitm),
    }
    per_entity_limit = max(1, min(limit, 25))

    async with httpx.AsyncClient(timeout=ITUNES_SEARCH_TIMEOUT_SECONDS, follow_redirects=True) as client:
        # 异步拉取iTunes指定实体分类搜索结果
        async def ftchent(entity: str) -> Dict[str, Any]:
            response = await client.get(
                "https://itunes.apple.com/search",
                params={
                    "term": term,
                    "country": storefront,
                    "media": "music",
                    "entity": entity,
                    "limit": per_entity_limit,
                    "lang": language,
                },
            )
            response.raise_for_status()
            payload = response.json()
            return payload if isinstance(payload, dict) else {}

        payloads = await asyncio.gather(
            *(ftchent(entity) for entity, _ in entity_specs.values()),
        )

    results: Dict[str, Dict[str, Any]] = {
        category: {"data": []} for category in SEARCH_CATEGORY_KEYS
    }
    for (category, (_, converter)), payload in zip(entity_specs.items(), payloads):
        converted: List[Dict[str, Any]] = []
        for raw_item in payload.get("results", []) if isinstance(payload, dict) else []:
            if not isinstance(raw_item, dict):
                continue
            item = converter(raw_item)
            if item:
                converted.append(item)
        results[category]["data"] = converted

    return {"results": results}


# 直连Apple Music AMP API进行搜索
async def srchdrct(term: str, limit: int) -> Dict[str, Any]:
    if not manager.apple_music_api:
        raise RuntimeError("Apple Music API is not initialized")

    api = manager.apple_music_api
    uri = APPLE_MUSIC_AMP_API_URL + APPLE_MUSIC_SEARCH_API_URI.format(
        storefront=api.storefront
    )
    params = {
        "term": term,
        "types": FAST_SEARCH_TYPES,
        "limit": limit,
        "offset": 0,
    }
    if getattr(api, "language", None):
        params["l"] = api.language
    headers = dict(api.client.headers)

    async with httpx.AsyncClient(
        timeout=FAST_SEARCH_DIRECT_TIMEOUT_SECONDS,
        headers=headers,
    ) as client:
        response = await client.get(uri, params=params)
        response.raise_for_status()
        payload = response.json()

    if not isinstance(payload, dict):
        raise RuntimeError("Apple Music direct search returned invalid payload")
    if "errors" in payload:
        raise RuntimeError(f"Apple Music API error: {payload['errors']}")
    return payload


# 聚合加速搜索路径带回退降级与缓存
async def srchfast(term: str, limit: int = FAST_SEARCH_LIMIT) -> Dict[str, Any]:
    if not manager.apple_music_api:
        raise RuntimeError("Apple Music API is not initialized")

    safe_limit = max(1, min(limit, 50))
    cached_payload = gtcdsrch(term, safe_limit, allow_stale=False)
    if cached_payload is not None:
        return cached_payload

    cache_key = srchckey(term, safe_limit)
    inflight = _search_inflight.get(cache_key)
    if inflight is not None:
        return await inflight

    # 异步执行综合搜索并写入缓存
    async def _fetch() -> Dict[str, Any]:
        try:
            if getattr(manager.apple_music_api, "_lingo_legacy_wrapper_fallback", False):
                payload = await srchitnsfb(term, safe_limit)
                svcdsrch(term, safe_limit, payload)
                return payload

            try:
                payload = await srchdrct(term, safe_limit)
            except Exception as direct_error:
                logger.warning(
                    "Direct AMP search failed, falling back: %s: %s",
                    type(direct_error).__name__,
                    direct_error,
                )
                if isinstance(direct_error, (httpx.ConnectError, httpx.TimeoutException)):
                    payload = await srchitnsfb(term, safe_limit)
                    if not isinstance(payload, dict):
                        raise RuntimeError("Apple Music search returned invalid payload")
                    svcdsrch(term, safe_limit, payload)
                    return payload
                try:
                    payload = await asyncio.wait_for(
                        manager.apple_music_api.get_search_results(
                            term,
                            types=FAST_SEARCH_TYPES,
                            limit=safe_limit,
                            offset=0,
                        ),
                        timeout=FAST_SEARCH_TIMEOUT_SECONDS,
                    )
                except Exception as gamdl_error:
                    logger.warning(
                        "gamdl Apple Music search failed, falling back to iTunes: %s: %s",
                        type(gamdl_error).__name__,
                        gamdl_error,
                    )
                    payload = await srchitnsfb(term, safe_limit)

            if not isinstance(payload, dict):
                raise RuntimeError("Apple Music search returned invalid payload")
            svcdsrch(term, safe_limit, payload)
            return payload
        except asyncio.TimeoutError as exc:
            raise TimeoutError(
                f"Apple Music search timed out after {FAST_SEARCH_TIMEOUT_SECONDS:.0f}s"
            ) from exc

    task = asyncio.create_task(_fetch())
    _search_inflight[cache_key] = task
    try:
        return await task
    except Exception:
        stale_payload = gtcdsrch(term, safe_limit, allow_stale=True)
        if stale_payload is not None:
            logger.warning("Search upstream failed; serving stale cache for term '%s'", term)
            return stale_payload
        raise
    finally:
        _search_inflight.pop(cache_key, None)


# 解析Apple Music链接类型与实体编号
def prsaplurl(url: str):
    try:
        parsed = urlparse(url)
        if "music.apple.com" not in parsed.netloc:
            return None, None
        qs = parse_qs(parsed.query)
        if "i" in qs:
            return "songs", qs["i"][0]
        path_parts = [p for p in parsed.path.split("/") if p]
        if len(path_parts) >= 2:
            for i, part in enumerate(path_parts):
                if part in ["album", "playlist", "music-video", "artist", "song"]:
                    target_type = part + "s" if part != "music-video" else "music-videos"
                    for candidate in path_parts[i+1:]:
                        if re.match(r'^(pl\.[a-zA-Z0-9\-]+|[0-9]+)$', candidate):
                            return target_type, candidate
        return None, None
    except Exception:
        return None, None


# 响应HEAD预检探测端点
@router.head("/search", include_in_schema=False)
async def srchhd():
    return Response()


# 音乐与媒体目录搜索端点
@router.get("/search")
async def srchaplrtr(request: Request, term: str = Query(..., description="Search term")):
    if not await manager.ensure_initialized():
        raise HTTPException(status_code=500, detail="Downloader not initialized.")

    try:
        item_type, item_id = prsaplurl(term)
        if item_type and item_id:
            results: Dict[str, Any] = {
                "songs": {"data": []},
                "music-videos": {"data": []},
                "albums": {"data": []},
                "artists": {"data": []},
                "playlists": {"data": []},
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
        else:
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


