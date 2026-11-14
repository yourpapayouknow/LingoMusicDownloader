# 共享常量、工具辅助函数与状态模型模块
from backend.head import (
    os, time, socket, subprocess, threading, ctypes,
    logging, shutil, List, Dict, Any, Optional, Tuple, Path
)

# 日志记录器
logger = logging.getLogger(__name__)

# 服务端口与通信常量
WRAPPER_DECRYPT_PORT = 10020
WRAPPER_M3U8_PORT = 20020
WRAPPER_ACCOUNT_PORT = 30020
WRAPPER_PORT_CHECK_TIMEOUT_SECONDS = 0.25
HEALTH_CACHE_TTL_SECONDS = 1.0

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

# WSL2与解密组件配置常量
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


# 转义PowerShell单引号字符串
def pssqt(val: str) -> str:
    return "'" + (val or "").replace("'", "''") + "'"


# 读取状态字典副本
def _stcpy(state: Dict[str, Any], lock: threading.RLock) -> Dict[str, Any]:
    with lock:
        payload = dict(state)
        payload["logs"] = list(state.get("logs", []))
        return payload


# 更新状态字典
def _stset(state: Dict[str, Any], lock: threading.RLock, kwargs: Dict[str, Any]) -> None:
    with lock:
        state.update(kwargs)
        state["updated_at"] = time.time()


# 追加状态日志并裁剪上限
def _stlog(state: Dict[str, Any], lock: threading.RLock, max_logs: int, msg: str) -> None:
    text = (msg or "").strip()
    if not text:
        return
    ts = time.strftime("%H:%M:%S")
    line = f"[{ts}] {text}"
    with lock:
        logs = state.setdefault("logs", [])
        logs.append(line)
        if len(logs) > max_logs:
            del logs[: len(logs) - max_logs]
        state["updated_at"] = time.time()


# 读取WSL安装状态副本
def wslstcpy() -> Dict[str, Any]:
    return _stcpy(_wsl2_install_state, _wsl2_install_state_lock)


# 更新WSL安装状态
def wslstset(**kwargs) -> None:
    _stset(_wsl2_install_state, _wsl2_install_state_lock, kwargs)


# 追加WSL安装日志
def wslstlog(msg: str) -> None:
    _stlog(_wsl2_install_state, _wsl2_install_state_lock, 500, msg)


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


# 读取解密组件部署状态副本
def wrprstcpy() -> Dict[str, Any]:
    return _stcpy(_wrapper_setup_state, _wrapper_setup_state_lock)


# 更新解密组件部署状态
def wrprstset(**kwargs) -> None:
    _stset(_wrapper_setup_state, _wrapper_setup_state_lock, kwargs)


# 追加解密组件部署日志
def wrprstlog(msg: str) -> None:
    _stlog(_wrapper_setup_state, _wrapper_setup_state_lock, WRAPPER_STATE_MAX_LOGS, msg)


# 设置全局解密组件子进程
def setwrprprc(proc: Optional[subprocess.Popen]) -> None:
    global _wrapper_process
    with _wrapper_process_lock:
        _wrapper_process = proc


# 获取全局解密组件子进程
def gtwrprprc() -> Optional[subprocess.Popen]:
    with _wrapper_process_lock:
        return _wrapper_process


# 获取解密组件运行健康度状态
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




