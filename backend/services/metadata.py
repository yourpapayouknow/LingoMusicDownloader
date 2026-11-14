# Apple Music元数据语言、区域与目录标签对齐服务
from backend.head import Any, Dict, Optional, logging, httpx, APPLE_MUSIC_AMP_API_URL

# 日志记录器
logger = logging.getLogger(__name__)

# HLS分片的codecs字段用MP4A对象类型标识，音频资产元数据用简写标识
AUDIO_FORMAT_ID_BY_CODEC = {
    "mp4a.40.2": "aac",
    "mp4a.40.5": "aach",
}

APPLE_MUSIC_HOMEPAGE_URL = "https://music.apple.com"

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
def _nrmitlng(tag: Optional[str]) -> str:
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
def _rsvsflgs(storefront: Optional[str]) -> str:
    sf = (storefront or "").strip().lower()
    return APPLE_STOREFRONT_LANGUAGE_MAP.get(sf, "en-US")


# 异步探测并确定账户Storefront对应的元数据语言
async def _rsvsflng(
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
                            return _nrmitlng(default_lang)
        except Exception as e:
            logger.debug("Storefront language lookup failed for %s: %s", sf, e)

    return _rsvsflgs(sf)


# 解析最终生效的元数据区域与语言标签
async def _rsvtgtln(
    account_storefront: Optional[str],
    requested_region: Optional[str],
    token: Optional[str] = None,
    media_user_token: Optional[str] = None,
) -> tuple[str, str]:
    raw_region = (requested_region or "").strip().lower()
    base_sf = (account_storefront or "cn").strip().lower() or "cn"
    target_sf = base_sf if (not raw_region or raw_region == "auto") else raw_region
    target_lang = await _rsvsflng(
        target_sf,
        token=token,
        media_user_token=media_user_token,
    )
    return target_sf, target_lang


# 拉取指定Storefront区域下的目录媒体元数据
async def _ftccatmd(
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
def _pckgnr(genre_names: Any) -> Optional[str]:
    if not isinstance(genre_names, list):
        return None
    cleaned = [str(g).strip() for g in genre_names if isinstance(g, str) and g.strip()]
    for g in cleaned:
        if g.lower() not in GENERIC_GENRE_NAMES:
            return g
    return cleaned[0] if cleaned else None


# 判断流媒体标签是否应替换为目标区域目录本地化文本
def _shdcattx(
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
def _flmstgt(
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
        cat_genre = _pckgnr(attrs.get("genreNames"))
        if cat_genre:
            tags.genre = cat_genre


# 使用账户区Apple Music目录元数据兜底对齐标签
def _algntag(
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
    if _shdcattx(getattr(tags, "title", None), cat_title, storefront):
        tags.title = cat_title
        if hasattr(tags, "title_sort"):
            tags.title_sort = cat_title

    cat_artist = attrs.get("artistName")
    if _shdcattx(getattr(tags, "artist", None), cat_artist, storefront):
        tags.artist = cat_artist
        if hasattr(tags, "artist_sort"):
            tags.artist_sort = cat_artist

    cat_album = attrs.get("albumName")
    if _shdcattx(getattr(tags, "album", None), cat_album, storefront):
        tags.album = cat_album
        if hasattr(tags, "album_sort"):
            tags.album_sort = cat_album

    cat_album_artist = attrs.get("albumArtistName")
    if _shdcattx(getattr(tags, "album_artist", None), cat_album_artist, storefront):
        tags.album_artist = cat_album_artist

    cat_genre = _pckgnr(attrs.get("genreNames"))
    if _shdcattx(getattr(tags, "genre", None), cat_genre, storefront):
        tags.genre = cat_genre