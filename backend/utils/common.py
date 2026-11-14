# 跨层共享的纯文本、路径与搜索常量
from backend.head import Optional, Path, re, unicodedata

# 搜索分类与缓存常量
SEARCH_CATEGORY_KEYS = ("songs", "music-videos", "albums", "artists", "playlists")
FAST_SEARCH_TYPES = "songs,albums,artists,music-videos,playlists"
FAST_SEARCH_LIMIT = 50
FAST_SEARCH_TIMEOUT_SECONDS = 12.0
FAST_SEARCH_DIRECT_TIMEOUT_SECONDS = 8.0
ITUNES_SEARCH_TIMEOUT_SECONDS = 10.0
SEARCH_CACHE_TTL_SECONDS = 45.0
SEARCH_CACHE_STALE_SECONDS = 600.0
SEARCH_CACHE_MAX_ENTRIES = 60


# 规范化音频编码标签
def nrmlcdclbl(raw_codec: Optional[str]) -> str:
    value = (raw_codec or "").strip().lower()
    if not value:
        return "aac"
    if "alac" in value:
        return "alac"
    if "atmos" in value or "dolby" in value or value in {"ec-3", "eac3", "ac-3", "ac3"}:
        return "dolby"
    if "aac" in value or "mp4a" in value:
        return "aac"
    return value


# 归一化前端画质别名
def nrmlvdqlty(raw_resolution: Optional[str]) -> str:
    value = (raw_resolution or "").strip().lower()
    return "2160p" if value == "4k" else value


# 校验下载参数组合
def vlddwnopt(
    raw_codec: Optional[str],
    use_wrapper: bool,
    metadata_region: Optional[str],
) -> Optional[str]:
    codec = nrmlcdclbl(raw_codec)
    if codec in {"alac", "dolby"} and not use_wrapper:
        return "当前音质需要解密组件支持。请先启用并确保解密组件正在运行后重试。"
    region = (metadata_region or "").strip()
    if region and region != "auto" and not re.fullmatch(r"[A-Za-z]{2}", region):
        return "元数据地区必须是 auto 或两位地区码。"
    return None


# 规整化iTunes封面图占位模板
def itnsarttmpl(url: str) -> str:
    if not url:
        return ""
    return re.sub(r"/\d+x\d+bb\.(jpg|png|webp)$", r"/{w}x{h}bb.\1", url)


# 生成文件名归一化比较键
def fnmkey(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "")
    normalized = normalized.casefold().strip()
    return re.sub(r"\s+", " ", normalized)


# 剥除曲目前缀序号字符
def strptrkprfx(name: str) -> str:
    return re.sub(r"^\s*\d{1,3}\s*[\-._)\]]?\s*", "", name).strip()


# 查找伴随同名LRC歌词文件路径
def fndsdcrlrc(audio_path: str, preferred_path: Optional[str] = None) -> Optional[str]:
    audio_obj = Path(audio_path)
    if not audio_obj.exists():
        return None

    if preferred_path:
        try:
            preferred_obj = Path(preferred_path)
            if preferred_obj.exists() and preferred_obj.is_file():
                return str(preferred_obj)
        except Exception:
            pass

    for candidate in (audio_obj.with_suffix(".lrc"), audio_obj.with_suffix(".LRC")):
        if candidate.exists() and candidate.is_file():
            return str(candidate)

    parent = audio_obj.parent
    target_keys = {
        fnmkey(audio_obj.stem),
        fnmkey(strptrkprfx(audio_obj.stem)),
    }
    target_keys = {key for key in target_keys if key}

    try:
        lrc_files = [p for p in parent.iterdir() if p.is_file() and p.suffix.lower() == ".lrc"]
    except Exception:
        return None

    for file in lrc_files:
        if fnmkey(file.stem) in target_keys:
            return str(file)

    for file in lrc_files:
        if fnmkey(strptrkprfx(file.stem)) in target_keys:
            return str(file)

    if len(lrc_files) == 1:
        return str(lrc_files[0])

    return None