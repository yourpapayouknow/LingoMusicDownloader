# gamdl运行时惰性依赖模块（仅首次下载时由downloader.gamdlrt()导入）
# 本模块是backend.head统一收口规则的唯一豁免点：
# yt-dlp/m3u8/gamdl下载器与接口等重型依赖在此集中引用，
# 避免进程启动即常驻PIL/pywidevine/pymp4/protobuf等传递依赖。
import logging

import m3u8
from yt_dlp import YoutubeDL

from gamdl.api import ItunesApi
from gamdl.downloader import (
    AppleMusicBaseDownloader,
    AppleMusicDownloader,
    AppleMusicMusicVideoDownloader,
    AppleMusicSongDownloader,
    AppleMusicUploadedVideoDownloader,
    DownloadMode,
    GamdlDownloaderMediaFileExistsError,
)
from gamdl.interface import (
    AppleMusicBaseInterface,
    AppleMusicInterface,
    AppleMusicMusicVideoInterface,
    AppleMusicSongInterface,
    AppleMusicUploadedVideoInterface,
    GamdlInterfaceDecryptionNotAvailableError,
    GamdlInterfaceFormatNotAvailableError,
    MusicVideoResolution,
)
from gamdl.interface.constants import MP4_FORMAT_CODECS
from gamdl.interface.enums import MediaFileFormat, SongCodec
from gamdl.interface.types import StreamInfo, StreamInfoAv

from backend.head import (
    asyncio, re, tempfile, Path, Dict, Any, Optional, List,
    urljoin, urlparse, urlunparse, UrlRequest as Request, urlopen,
)

# 复用独立的元数据服务（避免反向依赖downloader）
from backend.services.metadata import (
    AUDIO_FORMAT_ID_BY_CODEC,
    _ftccatmd,
    _algntag,
    _flmstgt,
)

# downloader通过rt.*访问的gamdl公开契约（新增依赖名时必须同步维护）
__all__ = [
    "AppleMusicBaseDownloader",
    "AppleMusicBaseInterface",
    "AppleMusicDownloader",
    "AppleMusicInterface",
    "AppleMusicMusicVideoDownloader",
    "AppleMusicMusicVideoInterface",
    "AppleMusicSongDownloader",
    "AppleMusicSongInterface",
    "AppleMusicUploadedVideoDownloader",
    "AppleMusicUploadedVideoInterface",
    "DownloadMode",
    "GamdlDownloaderMediaFileExistsError",
    "GamdlInterfaceDecryptionNotAvailableError",
    "GamdlInterfaceFormatNotAvailableError",
    "ItunesApi",
    "MediaFileFormat",
    "MP4_FORMAT_CODECS",
    "MusicVideoResolution",
    "SongCodec",
    "StreamInfo",
    "StreamInfoAv",
    "LingoAppleMusicBaseDownloader",
    "LingoAppleMusicSongInterface",
    "LingoAppleMusicMusicVideoInterface",
]

logger = logging.getLogger(__name__)


# 按目标地区对齐媒体标签并兜底填充缺失字段
async def _mtalgn(iface, item: Any, media_type: str) -> None:
    if item.partial or item.tags is None or not item.media_metadata:
        return
    account_sf = (getattr(iface.base.apple_music_api, "storefront", "") or "").lower()
    target_sf = (iface._metadata_storefront or account_sf).lower()
    target_lang = iface._metadata_language or getattr(iface.base.apple_music_api, "language", "en-US")
    if target_sf and target_sf != account_sf:
        catalog_id = iface.base.parse_catalog_media_id(item.media_metadata)
        target_meta = await _ftccatmd(
            iface.base.apple_music_api,
            media_type,
            catalog_id,
            target_sf,
            target_lang,
        )
        if target_meta:
            _algntag(item.tags, target_meta, target_sf)
        else:
            _flmstgt(item.tags, item.media_metadata)
    else:
        _algntag(item.tags, item.media_metadata, target_sf)


class LingoAppleMusicBaseDownloader(AppleMusicBaseDownloader):
    """
    Apple MV HLS playlists sometimes carry a signed query only on the playlist URL
    while individual segment lines are query-less. Some downloaders then request
    those segment URLs without the signature and get HTTP 403, which produces
    near-empty video tracks.

    Fix strategy:
    - Fetch the m3u8 text.
    - Convert segment URIs to absolute URLs.
    - Inherit the parent query (for example `accessKey=...`) when segment URLs
      have no query.
    - Download via yt-dlp using the patched local playlist.
    """

    # 下载音视频流并修复签名鉴权参数
    async def download_stream(self, stream_url: str, download_path: str):
        patched_m3u8_path: Optional[Path] = None
        if stream_url and ".m3u8" in stream_url.lower():
            try:
                patched_m3u8_path = await asyncio.to_thread(
                    self._crtqm3u8,
                    stream_url,
                    download_path,
                )
                if patched_m3u8_path:
                    await asyncio.to_thread(
                        self._dlytm3u8,
                        patched_m3u8_path,
                        download_path,
                    )
                    return
            except Exception as e:
                logger.warning(
                    "m3u8 query-inherit patch failed, fallback to upstream downloader: %s | %s",
                    e,
                    stream_url,
                )
            finally:
                if patched_m3u8_path:
                    try:
                        patched_m3u8_path.unlink(missing_ok=True)
                    except Exception:
                        pass

        await super().download_stream(stream_url, download_path)

    # 生成继承父级鉴权Query参数的本地临时m3u8
    def _crtqm3u8(self, stream_url: str, download_path: str) -> Optional[Path]:
        parsed = urlparse(stream_url)
        query = parsed.query
        host = (parsed.netloc or "").lower()
        if not query or "mvod.itunes.apple.com" not in host:
            return None

        request = Request(stream_url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(request, timeout=20) as response:
            playlist_text = response.read().decode("utf-8", errors="replace")

        if "#EXTM3U" not in playlist_text:
            return None

        # 补齐相对路径并继承URL参数
        def _absinh(uri_text: str) -> str:
            absolute = urljoin(stream_url, uri_text)
            uri_parts = urlparse(absolute)
            if uri_parts.query:
                return absolute
            return urlunparse(uri_parts._replace(query=query))

        patched_lines: List[str] = []
        changed_count = 0

        for raw_line in playlist_text.splitlines():
            line = raw_line.strip()
            if not line:
                patched_lines.append(raw_line)
                continue

            if line.startswith("#EXT-X-MAP:") and 'URI="' in line:
                match = re.search(r'URI="([^"]+)"', line)
                if match:
                    old_uri = match.group(1)
                    new_uri = _absinh(old_uri)
                    if new_uri != old_uri:
                        line = line.replace(old_uri, new_uri, 1)
                        changed_count += 1
                patched_lines.append(line)
                continue

            if line.startswith("#"):
                patched_lines.append(line)
                continue

            new_uri = _absinh(line)
            if new_uri != line:
                changed_count += 1
            patched_lines.append(new_uri)

        if changed_count == 0:
            return None

        output_path = Path(download_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            suffix=".m3u8",
            prefix="lingo_hls_",
            delete=False,
            dir=str(output_path.parent),
        )
        with tmp:
            tmp.write("\n".join(patched_lines) + "\n")
        return Path(tmp.name)

    # 调用yt-dlp从本地修复后的m3u8执行分片下载
    def _dlytm3u8(self, m3u8_path: Path, download_path: str) -> None:
        with YoutubeDL(
            {
                "quiet": True,
                "no_warnings": True,
                "outtmpl": download_path,
                "allow_unplayable_formats": True,
                "overwrites": True,
                "fixup": "never",
                "noprogress": self.silent,
                "allowed_extractors": ["generic"],
                "enable_file_urls": True,
            }
        ) as ydl:
            ydl.download([m3u8_path.resolve().as_uri()])


class LingoAppleMusicSongInterface(AppleMusicSongInterface):
    """
    Wrapper's m3u8 helper port (20020) can occasionally return empty lines even
    when the track exposes lossless streams via enhancedHls.
    When that happens, upstream interface treats it as format unavailable.
    We gracefully fallback to enhancedHls to avoid false negatives.
    """

    # 初始化带目标元数据地区属性的歌曲接口
    def __init__(
        self,
        *args,
        metadata_storefront: Optional[str] = None,
        metadata_language: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self._metadata_storefront = metadata_storefront
        self._metadata_language = metadata_language

    # 解析HLS音频资产元数据与变体流映射关系
    @staticmethod
    def _rsvamd(
        asset_metadata: Dict[str, Any],
        playlist: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        # 按 stable_variant_id 取音频资产元数据，取不到时退回按音频编码匹配
        stable_variant_id = playlist["stream_info"].get("stable_variant_id")
        if stable_variant_id is not None:
            entry = asset_metadata.get(stable_variant_id)
            if entry is not None:
                return entry

        codec_tag = (playlist["stream_info"].get("codecs") or "").strip()
        asset_tag = AUDIO_FORMAT_ID_BY_CODEC.get(codec_tag, codec_tag)
        if not asset_tag:
            return None

        candidates = [
            entry
            for entry in asset_metadata.values()
            if (entry.get("AUDIO-FORMAT-ID") or "").strip() == asset_tag
        ]
        if len(candidates) == 1:
            return candidates[0]

        # 同编码多条时用码率与分片带宽互相印证，无法唯一定位则不猜
        if len(candidates) > 1:
            bandwidth = playlist["stream_info"].get("average_bandwidth") or 0
            ranked = [
                entry
                for entry in candidates
                if entry.get("BIT-RATE") and entry["BIT-RATE"] <= bandwidth
            ]
            if ranked:
                return max(ranked, key=lambda entry: entry["BIT-RATE"])

        return None

    # 获取音频流信息并解析DRM鉴权参数
    async def _gtsinfo(
        self,
        song_metadata: dict,
        codec: SongCodec,
    ) -> StreamInfoAv | None:
        """
        Apple 的 HLS 主播放列表用短 opaque id 作 stable_variant_id，而
        audioAssetMetadata 的键是 SHA-256 摘要，上游直接下标取值会抛 KeyError，
        被当成"格式不可用"导致整张专辑失败。这里在取值处改用兜底匹配。
        """
        if "extendedAssetUrls" not in song_metadata["attributes"]:
            song_metadata = (
                await self.base.apple_music_api.get_song(
                    self.base.parse_catalog_media_id(song_metadata),
                )
            )["data"][0]

        m3u8_master_url = (
            await self.get_wrapper_m3u8(self.base.parse_catalog_media_id(song_metadata))
            if self.base.use_wrapper
            else song_metadata["attributes"]["extendedAssetUrls"].get("enhancedHls")
        )
        if not m3u8_master_url:
            return None

        m3u8_master_obj = m3u8.loads(
            (await self.base.get_response(m3u8_master_url)).text
        )
        m3u8_master_data = m3u8_master_obj.data

        if codec == SongCodec.ASK:
            playlist = await self._get_playlist_from_user(m3u8_master_data)
        else:
            playlist = self._get_playlist_from_codec(m3u8_master_data, codec)

        if playlist is None:
            logger.debug("No matching playlist for codec=%s", codec.value)
            return None

        stream_info = StreamInfo(legacy=False)
        stream_info.stream_url = (
            f"{m3u8_master_url.rpartition('/')[0]}/{playlist['uri']}"
        )
        stream_info.codec = playlist["stream_info"]["codecs"]
        is_mp4 = any(stream_info.codec.startswith(codec) for codec in MP4_FORMAT_CODECS)

        session_key_metadata = self._get_audio_session_key_metadata(m3u8_master_data)

        if session_key_metadata:
            asset_metadata = self._get_asset_metadata(m3u8_master_data)
            asset_entry = self._rsvamd(asset_metadata, playlist)
            if asset_entry is None:
                raise KeyError(
                    "No audio asset metadata matches variant: "
                    f"{playlist['stream_info'].get('stable_variant_id')}"
                )

            drm_ids = asset_entry["AUDIO-SESSION-KEY-IDS"]

            stream_info.widevine_pssh = self._get_drm_uri_from_session_key(
                session_key_metadata,
                drm_ids,
                "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed",
            )
            stream_info.playready_pssh = self._get_drm_uri_from_session_key(
                session_key_metadata,
                drm_ids,
                "com.microsoft.playready",
            )
            stream_info.fairplay_key = self._get_drm_uri_from_session_key(
                session_key_metadata,
                drm_ids,
                "com.apple.streamingkeydelivery",
            )
        else:
            m3u8_obj = m3u8.loads(
                (await self.base.get_response(stream_info.stream_url)).text
            )

            stream_info.widevine_pssh = self._get_drm_uri_from_m3u8_keys(
                m3u8_obj,
                "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed",
            )
            stream_info.playready_pssh = self._get_drm_uri_from_m3u8_keys(
                m3u8_obj,
                "com.microsoft.playready",
            )
            stream_info.fairplay_key = self._get_drm_uri_from_m3u8_keys(
                m3u8_obj,
                "com.apple.streamingkeydelivery",
            )

        stream_info_av = StreamInfoAv(
            audio_track=stream_info,
            file_format=MediaFileFormat.MP4 if is_mp4 else MediaFileFormat.M4A,
        )
        logger.debug("get_song_stream_info success: %s", stream_info_av)
        return stream_info_av

    # 获取Wrapper解密流m3u8地址
    async def get_wrapper_m3u8(self, adam_id: str) -> str | None:
        wrapper_url = await super().get_wrapper_m3u8(adam_id)
        if wrapper_url:
            return wrapper_url

        try:
            song_payload = await self.base.apple_music_api.get_song(adam_id)
            song_data = (
                song_payload.get("data", [{}])[0]
                if isinstance(song_payload, dict)
                else {}
            )
            attributes = song_data.get("attributes", {}) if isinstance(song_data, dict) else {}
            extended_urls = (
                attributes.get("extendedAssetUrls", {})
                if isinstance(attributes, dict)
                else {}
            )
            fallback_url = extended_urls.get("enhancedHls")
            if fallback_url:
                logger.warning(
                    "Wrapper m3u8 returned empty for media_id=%s; fallback to enhancedHls",
                    adam_id,
                )
                return fallback_url
        except Exception as e:
            logger.warning(
                "Failed to fallback enhancedHls for media_id=%s: %s",
                adam_id,
                e,
            )

        return None

    # 按目标元数据地区对齐歌曲标签并兜底填充缺失字段
    async def get_media(self, media: Any):
        async for item in super().get_media(media):
            await _mtalgn(self, item, "songs")
            yield item


class LingoAppleMusicMusicVideoInterface(AppleMusicMusicVideoInterface):
    # 初始化带目标元数据地区属性与iTunes接口的MV接口
    def __init__(
        self,
        *args,
        metadata_storefront: Optional[str] = None,
        metadata_language: Optional[str] = None,
        metadata_itunes_api: Optional[ItunesApi] = None,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self._metadata_storefront = metadata_storefront
        self._metadata_language = metadata_language
        self._metadata_itunes_api = metadata_itunes_api

    # 优先使用目标地区iTunes接口获取MV标签并在失败时回退账号区
    async def get_tags(self, metadata: dict, itunes_page_metadata: dict):
        if self._metadata_itunes_api is not None:
            orig_itunes_api = self.base.itunes_api
            try:
                self.base.itunes_api = self._metadata_itunes_api
                return await super().get_tags(metadata, itunes_page_metadata)
            except Exception as e:
                logger.warning(
                    "Target region MV lookup failed (%s), falling back to account region: %s",
                    self._metadata_storefront,
                    e,
                )
            finally:
                self.base.itunes_api = orig_itunes_api
        return await super().get_tags(metadata, itunes_page_metadata)

    # 按目标元数据地区对齐MV标签并兜底填充缺失字段
    async def get_media(self, media: Any):
        async for item in super().get_media(media):
            await _mtalgn(self, item, "music-videos")
            yield item
