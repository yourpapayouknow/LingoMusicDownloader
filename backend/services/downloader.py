# 核心下载调度器、多线程队列与音质转码引擎模块
from backend.head import (
    asyncio, copy, os, logging, subprocess, socket, re, shutil,
    MozillaCookieJar, Path, Dict, Any, Optional, List,
    urlparse, urllib, httpx,
    Retry, RetryTransport,
    GamdlApiResponseError,
    AppleMusicApi, ItunesApi,
)

from backend.db.database import inshstry as insert_history, gtallstngs as get_all_settings
from backend.utils.common import (
    itnsarttmpl as _itunes_artwork_template,
    nrmlcdclbl as _normalize_codec_label,
    fndsdcrlrc as _find_sidecar_lrc_path,
)
from backend.services.metadata import (
    APPLE_MUSIC_HOMEPAGE_URL,
    _nrmitlng,
    _rsvsflgs,
    _rsvsflng,
    _rsvtgtln,
)

from backend.core.config import settings

logger = logging.getLogger(__name__)

# 惰性加载gamdl运行时模块（yt-dlp与Lingo子类，首次下载时才导入重型依赖）
_gamdlrt_mod = None


# 惰性获取gamdl运行时模块单例
def gamdlrt():
    global _gamdlrt_mod
    if _gamdlrt_mod is None:
        from backend.services import gamdlrt as _rt
        _gamdlrt_mod = _rt
    return _gamdlrt_mod


SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320 = "lingomusic-transcode-aac-to-mp3-320"
SETTINGS_KEY_TRANSCODE_AAC_TO_MP4 = "lingomusic-transcode-aac-to-mp4"
SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD = "lingomusic-transcode-aac-to-aac-standard"
SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC = "lingomusic-transcode-alac-to-flac"
SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV = "lingomusic-transcode-alac-to-wav"
SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4 = "lingomusic-transcode-alac-to-mp4"
SETTINGS_KEY_METADATA_REGION = "lingomusic-metadata-region"

# 内存中保留的下载任务状态条目上限
DOWNLOAD_STATUS_MAX = 50
# 单次转码命令超时时间（秒）
TRANSCODE_TIMEOUT_SECONDS = 600

# 转码任务规格表：源编码 -> (设置键, 任务规格)
TRANSCODE_JOB_SPECS = {
    "aac": (
        (SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320, {
            "name": "aac->mp3_320k",
            "ext": "mp3",
            "args": ["-c:a", "libmp3lame", "-b:a", "320k"],
        }),
        (SETTINGS_KEY_TRANSCODE_AAC_TO_MP4, {
            "name": "aac->mp4",
            "ext": "mp4",
            "args": ["-c:a", "copy"],
        }),
        (SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD, {
            "name": "aac->aac_standard",
            "ext": "m4a",
            "args": ["-c:a", "aac", "-profile:a", "aac_low", "-b:a", "256k"],
        }),
    ),
    "alac": (
        (SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC, {
            "name": "alac->flac",
            "ext": "flac",
            "args": ["-c:a", "flac"],
        }),
        (SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV, {
            "name": "alac->wav",
            "ext": "wav",
            "args": ["-c:a", "pcm_s24le"],
        }),
        (SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4, {
            "name": "alac->mp4",
            "ext": "mp4",
            "args": ["-c:a", "copy"],
        }),
    ),
}

TRANSCODE_TRUE_VALUES = {"1", "true", "yes", "on"}
APPLE_MUSIC_INDEX_SCRIPT_REGEX = re.compile(
    r"/(assets/index(?:-legacy)?[~-][^/\"']+\.js)"
)
APPLE_MUSIC_JWT_REGEX = re.compile(
    r'"(eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)"'
)
ITUNES_LOOKUP_API_URL = "https://itunes.apple.com/lookup"
LEGACY_WRAPPER_ACCOUNT_URLS = (
    "http://127.0.0.1:30020/",
    "http://127.0.0.1:30020/me",
)
APPLE_STOREFRONT_ID_MAP = {
    "143465": "cn",
    "143441": "us",
    "143470": "tw",
    "143463": "hk",
    "143462": "jp",
    "143466": "kr",
    "143444": "gb",
    "143460": "au",
    "143455": "ca",
    "143464": "sg",
    "143443": "de",
    "143442": "fr",
    "143454": "es",
    "143468": "mx",
    "143450": "it",
    "143452": "nl",
    "143469": "ru",
    "143503": "br",
    "143453": "pt",
    "143467": "in",
    "143476": "id",
    "143475": "th",
    "143471": "vn",
    "143473": "my",
    "143480": "tr",
    "143479": "sa",
    "143481": "ae",
}
# 从Cookies中提取media-user-token
def _ldmtok(cookies_path: str) -> str:
    cookies = MozillaCookieJar(cookies_path)
    cookies.load(ignore_discard=True, ignore_expires=True)

    for cookie in cookies:
        if cookie.name != "media-user-token":
            continue
        domain = (cookie.domain or "").strip().lower()
        if "music.apple.com" in domain:
            return cookie.value

    raise ValueError(
        '"media-user-token" cookie not found in cookies. '
        "Make sure Apple Music web login is complete."
    )


# 抓取Apple Music网页并解析JWT访问令牌
async def _ftatkns() -> List[str]:
    response = None
    async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
        try:
            response = await client.get(APPLE_MUSIC_HOMEPAGE_URL)
            response.raise_for_status()
            home_page = response.text
        except httpx.HTTPError as e:
            raise RuntimeError(
                "Error fetching Apple Music homepage for access token"
            ) from e

        script_matches = APPLE_MUSIC_INDEX_SCRIPT_REGEX.findall(home_page)
        if not script_matches:
            raise RuntimeError(
                "Error finding index.js URI in Apple Music homepage"
            )

        seen_scripts = set()
        script_uris: List[str] = []
        for script_uri in script_matches:
            if script_uri in seen_scripts:
                continue
            seen_scripts.add(script_uri)
            script_uris.append(script_uri)

        script_uris.sort(key=lambda value: ("legacy" in value, value))

        seen_tokens = set()
        tokens: List[str] = []
        for script_uri in script_uris:
            script_response = None
            try:
                script_response = await client.get(
                    f"{APPLE_MUSIC_HOMEPAGE_URL}/{script_uri}"
                )
                script_response.raise_for_status()
                index_js_page = script_response.text
            except httpx.HTTPError as e:
                logger.warning(
                    "Failed to fetch Apple Music script for token discovery: %s | %s",
                    script_uri,
                    e,
                )
                continue

            for token in APPLE_MUSIC_JWT_REGEX.findall(index_js_page):
                if token in seen_tokens:
                    continue
                seen_tokens.add(token)
                tokens.append(token)

            if tokens:
                break

        if not tokens:
            raise RuntimeError("Error finding access token in Apple Music script")

        return tokens


# 从Wrapper地域标识解析Storefront国家代号
def _sfwrpr(value: Any) -> str:
    storefront_id = str(value or "").split(",", 1)[0].split("-", 1)[0].strip()
    return APPLE_STOREFRONT_ID_MAP.get(storefront_id, "cn")


# 构造虚拟激活订阅账户信息字典
def _synacinf(storefront: str) -> Dict[str, Any]:
    return {
        "data": [],
        "meta": {
            "subscription": {
                "active": True,
                "storefront": storefront,
            },
        },
    }


# 从本地Wrapper端口获取账户授权信息
async def _ftwrprac() -> Dict[str, Any]:
    errors: List[str] = []
    async with httpx.AsyncClient(timeout=5, trust_env=False) as client:
        for account_url in LEGACY_WRAPPER_ACCOUNT_URLS:
            try:
                response = await client.get(account_url)
                response.raise_for_status()
                payload = response.json()
            except Exception as e:
                errors.append(f"{account_url}: {e}")
                continue

            if isinstance(payload, dict):
                return payload

            errors.append(f"{account_url}: unexpected payload type {type(payload).__name__}")

    raise RuntimeError("Legacy wrapper account endpoint unavailable: " + " | ".join(errors))


# 从iTunes查询MV媒体元数据
async def _gtmvmeta(
    music_video_id: str,
    storefront: str,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    lang_tag = _nrmitlng(
        language or _rsvsflgs(storefront)
    )
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        response = await client.get(
            ITUNES_LOOKUP_API_URL,
            params={
                "id": music_video_id,
                "country": storefront,
                "lang": lang_tag,
                "entity": "musicVideo",
            },
        )
        response.raise_for_status()
        payload = response.json()

    results = payload.get("results", []) if isinstance(payload, dict) else []
    raw_item = next(
        (
            item
            for item in results
            if isinstance(item, dict)
            and str(item.get("trackId") or "") == str(music_video_id)
            and item.get("kind") == "music-video"
        ),
        None,
    )
    if not raw_item:
        raise RuntimeError(f"iTunes lookup did not return music video metadata for {music_video_id}.")

    artwork_url = _itunes_artwork_template(
        raw_item.get("artworkUrl100") or raw_item.get("artworkUrl60") or ""
    )
    return {
        "data": [
            {
                "id": str(raw_item["trackId"]),
                "type": "music-videos",
                "href": f"/v1/catalog/{storefront}/music-videos/{raw_item['trackId']}",
                "attributes": {
                    "name": raw_item.get("trackCensoredName") or raw_item.get("trackName") or "",
                    "artistName": raw_item.get("artistName") or "",
                    "url": raw_item.get("trackViewUrl") or f"https://music.apple.com/{storefront}/music-video/{raw_item['trackId']}",
                    "artwork": {
                        "url": artwork_url,
                        "width": 100,
                        "height": 100,
                    },
                    "genreNames": [raw_item.get("primaryGenreName")] if raw_item.get("primaryGenreName") else [],
                    "releaseDate": str(raw_item.get("releaseDate") or "").split("T", 1)[0],
                    "playParams": {
                        "id": str(raw_item["trackId"]),
                        "kind": "musicVideo",
                        "catalogId": str(raw_item["trackId"]),
                    },
                    "previews": ([{"url": raw_item.get("previewUrl")}] if raw_item.get("previewUrl") else []),
                },
            }
        ],
        "meta": {"source": "itunes-lookup-fallback"},
    }


# 为AppleMusicApi安装MV元数据iTunes回退补丁
def _inmvfb(api: AppleMusicApi) -> None:
    original_get_music_video = api.get_music_video

    # 优先请求官方MV元数据并在失败时回退至iTunes
    async def _gtmvfb(music_video_id: str):
        try:
            return await original_get_music_video(music_video_id)
        except Exception as e:
            logger.warning(
                "Apple Music MV metadata lookup failed, falling back to iTunes lookup: %s: %s",
                type(e).__name__,
                e,
            )
            return await _gtmvmeta(
                music_video_id,
                api.storefront,
                getattr(api, "language", None),
            )

    api.get_music_video = _gtmvfb


# 为Apple Music API替换支持环境代理与重试的HTTP客户端
async def _cfpxclt(api: AppleMusicApi) -> None:
    try:
        old_client = api.client
        proxy_map = urllib.request.getproxies()
        proxy_url = proxy_map.get("https") or proxy_map.get("http") or proxy_map.get("all")
        transport = httpx.AsyncHTTPTransport(proxy=proxy_url) if proxy_url else httpx.AsyncHTTPTransport()

        retry_transport = RetryTransport(
            transport=transport,
            retry=Retry(
                total=6,
                backoff_factor=1,
                status_forcelist=[429, 500, 502, 503, 504],
            ),
        )
        headers = dict(old_client.headers) if old_client is not None else {}
        if api.media_user_token and "cookie" not in headers:
            headers["cookie"] = f"media-user-token={api.media_user_token}"
        api.client = httpx.AsyncClient(
            headers=headers,
            transport=retry_transport,
            timeout=30.0,
        )
        if old_client is not None and old_client is not api.client:
            try:
                await old_client.aclose()
            except Exception:
                logger.debug("Failed to close previous Apple Music HTTP client", exc_info=True)
    except Exception as e:
        logger.warning("Failed to configure proxy-aware client for AppleMusicApi: %s", e)


# 从本地Legacy Wrapper中继提取令牌构建AppleMusicApi
async def _crtamwrp() -> AppleMusicApi:
    wrapper_account_info = await _ftwrprac()
    auth_info = wrapper_account_info.get("auth") if isinstance(wrapper_account_info.get("auth"), dict) else {}

    media_user_token = (
        wrapper_account_info.get("music_token")
        or auth_info.get("music_user_token")
    )
    dev_token = (
        wrapper_account_info.get("dev_token")
        or auth_info.get("dev_token")
    )
    if not media_user_token or not dev_token:
        raise RuntimeError("Legacy wrapper account info is missing music/dev tokens.")

    storefront = (
        wrapper_account_info.get("storefront")
        or auth_info.get("storefront")
        or _sfwrpr(wrapper_account_info.get("storefront_id"))
    )
    language = await _rsvsflng(
        storefront,
        token=dev_token,
        media_user_token=media_user_token,
    )
    api = await AppleMusicApi.create(
        storefront=storefront,
        language=language,
        token=dev_token,
    )
    api.media_user_token = media_user_token
    api.account_info = _synacinf(api.storefront)
    api._lingo_legacy_wrapper_fallback = True
    api.client.headers.update({"cookie": f"media-user-token={media_user_token}"})
    await _cfpxclt(api)
    _inmvfb(api)
    return api


# 解析歌曲编码枚举
def _rsvsngc(codec: str):
    """
    Keep our frontend-compatible codec values working across gamdl releases.
    3.5 used AAC_LEGACY/AAC_HE_LEGACY while 3.6+ renamed them to AAC_WEB/AAC_HE_WEB.
    """
    requested = (codec or "").strip().lower()
    alias_map = {
        "aac-legacy": ("AAC_LEGACY", "AAC_WEB"),
        "aac-he-legacy": ("AAC_HE_LEGACY", "AAC_HE_WEB"),
        "aac-web": ("AAC_WEB", "AAC_LEGACY"),
        "aac-he-web": ("AAC_HE_WEB", "AAC_HE_LEGACY"),
        "aac": ("AAC",),
        "aac-he": ("AAC_HE",),
        "aac-binaural": ("AAC_BINAURAL",),
        "aac-downmix": ("AAC_DOWNMIX",),
        "aac-he-binaural": ("AAC_HE_BINAURAL",),
        "aac-he-downmix": ("AAC_HE_DOWNMIX",),
        "alac": ("ALAC",),
        "atmos": ("ATMOS",),
        "dolby": ("ATMOS",),
        "ac3": ("AC3",),
        "ac-3": ("AC3",),
        "ask": ("ASK",),
    }

    SongCodec = gamdlrt().SongCodec
    for attr_name in alias_map.get(requested, (requested.upper().replace("-", "_"),)):
        codec_enum = getattr(SongCodec, attr_name, None)
        if codec_enum is not None:
            return codec_enum

    for fallback_name in ("AAC_WEB", "AAC_LEGACY", "AAC"):
        codec_enum = getattr(SongCodec, fallback_name, None)
        if codec_enum is not None:
            return codec_enum

    raise ValueError(f"Unsupported SongCodec mapping for: {codec}")


# 判断设置项是否处于开启状态
def _stgenb(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in TRANSCODE_TRUE_VALUES
    return False


# 定位可用的FFmpeg可执行文件路径
def _rsvffmp() -> str:
    configured = settings.ffmpgpth()
    if configured and os.path.exists(configured):
        return configured

    fallback = shutil.which("ffmpeg")
    if fallback:
        return fallback

    raise FileNotFoundError(f"ffmpeg not found. Configured path: {configured}")


# 定位可用的FFprobe可执行文件路径
def _rsvffpr(ffmpeg_path: str) -> Optional[str]:
    ffmpeg_obj = Path(ffmpeg_path)
    sibling = ffmpeg_obj.with_name("ffprobe.exe" if os.name == "nt" else "ffprobe")
    if sibling.exists():
        return str(sibling)

    bin_candidate = Path(settings.bindir()) / ("ffprobe.exe" if os.name == "nt" else "ffprobe")
    if bin_candidate.exists():
        return str(bin_candidate)

    return shutil.which("ffprobe")


# 探测音频源文件真实编码格式
def _dtsrccdc(file_path: str, preferred_codec: str, ffprobe_path: Optional[str]) -> str:
    normalized_preferred = _normalize_codec_label(preferred_codec)

    if ffprobe_path:
        try:
            probe = subprocess.run(
                [
                    ffprobe_path,
                    "-v", "error",
                    "-select_streams", "a:0",
                    "-show_entries", "stream=codec_name",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    file_path,
                ],
                capture_output=True,
                text=True,
                check=False,
                timeout=10,
            )
            codec_name = (probe.stdout or "").strip()
            if probe.returncode == 0 and codec_name:
                detected = _normalize_codec_label(codec_name)
                if detected in {"aac", "alac"}:
                    return detected
        except Exception as e:
            logger.warning("Failed to probe codec via ffprobe: %s | file=%s", e, file_path)

    return normalized_preferred


# 根据当前配置构建音频转码任务列表
def _bldtrjb(source_codec: str, all_settings: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        dict(spec) for key, spec in TRANSCODE_JOB_SPECS.get(source_codec, ())
        if _stgenb(all_settings.get(key))
    ]


# 判断当前是否启用了任何音质转码任务
def _hastrenb(all_settings: Dict[str, Any]) -> bool:
    return any(
        _stgenb(all_settings.get(key))
        for specs in TRANSCODE_JOB_SPECS.values()
        for key, _ in specs
    )


# 构造转码产物在目标目录的绝对路径
def _bldcvop(source_file_path: str, ext: str) -> Path:
    source_path = Path(source_file_path).resolve()
    download_root = Path(settings.outpth()).resolve()
    converted_root = Path(settings.cnvtpth()).resolve()

    try:
        relative_parent = source_path.parent.relative_to(download_root)
        target_dir = converted_root / relative_parent
    except Exception:
        target_dir = converted_root / source_path.parent.name

    target_dir.mkdir(parents=True, exist_ok=True)
    normalized_ext = ext[1:] if ext.startswith(".") else ext
    return target_dir / f"{source_path.stem}.{normalized_ext}"


# 检测WSL端口是否处于监听连接就绪状态
def _wslprdy(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex(('127.0.0.1', port)) == 0


# 检查WSL Wrapper解密端口是否可用（由Wrapper服务负责启动）
async def _enswslbr() -> bool:
    ready = await asyncio.to_thread(_wslprdy, 10020)
    if not ready:
        logger.warning("WSL decrypt port 10020 is not ready; Wrapper-based downloads may fail.")
    return ready



# 安全读取对象属性
def _sftatr(obj: Any, attr_name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


# 安全读取字典键值
def _sftmapg(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return default


# 从媒体下载产物解析并构造元数据记录
def _extmdmt(item: Any, source_url: str) -> Dict[str, Any]:
    media = _sftatr(item, "media")
    tags = _sftatr(media, "tags")
    media_dict = media if isinstance(media, dict) else {}

    if media_dict:
        attributes = _sftmapg(media_dict, "attributes", {})
    else:
        attributes = _sftatr(media, "attributes", {})
    if not isinstance(attributes, dict):
        attributes = {}

    play_params = attributes.get("playParams", {})
    if not isinstance(play_params, dict):
        play_params = {}

    track_id = (
        _sftatr(media, "media_id")
        or _sftatr(media, "id")
        or _sftmapg(media_dict, "media_id")
        or _sftmapg(media_dict, "id")
        or _sftmapg(play_params, "id")
    )
    if track_id is None or str(track_id).strip() == "":
        parsed_url = urlparse(source_url)
        query_id = (parse_qs(parsed_url.query).get("i") or [""])[0]
        path_parts = [part for part in parsed_url.path.split("/") if part]
        track_id = query_id or (path_parts[-1] if path_parts else "")
    track_id = str(track_id)

    title = (
        _sftatr(tags, "title")
        or _sftatr(media, "title")
        or _sftatr(media, "name")
        or attributes.get("name")
        or "Unknown Title"
    )
    artist_name = (
        _sftatr(tags, "artist")
        or _sftatr(media, "artist")
        or _sftatr(media, "artist_name")
        or attributes.get("artistName")
        or "Unknown Artist"
    )
    album_name = (
        _sftatr(tags, "album")
        or _sftatr(media, "album")
        or _sftatr(media, "album_name")
        or attributes.get("albumName")
        or "Unknown Album"
    )

    cover = _sftatr(media, "cover")
    cover_url = _sftatr(cover, "url")
    if not cover_url:
        cover_url = _sftmapg(cover, "url")

    artwork = attributes.get("artwork", {})
    if not isinstance(artwork, dict):
        artwork = {}

    artwork_url = cover_url or artwork.get("url", "")

    file_path = _sftatr(item, "final_path") or ""
    file_size = os.path.getsize(file_path) if file_path and os.path.exists(file_path) else 0
    lyrics_path = _find_sidecar_lrc_path(file_path) if file_path else ""

    return {
        "track_id": track_id,
        "name": title,
        "artist_name": artist_name,
        "album_name": album_name,
        "artwork_url": artwork_url,
        "file_path": file_path,
        "lyrics_path": lyrics_path,
        "file_size": file_size,
    }

# 管理Apple Music后台异步下载调度与格式后处理
class DownloadManager:
    # 初始化下载管理器状态与任务容器
    def __init__(self):
        self.apple_music_api = None
        self.download_queue = []
        self.download_status: Dict[str, Any] = {}
        self.is_initialized = False
        # Strong references to running tasks.
        # asyncio only keeps *weak* refs; without this the GC destroys
        # pending tasks mid-run and causes 'aclose() already running'.
        self._tasks: set = set()
        self._init_lock = asyncio.Lock()

    # 幂等懒初始化：首个业务请求触发，避免启动期网络抓取
    async def ensinit(self) -> bool:
        if self.is_initialized:
            return True
        async with self._init_lock:
            if self.is_initialized:
                return True
            return await self._intlz()

    # 初始化Apple Music下载引擎及鉴权客户端（调用方需持有初始化锁）
    async def _intlz(self):
        if not os.path.exists(settings.ckspth()):
            logger.error(f"Cookies file not found at {settings.ckspth()}")
            return False

        self.apple_music_api = None
        self.is_initialized = False

        # Ensure WSL Bridge is up
        await _enswslbr()

        try:
            media_user_token = _ldmtok(settings.ckspth())
            candidate_tokens = await _ftatkns()

            init_errors: List[str] = []
            for access_token in candidate_tokens:
                try:
                    self.apple_music_api = await AppleMusicApi.create(
                        media_user_token=media_user_token,
                        token=access_token,
                    )
                    await _cfpxclt(self.apple_music_api)
                    if not self.apple_music_api.active_subscription:
                        init_errors.append("No active Apple Music subscription found.")
                        self.apple_music_api = None
                        continue

                    # 依据账户所属Storefront自动设定对应的本地化元数据语言
                    self.apple_music_api.language = await _rsvsflng(
                        self.apple_music_api.storefront,
                        token=self.apple_music_api.token,
                        media_user_token=self.apple_music_api.media_user_token,
                    )
                    self.is_initialized = True
                    return True
                except Exception as token_error:
                    init_errors.append(str(token_error))
                    self.apple_music_api = None

            try:
                self.apple_music_api = await _crtamwrp()
                if self.apple_music_api.active_subscription:
                    logger.warning(
                        "Initialized Apple Music API via legacy wrapper fallback. "
                        "Apple account subscription probe was unavailable; continuing with wrapper tokens."
                    )
                    self.is_initialized = True
                    return True
                init_errors.append("Wrapper account has no active Apple Music subscription.")
                self.apple_music_api = None
            except Exception as wrapper_error:
                init_errors.append(f"Wrapper fallback failed: {wrapper_error}")
                self.apple_music_api = None

            logger.error(
                "Failed to initialize Gamdl downloader: %s",
                " | ".join(init_errors[:3]) if init_errors else "Unknown initialization error",
            )
            return False
        except Exception as e:
            logger.error(f"Failed to initialize Gamdl downloader: {e}")
            return False

    # 解析元数据地区并构造本地化API副本
    async def _mdctx(self, metadata_region: Optional[str]):
        all_settings = await asyncio.to_thread(get_all_settings)
        requested_region = (
            metadata_region
            if metadata_region is not None
            else all_settings.get(SETTINGS_KEY_METADATA_REGION, "auto")
        )
        account_sf = (getattr(self.apple_music_api, "storefront", "") or "cn").lower()
        target_sf, target_lang = await _rsvtgtln(
            account_sf,
            requested_region,
            token=getattr(self.apple_music_api, "token", None),
            media_user_token=getattr(self.apple_music_api, "media_user_token", None),
        )

        # 克隆共享API实例以在不干扰账号播放区域的前提下切换元数据语言
        localized_api = copy.copy(self.apple_music_api)
        localized_api.language = target_lang
        return account_sf, target_sf, target_lang, localized_api

    # 创建账号地区与目标地区的iTunes客户端并登记清理列表
    async def _itnapi(
        self,
        account_sf: str,
        target_sf: str,
        target_lang: str,
        cleanup_clients: List[Any],
    ):
        account_itunes_api = await ItunesApi.create(
            storefront=account_sf,
            language=target_lang,
            **({"storefront_id": None} if account_sf != "us" else {}),
        )
        cleanup_clients.append(account_itunes_api.client)

        metadata_itunes_api: Optional[ItunesApi] = None
        if target_sf != account_sf:
            try:
                metadata_itunes_api = await ItunesApi.create(
                    storefront=target_sf,
                    language=target_lang,
                    **({"storefront_id": None} if target_sf != "us" else {}),
                )
                cleanup_clients.append(metadata_itunes_api.client)
            except Exception as e:
                logger.warning("Failed to create target iTunes API (%s): %s", target_sf, e)
        return account_itunes_api, metadata_itunes_api

    # 装配歌曲、MV与上传视频接口
    async def _ifaces(
        self,
        rt,
        localized_api,
        account_itunes_api,
        metadata_itunes_api,
        target_sf: str,
        target_lang: str,
        codec: str,
        video_resolution: str,
        use_wrapper: bool,
    ):
        rt_ifaces = rt
        base_interface = await rt_ifaces.AppleMusicBaseInterface.create(
            apple_music_api=localized_api,
            itunes_api=account_itunes_api,
            use_wrapper=use_wrapper,
        )

        try:
            song_codec_enum = _rsvsngc(codec)
        except ValueError:
            song_codec_enum = _rsvsngc("aac-legacy")

        try:
            video_res_enum = rt_ifaces.MusicVideoResolution(video_resolution)
        except ValueError:
            video_res_enum = rt_ifaces.MusicVideoResolution.R1080P

        song_interface = rt_ifaces.LingoAppleMusicSongInterface(
            base=base_interface,
            codec_priority=[song_codec_enum],
            metadata_storefront=target_sf,
            metadata_language=target_lang,
        )
        music_video_interface = rt_ifaces.LingoAppleMusicMusicVideoInterface(
            base=base_interface,
            resolution=video_res_enum,
            metadata_storefront=target_sf,
            metadata_language=target_lang,
            metadata_itunes_api=metadata_itunes_api,
        )
        uploaded_video_interface = rt_ifaces.AppleMusicUploadedVideoInterface(
            base=base_interface,
        )
        return rt_ifaces.AppleMusicInterface(
            song=song_interface,
            music_video=music_video_interface,
            uploaded_video=uploaded_video_interface,
        )

    # 组装gamdl下载器与各媒体下载子组件
    def _asmdl(self, rt, interface):
        nm3u8_binary = shutil.which("N_m3u8DL-RE") or shutil.which("N_m3u8DL-RE.exe")
        download_mode = rt.DownloadMode.NM3U8DLRE if nm3u8_binary else rt.DownloadMode.YTDLP

        base_downloader = rt.LingoAppleMusicBaseDownloader(
            interface=interface,
            output_path=settings.outpth(),
            nm3u8dlre_path=nm3u8_binary or "N_m3u8DL-RE",
            mp4decrypt_path=settings.mp4dcrpth(),
            ffmpeg_path=settings.ffmpgpth(),
            download_mode=download_mode,
        )

        return rt.AppleMusicDownloader(
            song=rt.AppleMusicSongDownloader(base=base_downloader),
            music_video=rt.AppleMusicMusicVideoDownloader(base=base_downloader),
            uploaded_video=rt.AppleMusicUploadedVideoDownloader(base=base_downloader),
        )

    # 根据格式、设备环境与元数据地区配置构建下载器实例
    async def _crtdl(
        self,
        codec: str,
        video_resolution: str,
        use_wrapper: bool,
        metadata_region: Optional[str] = None,
    ):
        cleanup_clients: List[Any] = []
        try:
            account_sf, target_sf, target_lang, localized_api = await self._mdctx(metadata_region)
            account_itunes_api, metadata_itunes_api = await self._itnapi(
                account_sf, target_sf, target_lang, cleanup_clients
            )
            rt = gamdlrt()
            interface = await self._ifaces(
                rt,
                localized_api,
                account_itunes_api,
                metadata_itunes_api,
                target_sf,
                target_lang,
                codec,
                video_resolution,
                use_wrapper,
            )
            downloader = self._asmdl(rt, interface)
            downloader._lingo_cleanup_clients = cleanup_clients
            return downloader
        except Exception:
            for client in cleanup_clients:
                try:
                    await client.aclose()
                except Exception:
                    pass
            raise

    # 将指定URL加入后台异步下载任务队列
    async def adque(
        self,
        url: str,
        codec: str = "aac-legacy",
        video_resolution: str = "1080p",
        use_wrapper: bool = False,
        metadata_region: Optional[str] = None,
    ) -> bool:
        if not self.is_initialized:
            logger.error("Downloader not initialized. Please check cookies.txt")
            return False

        existing = self.download_status.get(url)
        if existing and existing.get("status") in {"pending", "processing", "downloading"}:
            logger.warning("Duplicate in-flight download rejected: %s", url)
            return False

        self.download_status[url] = {
            "status": "pending",
            "items": [],
            "codec": _normalize_codec_label(codec),
            "resolution": video_resolution
        }

        try:
            downloader = await self._crtdl(
                codec,
                video_resolution,
                use_wrapper,
                metadata_region=metadata_region,
            )
        except Exception as e:
            logger.exception("Failed to create downloader for %s", url)
            self.download_status[url]["status"] = "error"
            self.download_status[url]["error"] = str(e)
            return False

        task = asyncio.create_task(self._prcurl(downloader, url))
        # Keep a strong reference so GC cannot destroy the task before it finishes.
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return True

    # 预检URL并收集可下载队列与预检错误项
    async def _prefl(self, downloader, url: str):
        rt = gamdlrt()
        download_queue: List[Dict[str, Any]] = []
        preflight_error_items: List[Dict[str, Any]] = []

        async for item in downloader.get_download_item_from_url(url):
            if item.media.error:
                error_obj = item.media.error
                error_message = str(error_obj) or "Unknown media resolution error"
                logger.warning("Skip unresolved media item from interface: %s", error_message)

                if isinstance(error_obj, rt.GamdlInterfaceFormatNotAvailableError):
                    hint = "该曲目不提供当前音质，已跳过并继续下载其他曲目。"
                elif isinstance(error_obj, GamdlApiResponseError):
                    hint = _apihint(error_obj.status_code)
                else:
                    hint = "该曲目解析失败，已跳过并继续下载其他曲目。"

                error_meta = _extmdmt(item, url)
                error_item = {
                    "status": "error",
                    "track_id": error_meta["track_id"],
                    "name": error_meta["name"],
                    "artist_name": error_meta["artist_name"],
                    "album_name": error_meta["album_name"],
                    "artwork_url": error_meta["artwork_url"],
                    "file_path": "",
                    "error": error_message,
                    "hint": hint,
                }
                preflight_error_items.append(error_item)
                self.download_status[url]["items"].append(error_item)
                continue

            if item.final_path is None or item.media.partial:
                continue
            meta = _extmdmt(item, url)
            self.download_status[url]["items"].append({
                "status": "pending",
                "track_id": meta["track_id"],
                "name": meta["name"],
            })
            status_index = len(self.download_status[url]["items"]) - 1
            download_queue.append({
                "item": item,
                "status_index": status_index,
            })

        return download_queue, preflight_error_items

    # 设置单条下载项错误状态
    def _setierr(self, url: str, index: int, message: str, hint: Optional[str] = None) -> None:
        item = self.download_status[url]["items"][index]
        item["status"] = "error"
        item["error"] = message
        if hint:
            item["hint"] = hint

    # 下载单条队列项并更新状态
    async def _dnlitm(self, downloader, url: str, queued: Dict[str, Any]) -> None:
        rt = gamdlrt()
        item = queued["item"]
        index = queued["status_index"]
        if index >= len(self.download_status[url]["items"]):
            logger.error("Download item index out of range: %s", index)
            return
        self.download_status[url]["items"][index]["status"] = "downloading"
        try:
            await downloader.download(item)
            metadata = _extmdmt(item, url)
            self._mrkcmp(url, index, metadata)
            self._inshst(url, metadata)
            await asyncio.to_thread(self._runtrscs, url, metadata)
        except rt.GamdlDownloaderMediaFileExistsError as e:
            metadata = _extmdmt(item, url)
            self._mrkcmp(url, index, metadata)
            self.download_status[url]["items"][index]["hint"] = "本地文件已存在，跳过重复下载并已写入历史记录"
            self.download_status[url]["items"][index]["already_exists"] = True
            logger.info("Skip existing media file: %s", e)
            self._inshst(url, metadata)
            await asyncio.to_thread(self._runtrscs, url, metadata)
        except GamdlApiResponseError as e:
            detail = f"{e.message}"
            if e.status_code:
                detail += f" [HTTP {e.status_code}]"
            if e.content:
                detail += f" | Response: {str(e.content)[:300]}"
            logger.error("Apple Music API error: %s", detail)
            self._setierr(url, index, detail, _apihint(e.status_code))
        except rt.GamdlInterfaceDecryptionNotAvailableError:
            msg = (
                "Decryption not available. Wrapper may be expired or not fully ready. "
                "Please restart Wrapper and re-login, then retry."
            )
            logger.error(msg)
            self._setierr(url, index, msg)
        except rt.GamdlInterfaceFormatNotAvailableError:
            msg = "Format/codec not available for this track (try a different codec)."
            logger.error(msg)
            self._setierr(url, index, msg)
        except Exception as e:
            logger.error("Error downloading item: %s", e, exc_info=True)
            self._setierr(url, index, str(e))

    # 汇总任务终态并处理部分成功
    def _aggtsk(self, url: str) -> None:
        items = self.download_status[url]["items"]
        for child in items:
            if child.get("status") in {"pending", "downloading"}:
                child["status"] = "error"
                if not child.get("error"):
                    child["error"] = "Download did not finish for this item."

        completed_count = sum(1 for child in items if child.get("status") == "completed")
        error_count = sum(1 for child in items if child.get("status") == "error")
        if completed_count > 0:
            self.download_status[url]["status"] = "completed"
            if error_count > 0:
                self.download_status[url]["warning"] = f"{error_count} track(s) skipped or failed."
                for child in items:
                    if child.get("status") == "error" and child.get("error"):
                        self.download_status[url]["error"] = child.get("error")
                        break
        elif error_count > 0:
            self.download_status[url]["status"] = "error"
            for child in items:
                if child.get("status") == "error" and child.get("error"):
                    self.download_status[url]["error"] = child.get("error")
                    break
        else:
            self.download_status[url]["status"] = "completed"

    # 驱动单任务解析与分步执行下载流程
    async def _prcurl(self, downloader, url: str):
        try:
            self.download_status[url]["status"] = "processing"
            download_queue, preflight_error_items = await self._prefl(downloader, url)

            if not download_queue:
                if preflight_error_items:
                    self.download_status[url]["status"] = "error"
                    self.download_status[url]["error"] = preflight_error_items[0].get("error") or "No downloadable tracks found."
                    return
                raise ValueError("No downloadable tracks/videos found. The URL might be invalid or restricted.")

            self.download_status[url]["status"] = "downloading"
            for queued in download_queue:
                await self._dnlitm(downloader, url, queued)

            self._aggtsk(url)
        except Exception as e:
            logger.error("Error processing url %s: %s", url, e, exc_info=True)
            self.download_status[url]["status"] = "error"
            self.download_status[url]["error"] = str(e)
        finally:
            self._finalprcstts(url)
            for client in getattr(downloader, "_lingo_cleanup_clients", []) or []:
                try:
                    await client.aclose()
                except Exception:
                    pass

    # 裁剪内存状态字典，仅保留最近任务
    def _finalprcstts(self, url: str) -> None:
        task = self.download_status.get(url)
        if not task:
            return

        # 内存只保留最近DOWNLOAD_STATUS_MAX条任务，防止单会话无限累积
        try:
            if len(self.download_status) > DOWNLOAD_STATUS_MAX:
                stale = [
                    key for key, value in self.download_status.items()
                    if value.get("status") in {"completed", "error"}
                ][: len(self.download_status) - DOWNLOAD_STATUS_MAX]
                for key in stale:
                    del self.download_status[key]
        except Exception as e:
            logger.error("Failed to prune download_status: %s", e)

    # 更新单曲下载状态并标记完成
    def _mrkcmp(self, url: str, index: int, metadata: Dict[str, Any]) -> None:
        self.download_status[url]["items"][index].update({
            "status": "completed",
            "track_id": metadata["track_id"],
            "name": metadata["name"],
            "artist_name": metadata["artist_name"],
            "album_name": metadata["album_name"],
            "artwork_url": metadata["artwork_url"],
            "file_path": metadata["file_path"],
            "lyrics_path": metadata.get("lyrics_path", ""),
            "file_size": metadata["file_size"],
        })
        if metadata["file_path"]:
            # Expose at task-level for frontend folder-open shortcut.
            self.download_status[url]["file_path"] = metadata["file_path"]

    # 安全记录单曲下载历史到本地SQLite
    def _inshst(self, url: str, metadata: Dict[str, Any]) -> None:
        try:
            history_data = {
                "track_id": metadata["track_id"],
                "name": metadata["name"],
                "artist_name": metadata["artist_name"],
                "album_name": metadata["album_name"],
                "artwork_url": metadata["artwork_url"],
                "codec": self.download_status[url]["codec"],
                "file_path": metadata["file_path"],
                "lyrics_path": metadata.get("lyrics_path", ""),
                "file_size": metadata["file_size"]
            }
            insert_history(history_data)
        except Exception as e:
            logger.error(f"Failed to insert download history: {e}")

    # 安全捕获异常并执行转码管道
    def _runtrscs(self, url: str, metadata: Dict[str, Any]) -> None:
        try:
            self._runtrsc(url, metadata)
        except Exception as e:
            logger.error("Failed to run transcode pipeline: %s", e, exc_info=True)

    # 执行本地音频格式转码后处理管道
    def _runtrsc(self, url: str, metadata: Dict[str, Any]) -> None:
        source_path = str(metadata.get("file_path") or "").strip()
        if not source_path or not os.path.exists(source_path):
            return

        all_settings = get_all_settings()
        if not _hastrenb(all_settings):
            return

        preferred_codec = self.download_status.get(url, {}).get("codec", "")
        ffmpeg_path = _rsvffmp()
        ffprobe_path = _rsvffpr(ffmpeg_path)
        source_codec = _dtsrccdc(source_path, preferred_codec, ffprobe_path)

        jobs = _bldtrjb(source_codec, all_settings)
        if not jobs:
            return

        for job in jobs:
            output_path = _bldcvop(source_path, job["ext"])
            ffmpeg_cmd = [
                ffmpeg_path,
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                source_path,
                "-map",
                "0:a:0",
                "-map_metadata",
                "0",
                "-vn",
                *job["args"],
                str(output_path),
            ]
            try:
                proc = subprocess.run(
                    ffmpeg_cmd,
                    capture_output=True,
                    text=True,
                    check=False,
                    timeout=TRANSCODE_TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                logger.error(
                    "Transcode timed out (%s): %s",
                    job["name"],
                    source_path,
                )
                continue
            if proc.returncode != 0:
                logger.error(
                    "Transcode failed (%s): %s | stderr=%s",
                    job["name"],
                    source_path,
                    (proc.stderr or "").strip()[:500],
                )
                continue
            logger.info("Transcode completed (%s): %s -> %s", job["name"], source_path, output_path)


# 映射HTTP状态码为友好排查提示文本
def _apihint(status_code: Optional[int]) -> str:
    """Return a user-friendly hint based on the HTTP status code."""
    if status_code is None:
        return ("Could not reach the Apple Music API. "
                "If using Wrapper, verify it is running (ports 10020 & 20020).")
    if status_code in (401, 403):
        return "Cookies may be expired. Re-export Apple Music cookies and update cookies.txt."
    if status_code == 404:
        return "Track not found or not available in your region."
    if status_code == 429:
        return "Rate limited by Apple Music. Wait a moment and try again."
    return f"Unexpected HTTP {status_code} from Apple Music API."


manager = DownloadManager()
