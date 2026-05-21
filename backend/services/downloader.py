import asyncio
import os
import logging
import subprocess
import socket
import re
import shutil
import tempfile
import unicodedata
from pathlib import Path
from typing import Dict, Any, Optional, List
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen

from backend.db.database import insert_history, get_all_settings

from gamdl.api.exceptions import GamdlApiResponseError
from gamdl.interface.exceptions import (
    GamdlInterfaceDecryptionNotAvailableError,
    GamdlInterfaceFormatNotAvailableError,
)

from gamdl.api import AppleMusicApi
from gamdl.downloader import (
    AppleMusicBaseDownloader,
    AppleMusicDownloader,
    AppleMusicMusicVideoDownloader,
    AppleMusicSongDownloader,
    AppleMusicUploadedVideoDownloader,
)
from gamdl.downloader.enums import DownloadMode
from gamdl.downloader.exceptions import GamdlDownloaderMediaFileExistsError
from gamdl.interface import (
    AppleMusicBaseInterface,
    AppleMusicInterface,
    AppleMusicMusicVideoInterface,
    AppleMusicSongInterface,
    AppleMusicUploadedVideoInterface,
    SongCodec,
    MusicVideoResolution
)
from yt_dlp import YoutubeDL

from backend.core.config import settings

logger = logging.getLogger(__name__)

SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320 = "lingomusic-transcode-aac-to-mp3-320"
SETTINGS_KEY_TRANSCODE_AAC_TO_MP4 = "lingomusic-transcode-aac-to-mp4"
SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD = "lingomusic-transcode-aac-to-aac-standard"
SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC = "lingomusic-transcode-alac-to-flac"
SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV = "lingomusic-transcode-alac-to-wav"
SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4 = "lingomusic-transcode-alac-to-mp4"

TRANSCODE_TRUE_VALUES = {"1", "true", "yes", "on"}

def _normalize_codec_label(raw_codec: Optional[str]) -> str:
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


def _filename_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "")
    normalized = normalized.casefold().strip()
    return re.sub(r"\s+", " ", normalized)


def _strip_track_prefix(name: str) -> str:
    # Matches patterns like "05 xxx", "05-xxx", "05. xxx", "05) xxx".
    return re.sub(r"^\s*\d{1,3}\s*[\-._)\]]?\s*", "", name).strip()


def _find_sidecar_lrc_path(audio_path: str) -> str:
    audio_obj = Path(audio_path)
    if not audio_obj.exists():
        return ""

    for candidate in (audio_obj.with_suffix(".lrc"), audio_obj.with_suffix(".LRC")):
        if candidate.exists() and candidate.is_file():
            return str(candidate)

    target_keys = {
        _filename_key(audio_obj.stem),
        _filename_key(_strip_track_prefix(audio_obj.stem)),
    }
    target_keys = {key for key in target_keys if key}

    try:
        lrc_files = [p for p in audio_obj.parent.iterdir() if p.is_file() and p.suffix.lower() == ".lrc"]
    except Exception:
        return ""

    for lrc_file in lrc_files:
        if _filename_key(lrc_file.stem) in target_keys:
            return str(lrc_file)

    for lrc_file in lrc_files:
        if _filename_key(_strip_track_prefix(lrc_file.stem)) in target_keys:
            return str(lrc_file)

    if len(lrc_files) == 1:
        return str(lrc_files[0])

    return ""


def _setting_enabled(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in TRANSCODE_TRUE_VALUES
    return False


def _resolve_ffmpeg_path() -> str:
    configured = settings.FFMPEG_PATH
    if configured and os.path.exists(configured):
        return configured

    fallback = shutil.which("ffmpeg")
    if fallback:
        return fallback

    raise FileNotFoundError(f"ffmpeg not found. Configured path: {configured}")


def _resolve_ffprobe_path(ffmpeg_path: str) -> Optional[str]:
    ffmpeg_obj = Path(ffmpeg_path)
    sibling = ffmpeg_obj.with_name("ffprobe.exe" if os.name == "nt" else "ffprobe")
    if sibling.exists():
        return str(sibling)

    bin_candidate = Path(settings.BIN_DIR) / ("ffprobe.exe" if os.name == "nt" else "ffprobe")
    if bin_candidate.exists():
        return str(bin_candidate)

    return shutil.which("ffprobe")


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


def is_wsl_port_ready(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex(('127.0.0.1', port)) == 0

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

    async def download_stream(self, stream_url: str, download_path: str):
        patched_m3u8_path: Optional[Path] = None
        if stream_url and ".m3u8" in stream_url.lower():
            try:
                patched_m3u8_path = await asyncio.to_thread(
                    self._create_query_inherited_m3u8,
                    stream_url,
                    download_path,
                )
                if patched_m3u8_path:
                    await asyncio.to_thread(
                        self._download_ytdlp_from_local_m3u8,
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

    def _create_query_inherited_m3u8(self, stream_url: str, download_path: str) -> Optional[Path]:
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

        def _absolutize_and_inherit(uri_text: str) -> str:
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
                    new_uri = _absolutize_and_inherit(old_uri)
                    if new_uri != old_uri:
                        line = line.replace(old_uri, new_uri, 1)
                        changed_count += 1
                patched_lines.append(line)
                continue

            if line.startswith("#"):
                patched_lines.append(line)
                continue

            new_uri = _absolutize_and_inherit(line)
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

    def _download_ytdlp_from_local_m3u8(self, m3u8_path: Path, download_path: str) -> None:
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


def _safe_attr(obj: Any, attr_name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def _safe_map_get(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return default


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

class DownloadManager:
    def __init__(self):
        self.apple_music_api = None
        self.download_queue = []
        self.download_status: Dict[str, Any] = {}
        self.is_initialized = False
        # Strong references to running tasks.
        # asyncio only keeps *weak* refs; without this the GC destroys
        # pending tasks mid-run and causes 'aclose() already running'.
        self._tasks: set = set()

    async def initialize(self):
        if not os.path.exists(settings.COOKIES_PATH):
            logger.error(f"Cookies file not found at {settings.COOKIES_PATH}")
            return False

        # Ensure WSL Bridge is up
        await ensure_wsl_bridge()

        try:
            self.apple_music_api = await AppleMusicApi.create_from_netscape_cookies(
                cookies_path=settings.COOKIES_PATH,
            )
            
            if not self.apple_music_api.active_subscription:
                logger.error("No active Apple Music subscription found.")
                return False

            self.is_initialized = True
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Gamdl downloader: {e}")
            return False

    async def _create_downloader(self, codec: str, video_resolution: str, use_wrapper: bool):
        base_interface = await AppleMusicBaseInterface.create(
            apple_music_api=self.apple_music_api,
            use_wrapper=use_wrapper
        )
        
        try:
            song_codec_enum = SongCodec(codec)
        except ValueError:
            song_codec_enum = SongCodec.AAC_LEGACY
            
        try:
            video_res_enum = MusicVideoResolution(video_resolution)
        except ValueError:
            video_res_enum = MusicVideoResolution.R1080P

        song_interface = AppleMusicSongInterface(
            base=base_interface,
            codec_priority=[song_codec_enum]
        )
        music_video_interface = AppleMusicMusicVideoInterface(
            base=base_interface,
            resolution=video_res_enum
        )
        uploaded_video_interface = AppleMusicUploadedVideoInterface(
            base=base_interface,
        )
        
        interface = AppleMusicInterface(
            song=song_interface,
            music_video=music_video_interface,
            uploaded_video=uploaded_video_interface,
        )
        
        nm3u8_binary = shutil.which("N_m3u8DL-RE") or shutil.which("N_m3u8DL-RE.exe")
        download_mode = DownloadMode.NM3U8DLRE if nm3u8_binary else DownloadMode.YTDLP

        base_downloader = LingoAppleMusicBaseDownloader(
            interface=interface,
            output_path=settings.OUTPUT_PATH,
            nm3u8dlre_path=nm3u8_binary or "N_m3u8DL-RE",
            mp4decrypt_path=settings.MP4DECRYPT_PATH,
            ffmpeg_path=settings.FFMPEG_PATH,
            download_mode=download_mode,
        )
        
        song_downloader = AppleMusicSongDownloader(base=base_downloader)
        music_video_downloader = AppleMusicMusicVideoDownloader(base=base_downloader)
        uploaded_video_downloader = AppleMusicUploadedVideoDownloader(base=base_downloader)
        
        return AppleMusicDownloader(
            song=song_downloader,
            music_video=music_video_downloader,
            uploaded_video=uploaded_video_downloader,
        )

    async def add_to_queue(self, url: str, codec: str = "aac-legacy", video_resolution: str = "1080p", use_wrapper: bool = False) -> bool:
        if not self.is_initialized:
            logger.error("Downloader not initialized. Please check cookies.txt")
            return False
            
        self.download_status[url] = {
            "status": "pending", 
            "items": [], 
            "codec": _normalize_codec_label(codec),
            "resolution": video_resolution
        }
        
        downloader = await self._create_downloader(codec, video_resolution, use_wrapper)
        task = asyncio.create_task(self._process_url(downloader, url))
        # Keep a strong reference so GC cannot destroy the task before it finishes.
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return True

    async def _process_url(self, downloader, url: str):
        try:
            self.download_status[url]["status"] = "processing"
            download_items = []

            async for item in downloader.get_download_item_from_url(url):
                # Check for errors yielding from the downloader interface first
                if item.media.error:
                    raise item.media.error
                
                # gamdl interface generators yield a *partial* item first
                # (media.partial=True, final_path=None) as a progress signal.
                # Only queue items that are fully resolved.
                if item.final_path is None or item.media.partial:
                    continue
                download_items.append(item)
                meta = _extract_media_metadata(item, url)
                self.download_status[url]["items"].append({
                    "status": "pending",
                    "track_id": meta["track_id"],
                    "name": meta["name"],
                })

            if not download_items:
                raise ValueError("No downloadable tracks/videos found. The URL might be invalid or restricted.")

            self.download_status[url]["status"] = "downloading"

            for index, item in enumerate(download_items):
                self.download_status[url]["items"][index]["status"] = "downloading"
                try:
                    await downloader.download(item)
                    metadata = _extract_media_metadata(item, url)
                    self._mark_item_completed(url, index, metadata)
                    self._insert_history_safe(url, metadata)
                    await asyncio.to_thread(self._run_transcode_pipeline_safe, url, metadata)
                except GamdlDownloaderMediaFileExistsError as e:
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
                except GamdlInterfaceDecryptionNotAvailableError as e:
                    msg = (
                        "Decryption not available. Wrapper may be expired or not fully ready. "
                        "Please restart Wrapper and re-login, then retry."
                    )
                    logger.error(msg)
                    self.download_status[url]["items"][index]["status"] = "error"
                    self.download_status[url]["items"][index]["error"] = msg
                except GamdlInterfaceFormatNotAvailableError as e:
                    msg = "Format/codec not available for this track (try a different codec)."
                    logger.error(msg)
                    self.download_status[url]["items"][index]["status"] = "error"
                    self.download_status[url]["items"][index]["error"] = msg
                except Exception as e:
                    logger.error(f"Error downloading item: {e}", exc_info=True)
                    self.download_status[url]["items"][index]["status"] = "error"
                    self.download_status[url]["items"][index]["error"] = str(e)

            # Check if any items in the queue failed. If so, set overall status to error.
            any_error = any(item.get("status") == "error" for item in self.download_status[url]["items"])
            if any_error:
                self.download_status[url]["status"] = "error"
                for child in self.download_status[url]["items"]:
                    if child.get("status") == "error" and child.get("error"):
                        self.download_status[url]["error"] = child.get("error")
                        break
            else:
                self.download_status[url]["status"] = "completed"

        except Exception as e:
            logger.error(f"Error processing url {url}: {e}", exc_info=True)
            self.download_status[url]["status"] = "error"
            self.download_status[url]["error"] = str(e)

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

    def _run_transcode_pipeline_safe(self, url: str, metadata: Dict[str, Any]) -> None:
        try:
            self._run_transcode_pipeline(url, metadata)
        except Exception as e:
            logger.error("Failed to run transcode pipeline: %s", e, exc_info=True)

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
