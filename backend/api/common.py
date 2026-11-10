# 共享常量、工具辅助函数与状态模型模块
from backend.head import (
    os, sys, time, socket, subprocess, threading, ctypes,
    logging, shutil, List, Dict, Any, Optional, Tuple, Path, re, unicodedata
)
from backend.core.config import settings

# 日志记录器
logger = logging.getLogger(__name__)

# 服务端口与通信常量
WRAPPER_DECRYPT_PORT = 10020
WRAPPER_M3U8_PORT = 20020
WRAPPER_ACCOUNT_PORT = 30020
WRAPPER_PORT_CHECK_TIMEOUT_SECONDS = 0.25
HEALTH_CACHE_TTL_SECONDS = 1.0

# 搜索与缓存常量
SEARCH_CATEGORY_KEYS = ("songs", "music-videos", "albums", "artists", "playlists")
FAST_SEARCH_TYPES = "songs,albums,artists,music-videos,playlists"
FAST_SEARCH_LIMIT = 50
FAST_SEARCH_TIMEOUT_SECONDS = 12.0
FAST_SEARCH_DIRECT_TIMEOUT_SECONDS = 8.0
ITUNES_SEARCH_TIMEOUT_SECONDS = 10.0
SEARCH_CACHE_TTL_SECONDS = 45.0
SEARCH_CACHE_STALE_SECONDS = 600.0
SEARCH_CACHE_MAX_ENTRIES = 60

# 本地扫描与认证常量
LOCAL_SCAN_EXTENSIONS = {".m4a", ".aac", ".mp4", ".m4v"}
LOCAL_API_BASE_URL = "http://127.0.0.1:8000/api"
APPLE_LOGIN_URL = "https://music.apple.com/cn/new"
COOKIE_EXPORT_HEADER_LINES = [
    "# Netscape HTTP Cookie File",
    "# https://curl.haxx.se/rfc/cookie_spec.html",
    "# This is a generated file! Do not edit.",
    "",
]
COOKIE_SEARCH_DOMAIN_KEYWORDS = ("apple.com", "music.apple.com")
WEBKIT_EPOCH_DELTA_SECONDS = 11644473600
COOKIE_DB_COPY_RETRY_ATTEMPTS = 24
COOKIE_DB_COPY_RETRY_DELAY_SECONDS = 0.35
COOKIE_INIT_RETRY_ATTEMPTS = 4
COOKIE_INIT_RETRY_DELAY_SECONDS = 1.1

# WSL2与Wrapper配置常量
WSL2_REQUIRED_FREE_GB = 15.0
WSL2_D_INSTALL_PATH = r"D:\WSL2"
WSL2_UBUNTU_DISTRO = "Ubuntu"
WRAPPER_RELEASE_ZIP_URL = (
    "https://github.com/WorldObservationLog/wrapper/releases/download/"
    "wrapper.x86_64.latest/Wrapper.x86_64.latest.zip"
)
WRAPPER_STATE_MAX_LOGS = 700
WRAPPER_SETUP_TIMEOUT_SECONDS = 60 * 20
WRAPPER_STARTUP_GRACE_SECONDS = 45
WRAPPER_SESSION_DB_RELATIVE_PATH = Path(
    "rootfs/data/data/com.apple.android.music/files/mpl_db/kvs.sqlitedb"
)

# 共享状态与全局锁
_wsl2_install_state_lock = threading.RLock()
_wsl2_install_state: Dict[str, Any] = {
    "status": "idle",
    "stage": "idle",
    "running": False,
    "completed": False,
    "success_flag": False,
    "message": "",
    "required_gb": WSL2_REQUIRED_FREE_GB,
    "selected_drive": "",
    "target_path": "",
    "use_custom_location": False,
    "logs": [],
    "updated_at": 0.0,
}

_wrapper_setup_state_lock = threading.RLock()
_wrapper_setup_state: Dict[str, Any] = {
    "status": "idle",
    "stage": "idle",
    "running": False,
    "completed": False,
    "success_flag": False,
    "message": "",
    "wsl2_installed": False,
    "wrapper_installed": False,
    "wrapper_running": False,
    "awaiting_input": False,
    "input_type": "",
    "input_prompt": "",
    "logs": [],
    "updated_at": 0.0,
}

_wrapper_process_lock = threading.RLock()
_wrapper_process: Optional[subprocess.Popen] = None
_wrapper_reader_thread: Optional[threading.Thread] = None
_wrapper_last_output: str = ""


# 转义PowerShell单引号字符串
def pssqt(val: str) -> str:
    return "'" + (val or "").replace("'", "''") + "'"


# 读取WSL安装状态副本
def wslstcpy() -> Dict[str, Any]:
    with _wsl2_install_state_lock:
        payload = dict(_wsl2_install_state)
        payload["logs"] = list(_wsl2_install_state.get("logs", []))
        return payload


# 更新WSL安装状态
def wslstset(**kwargs) -> None:
    with _wsl2_install_state_lock:
        _wsl2_install_state.update(kwargs)
        _wsl2_install_state["updated_at"] = time.time()


# 追加WSL安装日志
def wslstlog(msg: str) -> None:
    text = (msg or "").strip()
    if not text:
        return
    ts = time.strftime("%H:%M:%S")
    line = f"[{ts}] {text}"
    with _wsl2_install_state_lock:
        logs = _wsl2_install_state.setdefault("logs", [])
        logs.append(line)
        if len(logs) > 500:
            del logs[: len(logs) - 500]
        _wsl2_install_state["updated_at"] = time.time()


# 检查当前Windows管理员权限
def isadmin() -> bool:
    if os.name != "nt":
        return False
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


# 获取指定盘符剩余GB空间
def gtfrgb(drv: str) -> float:
    if os.name != "nt":
        return 0.0
    root = f"{drv.upper()}:\\"
    if not os.path.exists(root):
        return 0.0
    try:
        free_bytes = shutil.disk_usage(root).free
    except Exception:
        return 0.0
    return round(free_bytes / (1024 ** 3), 2)


# 执行命令并捕获文本输出
def rncptr(cmd: List[str], tmout: int = 30) -> Tuple[int, str]:
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=tmout,
            encoding="utf-8",
            errors="replace",
        )
        return result.returncode, (result.stdout or "") + "\n" + (result.stderr or "")
    except Exception as e:
        return -1, str(e)


# 检查TCP网络端口监听状态
def chkprt(host: str, port: int, tmout: float = 1.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=tmout):
            return True
    except OSError:
        return False


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


# 读取Wrapper部署状态副本
def wrprstcpy() -> Dict[str, Any]:
    with _wrapper_setup_state_lock:
        payload = dict(_wrapper_setup_state)
        payload["logs"] = list(_wrapper_setup_state.get("logs", []))
        return payload


# 更新Wrapper部署状态
def wrprstset(**kwargs) -> None:
    with _wrapper_setup_state_lock:
        _wrapper_setup_state.update(kwargs)
        _wrapper_setup_state["updated_at"] = time.time()


# 追加Wrapper部署日志
def wrprstlog(msg: str) -> None:
    text = (msg or "").strip()
    if not text:
        return
    ts = time.strftime("%H:%M:%S")
    line = f"[{ts}] {text}"
    with _wrapper_setup_state_lock:
        logs = _wrapper_setup_state.setdefault("logs", [])
        logs.append(line)
        if len(logs) > WRAPPER_STATE_MAX_LOGS:
            del logs[: len(logs) - WRAPPER_STATE_MAX_LOGS]
        _wrapper_setup_state["updated_at"] = time.time()


# 设置全局Wrapper子进程
def setwrprprc(proc: Optional[subprocess.Popen]) -> None:
    global _wrapper_process
    with _wrapper_process_lock:
        _wrapper_process = proc


# 获取全局Wrapper子进程
def gtwrprprc() -> Optional[subprocess.Popen]:
    with _wrapper_process_lock:
        return _wrapper_process


# 获取Wrapper运行健康度状态
def wrprhlth() -> Dict[str, bool]:
    decrypt_ok = chkprt("127.0.0.1", WRAPPER_DECRYPT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
    m3u8_ok = chkprt("127.0.0.1", WRAPPER_M3U8_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
    account_ok = chkprt("127.0.0.1", WRAPPER_ACCOUNT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
    return {
        "decrypt_ok": decrypt_ok,
        "m3u8_ok": m3u8_ok,
        "account_ok": account_ok,
        "all_ok": decrypt_ok and m3u8_ok and account_ok,
    }


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


# 兼容性别名映射
_ps_single_quote = pssqt
_wsl2_copy_state = wslstcpy
_wsl2_set_state = wslstset
_wsl2_append_log = wslstlog
_is_windows_admin = isadmin
_get_drive_free_gb = gtfrgb
_run_capture = rncptr
_check_port = chkprt
_normalize_codec_label = nrmlcdclbl
_wrapper_copy_state = wrprstcpy
_wrapper_set_state = wrprstset
_wrapper_append_log = wrprstlog
_set_wrapper_process = setwrprprc
_get_wrapper_process = gtwrprprc
_get_wrapper_runtime_health = wrprhlth
_filename_key = fnmkey
_strip_track_prefix = strptrkprfx
_find_sidecar_lrc_path = fndsdcrlrc
