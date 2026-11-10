# 核心下载调度器、多线程队列与音质转码引擎模块
from backend.head import (
    asyncio, copy, os, json, logging, subprocess, socket, re, shutil, tempfile,
    unicodedata, MozillaCookieJar, Path, Dict, Any, Optional, List,
    urljoin, urlparse, urlunparse, UrlRequest as Request, urlopen, httpx,
    Retry, RetryTransport,
    APPLE_MUSIC_AMP_API_URL, GamdlApiResponseError,
    AppleMusicApi, ItunesApi,
)

from backend.db.database import inshstry as insert_history, gtallstngs as get_all_settings, insdwnldtsk as insert_download_task
from backend.api.common import (
    itnsarttmpl as _itunes_artwork_template,
    nrmlcdclbl as _normalize_codec_label,
    fnmkey as _filename_key,
    strptrkprfx as _strip_track_prefix,
    fndsdcrlrc as _find_sidecar_lrc_path,
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

TRANSCODE_TRUE_VALUES = {"1", "true", "yes", "on"}
# HLS 分片的 codecs 字段用 MP4A 对象类型标识，音频资产元数据用简写标识
AUDIO_FORMAT_ID_BY_CODEC = {
    "mp4a.40.2": "aac",
    "mp4a.40.5": "aach",
}
APPLE_MUSIC_HOMEPAGE_URL = "https://music.apple.com"
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
APPLE_STOREFRONT_LANGUAGE_MAP = {
    "cn": "zh-CN",
    "tw": "zh-TW",
    "hk": "zh-HK",
    "mo": "zh-HK",
    "jp": "ja-JP",
    "kr": "ko-KR",
    "us": "en-US",
    "gb": "en-GB",
    "uk": "en-GB",
    "au": "en-AU",
    "ca": "en-CA",
    "sg": "en-GB",
    "in": "en-GB",
    "ph": "en-US",
    "de": "de-DE",
    "fr": "fr-FR",
    "es": "es-ES",
    "mx": "es-MX",
    "it": "it-IT",
    "nl": "nl-NL",
    "ru": "ru-RU",
    "br": "pt-BR",
    "pt": "pt-PT",
    "id": "id-ID",
    "th": "th-TH",
    "vn": "vi-VN",
    "my": "ms-MY",
    "tr": "tr-TR",
    "sa": "ar-SA",
    "ae": "ar-AE",
}
CJK_PREFERRED_STOREFRONTS = {"cn", "tw", "hk", "mo", "jp", "kr"}
GENERIC_GENRE_NAMES = {"music", "音乐", "音樂", "ミュージック", "음악"}


# 将BCP-47语言标签规整为Apple Music与iTunes兼容格式
def _normalize_itunes_language_tag(tag: Optional[str]) -> str:
    raw = (tag or "").strip().replace("_", "-")
    if not raw:
        return "en-US"
    lower = raw.lower()
    if lower.startswith("zh-hans") or lower in {"zh", "zh-cn"}:
        return "zh-CN"
    if lower.startswith("zh-hant-hk") or lower == "zh-hk":
        return "zh-HK"
    if lower.startswith("zh-hant") or lower == "zh-tw":
        return "zh-TW"
    if lower == "ja":
        return "ja-JP"
    if lower == "ko":
        return "ko-KR"
    if lower in {"en-in", "en-sg"}:
        return "en-GB"
    return raw


# 按Storefront代号同步解析默认元数据语言
def _resolve_storefront_language_sync(storefront: Optional[str]) -> str:
    sf = (storefront or "").strip().lower()
    return APPLE_STOREFRONT_LANGUAGE_MAP.get(sf, "en-US")


# 异步探测并确定账户Storefront对应的元数据语言
async def _resolve_storefront_language(
    storefront: Optional[str],
    token: Optional[str] = None,
    media_user_token: Optional[str] = None,
) -> str:
    sf = (storefront or "").strip().lower()
    if not sf:
        return "en-US"
    if sf in APPLE_STOREFRONT_LANGUAGE_MAP:
        return APPLE_STOREFRONT_LANGUAGE_MAP[sf]

    if token:
        headers = {
            "authorization": f"Bearer {token}",
            "origin": APPLE_MUSIC_HOMEPAGE_URL,
        }
        if media_user_token:
            headers["cookie"] = f"media-user-token={media_user_token}"
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                resp = await client.get(
                    f"{APPLE_MUSIC_AMP_API_URL}/v1/storefronts/{sf}",
                    headers=headers,
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    if data and isinstance(data[0], dict):
                        default_lang = data[0].get("attributes", {}).get("defaultLanguageTag")
                        if default_lang:
                            return _normalize_itunes_language_tag(default_lang)
        except Exception as e:
            logger.debug("Storefront language lookup failed for %s: %s", sf, e)

    return _resolve_storefront_language_sync(sf)


# 解析最终生效的元数据区域与语言标签
async def _resolve_target_metadata_region_and_language(
    account_storefront: Optional[str],
    requested_region: Optional[str],
    token: Optional[str] = None,
    media_user_token: Optional[str] = None,
) -> tuple[str, str]:
    raw_region = (requested_region or "").strip().lower()
    base_sf = (account_storefront or "cn").strip().lower() or "cn"
    target_sf = base_sf if (not raw_region or raw_region == "auto") else raw_region
    target_lang = await _resolve_storefront_language(
        target_sf,
        token=token,
        media_user_token=media_user_token,
    )
    return target_sf, target_lang


# 拉取指定Storefront区域下的目录媒体元数据
async def _fetch_catalog_metadata_for_storefront(
    apple_music_api: Any,
    media_type: str,
    media_id: str,
    target_storefront: str,
    target_language: str,
) -> Optional[Dict[str, Any]]:
    if not apple_music_api or not media_id or not target_storefront:
        return None
    try:
        payload = await apple_music_api._amp_request(
            f"/v1/catalog/{target_storefront}/{media_type}/{media_id}",
            {"l": target_language},
        )
        data = payload.get("data", []) if isinstance(payload, dict) else []
        if data and isinstance(data[0], dict):
            return data[0]
    except Exception as e:
        logger.debug(
            "Target storefront catalog lookup skipped (%s/%s/%s): %s",
            target_storefront,
            media_type,
            media_id,
            e,
        )
    return None


# 从目录属性提取首选非泛化流派名称
def _pick_catalog_genre(genre_names: Any) -> Optional[str]:
    if not isinstance(genre_names, list):
        return None
    cleaned = [str(g).strip() for g in genre_names if isinstance(g, str) and g.strip()]
    for g in cleaned:
        if g.lower() not in GENERIC_GENRE_NAMES:
            return g
    return cleaned[0] if cleaned else None


# 判断流媒体标签是否应替换为目标区域目录本地化文本
def _should_use_catalog_text(
    tag_value: Optional[str],
    catalog_value: Optional[str],
    storefront: Optional[str],
) -> bool:
    cat_text = (catalog_value or "").strip()
    if not cat_text:
        return False
    cur_text = (tag_value or "").strip()
    if not cur_text:
        return True
    if cur_text == cat_text:
        return False
    sf = (storefront or "").strip().lower()
    if sf in CJK_PREFERRED_STOREFRONTS:
        if cur_text.isascii() and not cat_text.isascii():
            return True
        if sf in {"cn", "tw", "hk", "mo"} and not cat_text.isascii():
            return True
    elif sf:
        if not cur_text.isascii() and cat_text.isascii():
            return True
    return False


# 仅填补缺失或为空的元数据标签字段
def _fill_missing_tags_from_catalog(
    tags: Any,
    media_metadata: Optional[Dict[str, Any]],
) -> None:
    if tags is None or not isinstance(media_metadata, dict):
        return
    attrs = media_metadata.get("attributes")
    if not isinstance(attrs, dict):
        return
    if not (getattr(tags, "title", None) or "").strip() and attrs.get("name"):
        tags.title = attrs["name"]
    if not (getattr(tags, "artist", None) or "").strip() and attrs.get("artistName"):
        tags.artist = attrs["artistName"]
    if not (getattr(tags, "album", None) or "").strip() and attrs.get("albumName"):
        tags.album = attrs["albumName"]
    if not (getattr(tags, "album_artist", None) or "").strip() and attrs.get("albumArtistName"):
        tags.album_artist = attrs["albumArtistName"]
    if not (getattr(tags, "genre", None) or "").strip():
        cat_genre = _pick_catalog_genre(attrs.get("genreNames"))
        if cat_genre:
            tags.genre = cat_genre


# 使用账户区Apple Music目录元数据兜底对齐标签
def _align_tags_with_catalog(
    tags: Any,
    media_metadata: Optional[Dict[str, Any]],
    storefront: Optional[str],
) -> None:
    if tags is None or not isinstance(media_metadata, dict):
        return
    attrs = media_metadata.get("attributes")
    if not isinstance(attrs, dict):
        return

    cat_title = attrs.get("name")
    if _should_use_catalog_text(getattr(tags, "title", None), cat_title, storefront):
        tags.title = cat_title
        if hasattr(tags, "title_sort"):
            tags.title_sort = cat_title

    cat_artist = attrs.get("artistName")
    if _should_use_catalog_text(getattr(tags, "artist", None), cat_artist, storefront):
        tags.artist = cat_artist
        if hasattr(tags, "artist_sort"):
            tags.artist_sort = cat_artist

    cat_album = attrs.get("albumName")
    if _should_use_catalog_text(getattr(tags, "album", None), cat_album, storefront):
        tags.album = cat_album
        if hasattr(tags, "album_sort"):
            tags.album_sort = cat_album

    cat_album_artist = attrs.get("albumArtistName")
    if _should_use_catalog_text(getattr(tags, "album_artist", None), cat_album_artist, storefront):
        tags.album_artist = cat_album_artist

    cat_genre = _pick_catalog_genre(attrs.get("genreNames"))
    if _should_use_catalog_text(getattr(tags, "genre", None), cat_genre, storefront):
        tags.genre = cat_genre


# 从Cookies中提取media-user-token
def _load_media_user_token_from_cookies(cookies_path: str) -> str:
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
async def _fetch_apple_music_access_tokens() -> List[str]:
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
def _storefront_from_legacy_wrapper(value: Any) -> str:
    storefront_id = str(value or "").split(",", 1)[0].split("-", 1)[0].strip()
    return APPLE_STOREFRONT_ID_MAP.get(storefront_id, "cn")


# 构造虚拟激活订阅账户信息字典
def _synthetic_account_info(storefront: str) -> Dict[str, Any]:
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
async def _fetch_legacy_wrapper_account_info() -> Dict[str, Any]:
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
async def _get_music_video_metadata_from_itunes(
    music_video_id: str,
    storefront: str,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    lang_tag = _normalize_itunes_language_tag(
        language or _resolve_storefront_language_sync(storefront)
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
def _install_legacy_music_video_metadata_fallback(api: AppleMusicApi) -> None:
    original_get_music_video = api.get_music_video

    # 优先请求官方MV元数据并在失败时回退至iTunes
    async def get_music_video_with_itunes_fallback(music_video_id: str):
        try:
            return await original_get_music_video(music_video_id)
        except Exception as e:
            logger.warning(
                "Apple Music MV metadata lookup failed, falling back to iTunes lookup: %s: %s",
                type(e).__name__,
                e,
            )
            return await _get_music_video_metadata_from_itunes(
                music_video_id,
                api.storefront,
                getattr(api, "language", None),
            )

    api.get_music_video = get_music_video_with_itunes_fallback


def _configure_proxy_aware_client(api: AppleMusicApi) -> None:
    """
    httpx.AsyncClient with RetryTransport sets allow_env_proxies=False,
    which ignores system/environment HTTP proxies (e.g. 10.1.1.1:7897 / 127.0.0.1:7890).
    This causes amp-api.music.apple.com to hang and timeout in proxy environments.
    We detect the underlying proxy transport from a clean AsyncClient and wrap it
    with RetryTransport, ensuring both proxy support and retries work properly.
    """
    try:
        temp_client = httpx.AsyncClient()
        target_transport = None
        for pattern, trans in temp_client._mounts.items():
            if trans and pattern.matches(httpx.URL(APPLE_MUSIC_AMP_API_URL)):
                target_transport = trans
                break
        if target_transport is None:
            target_transport = temp_client._transport

        retry_transport = RetryTransport(
            transport=target_transport,
            retry=Retry(
                total=6,
                backoff_factor=1,
                status_forcelist=[429, 500, 502, 503, 504],
            ),
        )
        headers = dict(api.client.headers)
        if api.media_user_token and "cookie" not in headers:
            headers["cookie"] = f"media-user-token={api.media_user_token}"
        api.client = httpx.AsyncClient(
            headers=headers,
            transport=retry_transport,
            timeout=30.0,
        )
    except Exception as e:
        logger.warning("Failed to configure proxy-aware client for AppleMusicApi: %s", e)


# 从本地Legacy Wrapper中继提取令牌构建AppleMusicApi
async def _create_apple_music_api_from_legacy_wrapper() -> AppleMusicApi:
    wrapper_account_info = await _fetch_legacy_wrapper_account_info()
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
        or _storefront_from_legacy_wrapper(wrapper_account_info.get("storefront_id"))
    )
    language = await _resolve_storefront_language(
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
    api.account_info = _synthetic_account_info(api.storefront)
    api._lingo_legacy_wrapper_fallback = True
    api.client.headers.update({"cookie": f"media-user-token={media_user_token}"})
    _configure_proxy_aware_client(api)
    _install_legacy_music_video_metadata_fallback(api)
    return api


# 解析歌曲编码枚举
def _resolve_song_codec_enum(codec: str):
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
def _setting_enabled(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in TRANSCODE_TRUE_VALUES
    return False


# 定位可用的FFmpeg可执行文件路径
def _resolve_ffmpeg_path() -> str:
    configured = settings.FFMPEG_PATH
    if configured and os.path.exists(configured):
        return configured

    fallback = shutil.which("ffmpeg")
    if fallback:
        return fallback

    raise FileNotFoundError(f"ffmpeg not found. Configured path: {configured}")


# 定位可用的FFprobe可执行文件路径
def _resolve_ffprobe_path(ffmpeg_path: str) -> Optional[str]:
    ffmpeg_obj = Path(ffmpeg_path)
    sibling = ffmpeg_obj.with_name("ffprobe.exe" if os.name == "nt" else "ffprobe")
    if sibling.exists():
        return str(sibling)

    bin_candidate = Path(settings.BIN_DIR) / ("ffprobe.exe" if os.name == "nt" else "ffprobe")
    if bin_candidate.exists():
        return str(bin_candidate)

    return shutil.which("ffprobe")


# 探测音频源文件真实编码格式
def _detect_source_codec(file_path: str, preferred_codec: str, ffprobe_path: Optional[str]) -> str:
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

    if normalized_preferred in {"aac", "alac"}:
        return normalized_preferred

    return normalized_preferred


# 根据当前配置构建音频转码任务列表
def _build_transcode_jobs(source_codec: str, all_settings: Dict[str, Any]) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []

    if source_codec == "aac":
        if _setting_enabled(all_settings.get(SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320)):
            jobs.append({
                "name": "aac->mp3_320k",
                "ext": "mp3",
                "args": ["-c:a", "libmp3lame", "-b:a", "320k"],
            })
        if _setting_enabled(all_settings.get(SETTINGS_KEY_TRANSCODE_AAC_TO_MP4)):
            jobs.append({
                "name": "aac->mp4",
                "ext": "mp4",
                "args": ["-c:a", "copy"],
            })
        if _setting_enabled(all_settings.get(SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD)):
            jobs.append({
                "name": "aac->aac_standard",
                "ext": "m4a",
                "args": ["-c:a", "aac", "-profile:a", "aac_low", "-b:a", "256k"],
            })
    elif source_codec == "alac":
        if _setting_enabled(all_settings.get(SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC)):
            jobs.append({
                "name": "alac->flac",
                "ext": "flac",
                "args": ["-c:a", "flac"],
            })
        if _setting_enabled(all_settings.get(SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV)):
            jobs.append({
                "name": "alac->wav",
                "ext": "wav",
                "args": ["-c:a", "pcm_s24le"],
            })
        if _setting_enabled(all_settings.get(SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4)):
            jobs.append({
                "name": "alac->mp4",
                "ext": "mp4",
                "args": ["-c:a", "copy"],
            })

    return jobs


# 判断当前是否启用了任何音质转码任务
def _has_transcode_enabled(all_settings: Dict[str, Any]) -> bool:
    keys = (
        SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320,
        SETTINGS_KEY_TRANSCODE_AAC_TO_MP4,
        SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD,
        SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC,
        SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV,
        SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4,
    )
    return any(_setting_enabled(all_settings.get(key)) for key in keys)


# 构造转码产物在目标目录的绝对路径
def _build_converted_output_path(source_file_path: str, ext: str) -> Path:
    source_path = Path(source_file_path).resolve()
    download_root = Path(settings.OUTPUT_PATH).resolve()
    converted_root = Path(settings.CONVERTED_PATH).resolve()

    try:
        relative_parent = source_path.parent.relative_to(download_root)
        target_dir = converted_root / relative_parent
    except Exception:
        target_dir = converted_root / source_path.parent.name

    target_dir.mkdir(parents=True, exist_ok=True)
    normalized_ext = ext[1:] if ext.startswith(".") else ext
    return target_dir / f"{source_path.stem}.{normalized_ext}"


# 检测WSL端口是否处于监听连接就绪状态
def is_wsl_port_ready(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex(('127.0.0.1', port)) == 0


# 确保WSL解密服务桥接通道处于可用状态
async def ensure_wsl_bridge():
    if is_wsl_port_ready(10020):
        return True
    try:
        logger.info("WSL decrypt port not ready, attempting to start via WSL...")
        subprocess.Popen(
            ["wsl", "sh", "-c", "python3 /root/decrypt_server.py"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception as e:
        logger.error(f"Failed to auto-start WSL decrypt server: {e}")
        return False



# 安全读取对象属性
def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


# 安全读取字典键值
def _safe_map_get(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return default


# 从媒体下载产物解析并构造元数据记录
def _extract_media_metadata(item: Any, source_url: str) -> Dict[str, Any]:
    media = _safe_attr(item, "media")
    tags = _safe_attr(media, "tags")
    media_dict = media if isinstance(media, dict) else {}

    if media_dict:
        attributes = _safe_map_get(media_dict, "attributes", {})
    else:
        attributes = _safe_attr(media, "attributes", {})
    if not isinstance(attributes, dict):
        attributes = {}

    play_params = attributes.get("playParams", {})
    if not isinstance(play_params, dict):
        play_params = {}

    track_id = (
        _safe_attr(media, "media_id")
        or _safe_attr(media, "id")
        or _safe_map_get(media_dict, "media_id")
        or _safe_map_get(media_dict, "id")
        or _safe_map_get(play_params, "id")
    )
    if track_id is None or str(track_id).strip() == "":
        track_id = source_url.split("/")[-1].split("?")[0]
    track_id = str(track_id)

    title = (
        _safe_attr(tags, "title")
        or _safe_attr(media, "title")
        or _safe_attr(media, "name")
        or attributes.get("name")
        or "Unknown Title"
    )
    artist_name = (
        _safe_attr(tags, "artist")
        or _safe_attr(media, "artist")
        or _safe_attr(media, "artist_name")
        or attributes.get("artistName")
        or "Unknown Artist"
    )
    album_name = (
        _safe_attr(tags, "album")
        or _safe_attr(media, "album")
        or _safe_attr(media, "album_name")
        or attributes.get("albumName")
        or "Unknown Album"
    )

    cover = _safe_attr(media, "cover")
    cover_url = _safe_attr(cover, "url")
    if not cover_url:
        cover_url = _safe_map_get(cover, "url")

    artwork = attributes.get("artwork", {})
    if not isinstance(artwork, dict):
        artwork = {}

    artwork_url = cover_url or artwork.get("url", "")

    file_path = _safe_attr(item, "final_path") or ""
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
    async def ensure_initialized(self) -> bool:
        if self.is_initialized:
            return True
        async with self._init_lock:
            if self.is_initialized:
                return True
            return await self.initialize()

    # 初始化Apple Music下载引擎及鉴权客户端
    async def initialize(self):
        if not os.path.exists(settings.COOKIES_PATH):
            logger.error(f"Cookies file not found at {settings.COOKIES_PATH}")
            return False

        self.apple_music_api = None
        self.is_initialized = False

        # Ensure WSL Bridge is up
        await ensure_wsl_bridge()

        try:
            media_user_token = _load_media_user_token_from_cookies(settings.COOKIES_PATH)
            candidate_tokens = await _fetch_apple_music_access_tokens()

            init_errors: List[str] = []
            for access_token in candidate_tokens:
                try:
                    self.apple_music_api = await AppleMusicApi.create(
                        media_user_token=media_user_token,
                        token=access_token,
                    )
                    _configure_proxy_aware_client(self.apple_music_api)
                    if not self.apple_music_api.active_subscription:
                        init_errors.append("No active Apple Music subscription found.")
                        self.apple_music_api = None
                        continue

                    # 依据账户所属Storefront自动设定对应的本地化元数据语言
                    self.apple_music_api.language = await _resolve_storefront_language(
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
                self.apple_music_api = await _create_apple_music_api_from_legacy_wrapper()
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

    # 根据格式、设备环境与元数据地区配置构建下载器实例
    async def _create_downloader(
        self,
        codec: str,
        video_resolution: str,
        use_wrapper: bool,
        metadata_region: Optional[str] = None,
    ):
        all_settings = get_all_settings()
        requested_region = (
            metadata_region
            if metadata_region is not None
            else all_settings.get(SETTINGS_KEY_METADATA_REGION, "auto")
        )
        account_sf = (getattr(self.apple_music_api, "storefront", "") or "cn").lower()
        target_sf, target_lang = await _resolve_target_metadata_region_and_language(
            account_sf,
            requested_region,
            token=getattr(self.apple_music_api, "token", None),
            media_user_token=getattr(self.apple_music_api, "media_user_token", None),
        )

        # 克隆共享API实例以在不干扰账号播放区域的前提下切换元数据语言
        localized_api = copy.copy(self.apple_music_api)
        localized_api.language = target_lang

        cleanup_clients: List[Any] = []
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

        rt = gamdlrt()
        base_interface = await rt.AppleMusicBaseInterface.create(
            apple_music_api=localized_api,
            itunes_api=account_itunes_api,
            use_wrapper=use_wrapper
        )

        try:
            song_codec_enum = _resolve_song_codec_enum(codec)
        except ValueError:
            song_codec_enum = _resolve_song_codec_enum("aac-legacy")

        try:
            video_res_enum = rt.MusicVideoResolution(video_resolution)
        except ValueError:
            video_res_enum = rt.MusicVideoResolution.R1080P

        song_interface = rt.LingoAppleMusicSongInterface(
            base=base_interface,
            codec_priority=[song_codec_enum],
            metadata_storefront=target_sf,
            metadata_language=target_lang,
        )
        music_video_interface = rt.LingoAppleMusicMusicVideoInterface(
            base=base_interface,
            resolution=video_res_enum,
            metadata_storefront=target_sf,
            metadata_language=target_lang,
            metadata_itunes_api=metadata_itunes_api,
        )
        uploaded_video_interface = rt.AppleMusicUploadedVideoInterface(
            base=base_interface,
        )

        interface = rt.AppleMusicInterface(
            song=song_interface,
            music_video=music_video_interface,
            uploaded_video=uploaded_video_interface,
        )

        nm3u8_binary = shutil.which("N_m3u8DL-RE") or shutil.which("N_m3u8DL-RE.exe")
        download_mode = rt.DownloadMode.NM3U8DLRE if nm3u8_binary else rt.DownloadMode.YTDLP

        base_downloader = rt.LingoAppleMusicBaseDownloader(
            interface=interface,
            output_path=settings.OUTPUT_PATH,
            nm3u8dlre_path=nm3u8_binary or "N_m3u8DL-RE",
            mp4decrypt_path=settings.MP4DECRYPT_PATH,
            ffmpeg_path=settings.FFMPEG_PATH,
            download_mode=download_mode,
        )

        song_downloader = rt.AppleMusicSongDownloader(base=base_downloader)
        music_video_downloader = rt.AppleMusicMusicVideoDownloader(base=base_downloader)
        uploaded_video_downloader = rt.AppleMusicUploadedVideoDownloader(base=base_downloader)

        downloader = rt.AppleMusicDownloader(
            song=song_downloader,
            music_video=music_video_downloader,
            uploaded_video=uploaded_video_downloader,
        )
        downloader._lingo_cleanup_clients = cleanup_clients
        return downloader

    # 将指定URL加入后台异步下载任务队列
    async def add_to_queue(
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

        self.download_status[url] = {
            "status": "pending",
            "items": [],
            "codec": _normalize_codec_label(codec),
            "resolution": video_resolution
        }

        downloader = await self._create_downloader(
            codec,
            video_resolution,
            use_wrapper,
            metadata_region=metadata_region,
        )
        task = asyncio.create_task(self._process_url(downloader, url))
        # Keep a strong reference so GC cannot destroy the task before it finishes.
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return True

    # 驱动单任务解析与分步执行下载流程
    async def _process_url(self, downloader, url: str):
        rt = gamdlrt()
        try:
            self.download_status[url]["status"] = "processing"
            download_queue: List[Dict[str, Any]] = []
            preflight_error_items: List[Dict[str, Any]] = []

            async for item in downloader.get_download_item_from_url(url):
                # Check for errors yielding from the downloader interface first
                if item.media.error:
                    error_obj = item.media.error
                    error_message = str(error_obj) or "Unknown media resolution error"
                    logger.warning("Skip unresolved media item from interface: %s", error_message)

                    # Keep album/playlist progress usable even when some tracks do not
                    # expose the requested codec (for example partial ALAC availability).
                    if isinstance(error_obj, rt.GamdlInterfaceFormatNotAvailableError):
                        hint = "该曲目不提供当前音质，已跳过并继续下载其他曲目。"
                    elif isinstance(error_obj, GamdlApiResponseError):
                        hint = _get_api_error_hint(error_obj.status_code)
                    else:
                        hint = "该曲目解析失败，已跳过并继续下载其他曲目。"

                    error_meta = _extract_media_metadata(item, url)
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
                
                # gamdl interface generators yield a *partial* item first
                # (media.partial=True, final_path=None) as a progress signal.
                # Only queue items that are fully resolved.
                if item.final_path is None or item.media.partial:
                    continue
                meta = _extract_media_metadata(item, url)
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

            if not download_queue:
                if preflight_error_items:
                    self.download_status[url]["status"] = "error"
                    self.download_status[url]["error"] = preflight_error_items[0].get("error") or "No downloadable tracks found."
                    return
                raise ValueError("No downloadable tracks/videos found. The URL might be invalid or restricted.")

            self.download_status[url]["status"] = "downloading"

            for queued in download_queue:
                item = queued["item"]
                index = queued["status_index"]
                if index >= len(self.download_status[url]["items"]):
                    logger.error("Download item index out of range: %s", index)
                    continue
                self.download_status[url]["items"][index]["status"] = "downloading"
                try:
                    await downloader.download(item)
                    metadata = _extract_media_metadata(item, url)
                    self._mark_item_completed(url, index, metadata)
                    self._insert_history_safe(url, metadata)
                    await asyncio.to_thread(self._run_transcode_pipeline_safe, url, metadata)
                except rt.GamdlDownloaderMediaFileExistsError as e:
                    # Existing local file should not fail album/playlist downloads.
                    metadata = _extract_media_metadata(item, url)
                    self._mark_item_completed(url, index, metadata)
                    self.download_status[url]["items"][index]["hint"] = "本地文件已存在，跳过重复下载并已写入历史记录"
                    self.download_status[url]["items"][index]["already_exists"] = True
                    logger.info("Skip existing media file: %s", e)
                    self._insert_history_safe(url, metadata)
                    await asyncio.to_thread(self._run_transcode_pipeline_safe, url, metadata)
                        
                except GamdlApiResponseError as e:
                    # Extract HTTP detail from the Apple Music API error
                    detail = f"{e.message}"
                    if e.status_code:
                        detail += f" [HTTP {e.status_code}]"
                    if e.content:
                        detail += f" | Response: {str(e.content)[:300]}"
                    logger.error(f"Apple Music API error: {detail}")
                    hint = _get_api_error_hint(e.status_code)
                    self.download_status[url]["items"][index]["status"] = "error"
                    self.download_status[url]["items"][index]["error"] = detail
                    self.download_status[url]["items"][index]["hint"] = hint
                except rt.GamdlInterfaceDecryptionNotAvailableError as e:
                    msg = (
                        "Decryption not available. Wrapper may be expired or not fully ready. "
                        "Please restart Wrapper and re-login, then retry."
                    )
                    logger.error(msg)
                    self.download_status[url]["items"][index]["status"] = "error"
                    self.download_status[url]["items"][index]["error"] = msg
                except rt.GamdlInterfaceFormatNotAvailableError as e:
                    msg = "Format/codec not available for this track (try a different codec)."
                    logger.error(msg)
                    self.download_status[url]["items"][index]["status"] = "error"
                    self.download_status[url]["items"][index]["error"] = msg
                except Exception as e:
                    logger.error(f"Error downloading item: {e}", exc_info=True)
                    self.download_status[url]["items"][index]["status"] = "error"
                    self.download_status[url]["items"][index]["error"] = str(e)

            # Defensive finalization: no child should remain pending/downloading
            # once the queue loop has completed.
            for child in self.download_status[url]["items"]:
                if child.get("status") in {"pending", "downloading"}:
                    child["status"] = "error"
                    if not child.get("error"):
                        child["error"] = "Download did not finish for this item."

            # Keep task usable for albums/playlists with partial availability:
            # if at least one item completed, mark the task completed.
            items = self.download_status[url]["items"]
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

        except Exception as e:
            logger.error(f"Error processing url {url}: {e}", exc_info=True)
            self.download_status[url]["status"] = "error"
            self.download_status[url]["error"] = str(e)
        finally:
            self._finalprcstts(url)
            for client in getattr(downloader, "_lingo_cleanup_clients", []) or []:
                try:
                    await client.aclose()
                except Exception:
                    pass

    # 任务终态落盘SQLite并裁剪内存状态字典
    def _finalprcstts(self, url: str) -> None:
        task = self.download_status.get(url)
        if not task:
            return
        try:
            insert_download_task({
                "url": url,
                "status": task.get("status", ""),
                "codec": task.get("codec", ""),
                "resolution": task.get("resolution", ""),
                "items_json": json.dumps(task.get("items", []), ensure_ascii=False),
                "error": task.get("error", ""),
                "file_path": task.get("file_path", ""),
            })
        except Exception as e:
            logger.error("Failed to persist download task snapshot: %s", e)

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
    def _mark_item_completed(self, url: str, index: int, metadata: Dict[str, Any]) -> None:
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
    def _insert_history_safe(self, url: str, metadata: Dict[str, Any]) -> None:
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
    def _run_transcode_pipeline_safe(self, url: str, metadata: Dict[str, Any]) -> None:
        try:
            self._run_transcode_pipeline(url, metadata)
        except Exception as e:
            logger.error("Failed to run transcode pipeline: %s", e, exc_info=True)

    # 执行本地音频格式转码后处理管道
    def _run_transcode_pipeline(self, url: str, metadata: Dict[str, Any]) -> None:
        source_path = str(metadata.get("file_path") or "").strip()
        if not source_path or not os.path.exists(source_path):
            return

        all_settings = get_all_settings()
        if not _has_transcode_enabled(all_settings):
            return

        preferred_codec = self.download_status.get(url, {}).get("codec", "")
        ffmpeg_path = _resolve_ffmpeg_path()
        ffprobe_path = _resolve_ffprobe_path(ffmpeg_path)
        source_codec = _detect_source_codec(source_path, preferred_codec, ffprobe_path)

        jobs = _build_transcode_jobs(source_codec, all_settings)
        if not jobs:
            return

        for job in jobs:
            output_path = _build_converted_output_path(source_path, job["ext"])
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
            proc = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, check=False)
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
def _get_api_error_hint(status_code: Optional[int]) -> str:
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
