from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse, parse_qs
import asyncio
import base64
import ctypes
import ctypes.wintypes
import json
import re
import socket
import os
import sqlite3
import tempfile
import time
import logging
import threading
import httpx
import hashlib
import shutil
import subprocess
import shlex
import unicodedata
import urllib.request
import zipfile
from pathlib import Path

from backend.services.downloader import manager
from backend.core.config import settings
from backend.db.database import (
    get_all_settings, save_settings,
    get_history, delete_history, get_history_by_track_id, insert_history, update_history_lyrics_path,
    report_search, get_recommendations
)
from gamdl.api.constants import APPLE_MUSIC_SEARCH_API_URI

router = APIRouter()
logger = logging.getLogger(__name__)

# Wrapper ports as defined by the gamdl library defaults
WRAPPER_DECRYPT_PORT = 10020   # wrapper_decrypt_ip
WRAPPER_M3U8_PORT    = 20020   # wrapper_m3u8_ip
WRAPPER_ACCOUNT_PORT = 30020   # wrapper account info port
WRAPPER_PORT_CHECK_TIMEOUT_SECONDS = 0.25
HEALTH_CACHE_TTL_SECONDS = 1.0
SEARCH_CATEGORY_KEYS = ("songs", "music-videos", "albums", "artists", "playlists")
FAST_SEARCH_TYPES = "songs,albums,artists,music-videos,playlists"
FAST_SEARCH_LIMIT = 50
FAST_SEARCH_TIMEOUT_SECONDS = 12.0
FAST_SEARCH_DIRECT_TIMEOUT_SECONDS = 8.0
SEARCH_CACHE_TTL_SECONDS = 45.0
SEARCH_CACHE_STALE_SECONDS = 600.0
SEARCH_CACHE_MAX_ENTRIES = 60
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

# {cache_key: (saved_ts, payload)}
_search_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}
# Dedupe same-term concurrent searches from the UI
_search_inflight: Dict[str, "asyncio.Task[Dict[str, Any]]"] = {}
_search_http_client: Optional[httpx.AsyncClient] = None
_health_cache: Optional[tuple[float, Dict[str, Any]]] = None
_health_lock = asyncio.Lock()
_wsl2_install_state_lock = threading.Lock()
_wsl2_install_state: Dict[str, Any] = {
    "status": "idle",         # idle | running | success | error
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
_wrapper_setup_state_lock = threading.Lock()
_wrapper_setup_state: Dict[str, Any] = {
    "status": "idle",          # idle | running | awaiting_input | success | error
    "stage": "idle",
    "running": False,
    "completed": False,
    "success_flag": False,
    "message": "",
    "wsl2_installed": False,
    "wrapper_installed": False,
    "wrapper_running": False,
    "awaiting_input": False,
    "input_type": "",          # credentials | 2fa
    "input_prompt": "",
    "logs": [],
    "updated_at": 0.0,
}
_wrapper_process_lock = threading.Lock()
_wrapper_process: Optional[subprocess.Popen] = None
_wrapper_reader_thread: Optional[threading.Thread] = None
_wrapper_last_output: str = ""
_wrapper_cached_credentials: Optional[tuple[str, str]] = None


def _ps_single_quote(value: str) -> str:
    return "'" + (value or "").replace("'", "''") + "'"


def _wsl2_copy_state() -> Dict[str, Any]:
    with _wsl2_install_state_lock:
        payload = dict(_wsl2_install_state)
        payload["logs"] = list(_wsl2_install_state.get("logs", []))
        return payload


def _wsl2_set_state(**kwargs) -> None:
    with _wsl2_install_state_lock:
        _wsl2_install_state.update(kwargs)
        _wsl2_install_state["updated_at"] = time.time()


def _wsl2_append_log(message: str) -> None:
    text = (message or "").strip()
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


def _is_windows_admin() -> bool:
    if os.name != "nt":
        return False
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def _get_drive_free_gb(drive: str) -> float:
    if os.name != "nt":
        return 0.0
    drive_root = f"{drive.upper()}:\\"
    if not os.path.exists(drive_root):
        return 0.0
    try:
        free_bytes = shutil.disk_usage(drive_root).free
    except Exception:
        return 0.0
    return round(free_bytes / (1024 ** 3), 2)


def _run_capture(command: List[str], timeout_seconds: int = 30) -> tuple[int, str]:
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            encoding="utf-8",
            errors="replace",
        )
        return result.returncode, (result.stdout or "") + "\n" + (result.stderr or "")
    except Exception as e:
        return -1, str(e)


def _query_windows_optional_feature_state(feature_name: str) -> str:
    cmd = [
        "powershell",
        "-NoProfile",
        "-Command",
        f"(Get-WindowsOptionalFeature -Online -FeatureName {feature_name}).State",
    ]
    rc, text = _run_capture(cmd, timeout_seconds=25)
    if rc != 0:
        return ""
    return (text or "").strip()


def _is_feature_enabled(state_text: str) -> bool:
    text = (state_text or "").strip().lower()
    if not text:
        return False
    return ("enabled" in text) or ("已启用" in text) or ("启用" == text)


def _detect_wsl2_installed() -> tuple[bool, str]:
    if os.name != "nt":
        return False, "当前系统非Windows。"

    rc_status, status_text = _run_capture(["wsl", "--status"], timeout_seconds=20)
    status_lower = (status_text or "").lower()
    if rc_status == 0:
        if re.search(r"(default\s*version|默认版本)\s*[:：]\s*2", status_text, flags=re.IGNORECASE):
            return True, "检测到WSL默认版本为2。"
        if "kernel" in status_lower or "内核" in status_text:
            # WSL status is available and kernel info present: treat as installed-ready.
            return True, "检测到WSL状态可用。"

    rc_list, list_text = _run_capture(["wsl", "-l", "-v"], timeout_seconds=25)
    if rc_list == 0:
        for line in (list_text or "").splitlines():
            norm = line.strip().lstrip("*").strip()
            if not norm:
                continue
            if re.search(r"\b2\b", norm):
                return True, "检测到已安装的WSL2发行版。"

    feat_wsl = _query_windows_optional_feature_state("Microsoft-Windows-Subsystem-Linux")
    feat_vm = _query_windows_optional_feature_state("VirtualMachinePlatform")
    if _is_feature_enabled(feat_wsl) and _is_feature_enabled(feat_vm):
        return True, "检测到WSL与VirtualMachinePlatform特性已启用。"

    return False, "未检测到可用的WSL2安装。"


def _build_wsl2_precheck(required_gb: float = WSL2_REQUIRED_FREE_GB) -> Dict[str, Any]:
    required = max(1.0, float(required_gb or WSL2_REQUIRED_FREE_GB))
    already_installed, install_hint = _detect_wsl2_installed()
    d_exists = os.path.exists("D:\\")
    d_free = _get_drive_free_gb("D")
    c_free = _get_drive_free_gb("C")

    selected_drive = ""
    target_path = ""
    use_custom_location = False
    message = ""
    can_install = False

    if already_installed:
        message = "检测到本机已安装WSL2，已判定完成，无需重复安装。"
        return {
            "success": True,
            "can_install": False,
            "already_installed": True,
            "install_hint": install_hint,
            "message": message,
            "required_gb": required,
            "selected_drive": "",
            "target_path": "",
            "use_custom_location": False,
            "d_drive_exists": d_exists,
            "d_free_gb": d_free,
            "c_free_gb": c_free,
            "is_admin": _is_windows_admin(),
        }

    if d_exists and d_free >= required:
        selected_drive = "D"
        target_path = WSL2_D_INSTALL_PATH
        use_custom_location = True
        message = f"检测通过，将安装到 {target_path}（D盘剩余 {d_free:.2f} GB）。"
        can_install = True
    elif c_free >= required:
        selected_drive = "C"
        target_path = "C盘默认位置"
        use_custom_location = False
        if d_exists:
            message = (
                f"D盘剩余空间不足（{d_free:.2f} GB），"
                f"将回退到C盘默认位置（剩余 {c_free:.2f} GB）。"
            )
        else:
            message = f"D盘不存在，将安装到C盘默认位置（剩余 {c_free:.2f} GB）。"
        can_install = True
    else:
        message = (
            f"剩余空间不足：D盘 {d_free:.2f} GB，C盘 {c_free:.2f} GB，"
            f"至少需要 {required:.2f} GB 可用空间。"
        )

    return {
        "success": can_install,
        "can_install": can_install,
        "already_installed": False,
        "install_hint": install_hint,
        "message": message,
        "required_gb": required,
        "selected_drive": selected_drive,
        "target_path": target_path,
        "use_custom_location": use_custom_location,
        "d_drive_exists": d_exists,
        "d_free_gb": d_free,
        "c_free_gb": c_free,
        "is_admin": _is_windows_admin(),
    }


def _run_command_with_logs(command: List[str], timeout_seconds: int = 3600) -> int:
    if os.name == "nt":
        creation_flags = int(getattr(subprocess, "CREATE_NO_WINDOW", 0))
    else:
        creation_flags = 0

    _wsl2_append_log("执行命令: " + " ".join(command))
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        creationflags=creation_flags,
    )
    start_ts = time.time()
    try:
        while True:
            if process.stdout is None:
                break
            line = process.stdout.readline()
            if line:
                _wsl2_append_log(line.rstrip())
            elif process.poll() is not None:
                break

            if timeout_seconds and (time.time() - start_ts) > timeout_seconds:
                process.kill()
                _wsl2_append_log("命令执行超时，已终止。")
                return -1
    finally:
        if process.stdout:
            try:
                process.stdout.close()
            except Exception:
                pass

    return process.wait()


def _list_wsl_distros() -> List[str]:
    try:
        result = subprocess.run(
            ["wsl", "-l", "-q"],
            capture_output=True,
            text=True,
            timeout=20,
            encoding="utf-8",
            errors="replace",
        )
    except Exception:
        return []
    if result.returncode != 0:
        return []
    lines = []
    for raw in (result.stdout or "").splitlines():
        item = raw.strip().lstrip("*").strip()
        if item:
            lines.append(item)
    return lines


def _has_ubuntu_distro() -> bool:
    distros = _list_wsl_distros()
    target = WSL2_UBUNTU_DISTRO.lower()
    return any(target in distro.lower() for distro in distros)


def _mark_wsl2_failed(message: str) -> None:
    _wsl2_append_log(message)
    _wsl2_set_state(
        status="error",
        stage="failed",
        running=False,
        completed=True,
        success_flag=False,
        message=message,
    )


def _build_elevated_wsl2_installer_script(
    script_path: Path,
    log_path: Path,
    status_path: Path,
    precheck: Dict[str, Any],
) -> None:
    log_literal = _ps_single_quote(str(log_path))
    status_literal = _ps_single_quote(str(status_path))
    target_literal = _ps_single_quote(str(precheck.get("target_path") or ""))
    distro_literal = _ps_single_quote(WSL2_UBUNTU_DISTRO)
    use_custom_literal = "$true" if precheck.get("use_custom_location") else "$false"

    content = f"""$ErrorActionPreference = 'Stop'
$LogPath = {log_literal}
$StatusPath = {status_literal}
$TargetPath = {target_literal}
$Distro = {distro_literal}
$UseCustomLocation = {use_custom_literal}

function Add-Log([string]$Message) {{
  if ([string]::IsNullOrWhiteSpace($Message)) {{ return }}
  $line = "[" + (Get-Date -Format "HH:mm:ss") + "] " + $Message
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}}

function Write-State([string]$Status, [string]$Stage, [bool]$Completed, [bool]$SuccessFlag, [string]$Message) {{
  $obj = [ordered]@{{
    status = $Status
    stage = $Stage
    completed = $Completed
    success_flag = $SuccessFlag
    message = $Message
    updated_at = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  }}
  $obj | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $StatusPath -Encoding UTF8
}}

function Invoke-Native([string]$Exe, [string[]]$Args) {{
  Add-Log ("执行命令: " + $Exe + " " + ($Args -join " "))
  & $Exe @Args
  $code = $LASTEXITCODE
  if ($code -ne 0) {{
    throw "命令执行失败，退出码: $code"
  }}
}}

try {{
  New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($LogPath)) | Out-Null
  New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($StatusPath)) | Out-Null

  Add-Log "已进入管理员安装流程。"
  Write-State "running" "check-wsl" $false $false "检查WSL环境"

  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {{
    throw "系统未找到wsl命令，请检查Windows版本与组件状态。"
  }}

  $distros = wsl -l -q 2>$null | ForEach-Object {{ $_.Trim() }} | Where-Object {{ $_ }}
  $hasUbuntu = $false
  foreach ($d in $distros) {{
    if ($d.ToLower().Contains($Distro.ToLower())) {{
      $hasUbuntu = $true
      break
    }}
  }}

  if (-not $hasUbuntu) {{
    Write-State "running" "install-ubuntu" $false $false "安装Ubuntu发行版"
    $variants = @()
    if ($UseCustomLocation -and -not [string]::IsNullOrWhiteSpace($TargetPath)) {{
      New-Item -ItemType Directory -Force -Path $TargetPath | Out-Null
      $variants += ,@('--install', '-d', $Distro, '--no-launch', '--web-download', '--location', $TargetPath)
      $variants += ,@('--install', '-d', $Distro, '--location', $TargetPath)
    }}
    $variants += ,@('--install', '-d', $Distro, '--no-launch', '--web-download')
    $variants += ,@('--install', '-d', $Distro)

    $ok = $false
    foreach ($argv in $variants) {{
      try {{
        Invoke-Native 'wsl.exe' $argv
        $ok = $true
        break
      }} catch {{
        Add-Log ("安装命令失败，尝试下一个参数组合。详情: " + $_.Exception.Message)
      }}
    }}

    if (-not $ok) {{
      throw "WSL2/Ubuntu 安装失败，请检查系统日志。"
    }}
  }} else {{
    Add-Log "检测到Ubuntu发行版已存在，跳过安装步骤。"
  }}

  Write-State "running" "configure-root" $false $false "配置默认root用户与密码"
  Invoke-Native 'wsl.exe' @('-d', $Distro, '-u', 'root', '--', 'bash', '-lc', "echo 'root:root' | chpasswd")
  Invoke-Native 'wsl.exe' @('-d', $Distro, '-u', 'root', '--', 'bash', '-lc', "printf '[user]\\ndefault=root\\n' > /etc/wsl.conf")
  Invoke-Native 'wsl.exe' @('--shutdown')
  Invoke-Native 'wsl.exe' @('-d', $Distro, '-u', 'root', '--', 'bash', '-lc', 'id -un')

  Write-State "running" "health-check" $false $false "执行最终健康检查"
  $distrosFinal = wsl -l -q 2>$null | ForEach-Object {{ $_.Trim() }} | Where-Object {{ $_ }}
  $hasUbuntuFinal = $false
  foreach ($d in $distrosFinal) {{
    if ($d.ToLower().Contains($Distro.ToLower())) {{
      $hasUbuntuFinal = $true
      break
    }}
  }}
  if (-not $hasUbuntuFinal) {{
    throw "最终检查失败：未检测到Ubuntu发行版。"
  }}

  Add-Log "WSL2与Ubuntu安装配置完成。"
  Write-State "success" "completed" $true $true "WSL2与Ubuntu安装配置完成。"
}} catch {{
  Add-Log ("安装流程异常: " + $_.Exception.Message)
  Write-State "error" "failed" $true $false ("安装流程异常: " + $_.Exception.Message)
}}
"""
    script_path.write_text(content, encoding="utf-8")


def _try_launch_elevated_installer(script_path: Path) -> tuple[bool, str]:
    arg_str = f'-NoProfile -ExecutionPolicy Bypass -File "{script_path}"'
    ps_cmd = (
        "Start-Process -FilePath 'powershell.exe' "
        f"-Verb RunAs -WindowStyle Hidden -ArgumentList { _ps_single_quote(arg_str) }"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=30,
            encoding="utf-8",
            errors="replace",
        )
    except Exception as e:
        return False, f"提权进程启动异常: {e}"

    if result.returncode != 0:
        detail = ((result.stdout or "") + "\n" + (result.stderr or "")).strip()
        return False, detail or "提权请求失败或被取消。"
    return True, ""


def _read_log_increment(log_path: Path, offset: int) -> tuple[int, List[str]]:
    if not log_path.exists() or not log_path.is_file():
        return offset, []
    try:
        with log_path.open("r", encoding="utf-8", errors="replace") as f:
            f.seek(offset)
            chunk = f.read()
            new_offset = f.tell()
    except Exception:
        return offset, []

    if not chunk:
        return new_offset, []
    lines = [line.strip() for line in chunk.splitlines() if line.strip()]
    return new_offset, lines


def _run_elevated_wsl2_installer(precheck: Dict[str, Any]) -> bool:
    runtime_dir = Path(tempfile.gettempdir()) / "lingomusic_wsl2_install"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    task_id = str(int(time.time() * 1000))
    script_path = runtime_dir / f"install_{task_id}.ps1"
    log_path = runtime_dir / f"install_{task_id}.log"
    status_path = runtime_dir / f"install_{task_id}.status.json"

    _build_elevated_wsl2_installer_script(script_path, log_path, status_path, precheck)
    _wsl2_set_state(stage="request-elevation")
    _wsl2_append_log("正在请求管理员权限（UAC）...")
    ok, err_text = _try_launch_elevated_installer(script_path)
    if not ok:
        _mark_wsl2_failed("管理员提权失败或被取消。 " + (err_text or ""))
        return False

    _wsl2_append_log("已启动管理员安装进程，等待执行结果...")
    _wsl2_set_state(stage="running-elevated")

    start_ts = time.time()
    last_offset = 0
    last_stage = ""
    while True:
        last_offset, new_lines = _read_log_increment(log_path, last_offset)
        for line in new_lines:
            _wsl2_append_log(line)

        if status_path.exists():
            try:
                payload = json.loads(status_path.read_text(encoding="utf-8"))
            except Exception:
                payload = {}
            if payload:
                stage = str(payload.get("stage") or "")
                message = str(payload.get("message") or "")
                status = str(payload.get("status") or "")
                completed = bool(payload.get("completed"))
                success_flag = bool(payload.get("success_flag"))

                if stage and stage != last_stage:
                    _wsl2_set_state(stage=stage)
                    last_stage = stage
                if message:
                    _wsl2_set_state(message=message)

                if completed:
                    _wsl2_set_state(
                        status="success" if success_flag else "error",
                        stage=stage or ("completed" if success_flag else "failed"),
                        running=False,
                        completed=True,
                        success_flag=success_flag,
                        message=message or ("WSL2与Ubuntu安装配置完成。" if success_flag else "安装失败"),
                    )
                    if success_flag:
                        _wsl2_append_log("管理员安装流程已完成。")
                    else:
                        _wsl2_append_log("管理员安装流程失败。")
                    return success_flag

        if (time.time() - start_ts) > 60 * 90:
            _mark_wsl2_failed("安装超时，请重试或手动安装WSL2。")
            return False

        time.sleep(1.0)


def _wsl2_install_worker(precheck: Dict[str, Any]) -> None:
    try:
        if os.name != "nt":
            _mark_wsl2_failed("当前系统非Windows，无法安装WSL2。")
            return

        _wsl2_set_state(stage="precheck", running=True, completed=False, status="running")
        _wsl2_append_log("开始执行WSL2安装任务。")

        if bool(precheck.get("already_installed")):
            _wsl2_set_state(
                status="success",
                stage="completed",
                running=False,
                completed=True,
                success_flag=True,
                message="检测到本机已安装WSL2，无需重复安装。",
            )
            _wsl2_append_log("检测到本机已安装WSL2，安装流程已跳过。")
            return

        if not _is_windows_admin():
            _wsl2_append_log("当前非管理员权限，将尝试发起UAC提权安装。")
            _run_elevated_wsl2_installer(precheck)
            return

        _wsl2_set_state(stage="check-wsl")
        check_cmd = subprocess.run(
            ["wsl", "--status"],
            capture_output=True,
            text=True,
            timeout=20,
            encoding="utf-8",
            errors="replace",
        )
        if check_cmd.returncode != 0 and "WSL" not in (check_cmd.stdout + check_cmd.stderr):
            _wsl2_append_log("未检测到可用WSL命令，尝试继续执行安装。")
        else:
            _wsl2_append_log("已检测到WSL命令可用。")

        if _has_ubuntu_distro():
            _wsl2_append_log("检测到Ubuntu发行版已存在，跳过安装步骤。")
        else:
            _wsl2_set_state(stage="install-ubuntu")
            install_candidates: List[List[str]] = []
            if precheck.get("use_custom_location"):
                target_path = str(precheck.get("target_path") or WSL2_D_INSTALL_PATH)
                try:
                    os.makedirs(target_path, exist_ok=True)
                except Exception as e:
                    _wsl2_append_log(f"创建安装目录失败，将继续安装: {e}")
                install_candidates.extend([
                    ["wsl", "--install", "-d", WSL2_UBUNTU_DISTRO, "--no-launch", "--web-download", "--location", target_path],
                    ["wsl", "--install", "-d", WSL2_UBUNTU_DISTRO, "--location", target_path],
                ])
            install_candidates.extend([
                ["wsl", "--install", "-d", WSL2_UBUNTU_DISTRO, "--no-launch", "--web-download"],
                ["wsl", "--install", "-d", WSL2_UBUNTU_DISTRO],
            ])

            install_ok = False
            for cmd in install_candidates:
                rc = _run_command_with_logs(cmd, timeout_seconds=5400)
                if rc == 0:
                    install_ok = True
                    break
                _wsl2_append_log(f"安装命令返回码 {rc}，尝试下一组参数。")

            if not install_ok:
                _mark_wsl2_failed("WSL2/Ubuntu 安装失败，请检查系统日志或手动执行 `wsl --install`。")
                return

            for _ in range(20):
                if _has_ubuntu_distro():
                    break
                time.sleep(1.2)
            if not _has_ubuntu_distro():
                _mark_wsl2_failed("安装完成后未检测到Ubuntu发行版，可能需要重启系统后重试。")
                return
            _wsl2_append_log("Ubuntu发行版安装完成。")

        _wsl2_set_state(stage="configure-root")
        _wsl2_append_log("开始配置默认用户与密码（root/root）。")
        config_commands = [
            ["wsl", "-d", WSL2_UBUNTU_DISTRO, "-u", "root", "--", "bash", "-lc", "echo 'root:root' | chpasswd"],
            ["wsl", "-d", WSL2_UBUNTU_DISTRO, "-u", "root", "--", "bash", "-lc", "printf '[user]\\ndefault=root\\n' > /etc/wsl.conf"],
            ["wsl", "--shutdown"],
            ["wsl", "-d", WSL2_UBUNTU_DISTRO, "-u", "root", "--", "bash", "-lc", "id -un"],
        ]
        for cmd in config_commands:
            rc = _run_command_with_logs(cmd, timeout_seconds=180)
            if rc != 0:
                _mark_wsl2_failed("WSL2配置步骤失败，请确认Ubuntu可正常启动后重试。")
                return

        _wsl2_set_state(stage="health-check")
        _wsl2_append_log("执行最终健康检查。")
        if not _has_ubuntu_distro():
            _mark_wsl2_failed("最终检查失败：未检测到Ubuntu发行版。")
            return

        _wsl2_set_state(
            status="success",
            stage="completed",
            running=False,
            completed=True,
            success_flag=True,
            message="WSL2与Ubuntu安装配置完成。",
        )
        _wsl2_append_log("WSL2与Ubuntu安装配置完成。")
    except Exception as e:
        logger.exception("WSL2 install worker failed")
        _mark_wsl2_failed(f"安装流程异常：{e}")


def _wrapper_copy_state() -> Dict[str, Any]:
    with _wrapper_setup_state_lock:
        payload = dict(_wrapper_setup_state)
        payload["logs"] = list(_wrapper_setup_state.get("logs", []))
        return payload


def _wrapper_set_state(**kwargs) -> None:
    with _wrapper_setup_state_lock:
        _wrapper_setup_state.update(kwargs)
        _wrapper_setup_state["updated_at"] = time.time()


def _wrapper_append_log(message: str) -> None:
    text = (message or "").strip()
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


def _resolve_wrapper_dir() -> Path:
    candidates = [
        Path(settings.BASE_DIR) / "backend" / "wsl_wrapper",
        Path(settings.BASE_DIR) / "wsl_wrapper",
        Path(__file__).resolve().parents[1] / "wsl_wrapper",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def _resolve_wrapper_binary_path() -> Path:
    return _resolve_wrapper_dir() / "wrapper"


def _resolve_wrapper_session_db_path() -> Path:
    return _resolve_wrapper_dir() / WRAPPER_SESSION_DB_RELATIVE_PATH


def _windows_path_to_wsl_path(path_obj: Path) -> str:
    path_str = str(path_obj.resolve())
    drive, tail = os.path.splitdrive(path_str)
    if not drive:
        raise RuntimeError(f"无法将路径转换为WSL路径: {path_str}")
    drive_letter = drive[0].lower()
    tail = tail.replace("\\", "/").lstrip("/")
    return f"/mnt/{drive_letter}/{tail}"


def _is_wrapper_installed() -> bool:
    wrapper_binary = _resolve_wrapper_binary_path()
    return wrapper_binary.exists() and wrapper_binary.is_file() and wrapper_binary.stat().st_size > 0


def _is_wrapper_running() -> bool:
    return (
        _check_port("127.0.0.1", WRAPPER_DECRYPT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
        and _check_port("127.0.0.1", WRAPPER_M3U8_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
        and _check_port("127.0.0.1", WRAPPER_ACCOUNT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
    )


def _set_wrapper_process(process: Optional[subprocess.Popen]) -> None:
    global _wrapper_process
    with _wrapper_process_lock:
        _wrapper_process = process


def _get_wrapper_process() -> Optional[subprocess.Popen]:
    with _wrapper_process_lock:
        return _wrapper_process


def _stop_wrapper_service() -> None:
    process = _get_wrapper_process()
    if process and process.poll() is None:
        try:
            process.terminate()
            process.wait(timeout=5)
            _wrapper_append_log("已终止当前Wrapper进程。")
        except Exception:
            try:
                process.kill()
                _wrapper_append_log("已强制结束当前Wrapper进程。")
            except Exception:
                pass
    _set_wrapper_process(None)

    # Best-effort: kill wrapper process inside WSL in case it was launched externally.
    _run_capture(
        ["wsl", "-e", "bash", "-lc", "pkill -f '/wrapper' >/dev/null 2>&1 || true"],
        timeout_seconds=20,
    )
    _run_capture(
        ["wsl", "-e", "bash", "-lc", "pkill -f 'wrapper -H 0.0.0.0' >/dev/null 2>&1 || true"],
        timeout_seconds=20,
    )

    for _ in range(20):
        if not (
            _check_port("127.0.0.1", WRAPPER_DECRYPT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
            or _check_port("127.0.0.1", WRAPPER_M3U8_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
            or _check_port("127.0.0.1", WRAPPER_ACCOUNT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
        ):
            break
        time.sleep(0.3)


def _mark_wrapper_failed(message: str) -> None:
    _wrapper_append_log(message)
    _wrapper_set_state(
        status="error",
        stage="failed",
        running=False,
        completed=True,
        success_flag=False,
        awaiting_input=False,
        input_type="",
        input_prompt="",
        wrapper_running=_is_wrapper_running(),
        message=message,
    )


def _mark_wrapper_success(message: str) -> None:
    _wrapper_append_log(message)
    _wrapper_set_state(
        status="success",
        stage="completed",
        running=False,
        completed=True,
        success_flag=True,
        awaiting_input=False,
        input_type="",
        input_prompt="",
        wrapper_running=True,
        message=message,
    )


def _request_wrapper_input(input_type: str, prompt: str) -> None:
    state = _wrapper_copy_state()
    if state.get("awaiting_input") and state.get("input_type") == input_type:
        return

    _wrapper_append_log(prompt)
    _wrapper_set_state(
        status="awaiting_input",
        stage=f"await-{input_type}",
        running=False,
        completed=False,
        success_flag=False,
        awaiting_input=True,
        input_type=input_type,
        input_prompt=prompt,
        wrapper_running=False,
        message=prompt,
    )


def _detect_wrapper_prompt_type(text: str) -> Optional[str]:
    lower = (text or "").strip().lower()
    if not lower:
        return None

    twofa_keywords = (
        "2fa",
        "two-factor",
        "verification code",
        "security code",
        "one-time code",
        "otp",
        "验证码",
        "动态码",
        "验证代码",
    )
    if any(keyword in lower for keyword in twofa_keywords):
        return "2fa"

    credential_keywords = (
        "apple id",
        "appleid",
        "username",
        "email",
        "password",
        "账号",
        "邮箱",
        "密码",
        "login required",
    )
    if any(keyword in lower for keyword in credential_keywords):
        return "credentials"

    if "must be set" in lower and "password" in lower:
        return "credentials"

    return None


def _handle_wrapper_output_text(text: str) -> None:
    global _wrapper_last_output
    cleaned = (text or "").strip()
    if not cleaned:
        return

    _wrapper_last_output = cleaned
    _wrapper_append_log(cleaned)

    prompt_type = _detect_wrapper_prompt_type(cleaned)
    if prompt_type == "2fa":
        _request_wrapper_input("2fa", "检测到Wrapper需要2FA验证码，请输入验证码后继续。")
    elif prompt_type == "credentials":
        _request_wrapper_input("credentials", "检测到Wrapper等待Apple ID与密码，请输入后继续。")


def _wrapper_output_reader(process: subprocess.Popen) -> None:
    stream = process.stdout
    if stream is None:
        return

    carry = ""
    try:
        while True:
            chunk = stream.read(64)
            if not chunk:
                break
            carry += chunk

            while True:
                match = re.search(r"[\r\n]", carry)
                if not match:
                    break
                line = carry[: match.start()]
                carry = carry[match.end():]
                if line.strip():
                    _handle_wrapper_output_text(line)

            tail = carry[-220:]
            prompt_type = _detect_wrapper_prompt_type(tail)
            if prompt_type == "2fa":
                _request_wrapper_input("2fa", "检测到Wrapper需要2FA验证码，请输入验证码后继续。")
            elif prompt_type == "credentials":
                _request_wrapper_input("credentials", "检测到Wrapper等待Apple ID与密码，请输入后继续。")
    except Exception as e:
        _wrapper_append_log(f"读取Wrapper输出流异常: {e}")
    finally:
        if carry.strip():
            _handle_wrapper_output_text(carry)


def _start_wrapper_output_reader(process: subprocess.Popen) -> None:
    global _wrapper_reader_thread
    thread = threading.Thread(target=_wrapper_output_reader, args=(process,), daemon=True)
    _wrapper_reader_thread = thread
    thread.start()


def _ensure_wrapper_installed() -> tuple[bool, str]:
    wrapper_dir = _resolve_wrapper_dir()
    wrapper_binary = _resolve_wrapper_binary_path()
    wrapper_dir.mkdir(parents=True, exist_ok=True)

    if not _is_wrapper_installed():
        _wrapper_set_state(stage="download-wrapper", message="正在下载Wrapper组件...")
        _wrapper_append_log("未检测到本地Wrapper，开始下载。")
        zip_path = wrapper_dir / "wrapper.zip"
        try:
            urllib.request.urlretrieve(WRAPPER_RELEASE_ZIP_URL, str(zip_path))
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(wrapper_dir)
            if zip_path.exists():
                zip_path.unlink(missing_ok=True)
        except Exception as e:
            return False, f"下载Wrapper失败: {e}"

        if not wrapper_binary.exists():
            candidates = [
                path for path in wrapper_dir.rglob("*")
                if path.is_file() and path.name.lower() == "wrapper"
            ]
            if candidates:
                try:
                    shutil.copy2(candidates[0], wrapper_binary)
                except Exception as e:
                    return False, f"复制Wrapper二进制文件失败: {e}"

        if not wrapper_binary.exists():
            return False, "下载完成但未找到wrapper可执行文件。"

        _wrapper_append_log("Wrapper下载完成。")
    else:
        _wrapper_append_log("检测到本地Wrapper已存在，跳过下载。")

    try:
        wrapper_binary_wsl = _windows_path_to_wsl_path(wrapper_binary)
    except Exception as e:
        return False, f"Wrapper路径转换失败: {e}"

    chmod_cmd = f"chmod +x {shlex.quote(wrapper_binary_wsl)}"
    rc, output = _run_capture(["wsl", "-e", "bash", "-lc", chmod_cmd], timeout_seconds=20)
    if rc != 0:
        reason = (output or "").strip()
        return False, f"设置Wrapper执行权限失败: {reason}"
    _wrapper_append_log("Wrapper执行权限已就绪。")
    return True, ""


def _launch_wrapper_process(use_cached_credentials: bool = False) -> tuple[Optional[subprocess.Popen], str]:
    wrapper_dir = _resolve_wrapper_dir()
    wrapper_binary = _resolve_wrapper_binary_path()
    if not wrapper_binary.exists():
        return None, "Wrapper可执行文件不存在。"

    try:
        wrapper_dir_wsl = _windows_path_to_wsl_path(wrapper_dir)
    except Exception as e:
        return None, f"Wrapper目录路径转换失败: {e}"

    login_part = ""
    log_login_part = ""
    if use_cached_credentials and _wrapper_cached_credentials:
        apple_id, password = _wrapper_cached_credentials
        login_pair = f"{apple_id}:{password}"
        login_part = f" -L {shlex.quote(login_pair)}"
        log_login_part = " -L <masked>"

    shell_cmd = f"cd {shlex.quote(wrapper_dir_wsl)} && ./wrapper{login_part} -H 0.0.0.0"
    _wrapper_append_log(f"启动命令: ./wrapper{log_login_part} -H 0.0.0.0")

    creation_flags = int(getattr(subprocess, "CREATE_NO_WINDOW", 0)) if os.name == "nt" else 0
    try:
        process = subprocess.Popen(
            ["wsl", "-e", "bash", "-lc", shell_cmd],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            creationflags=creation_flags,
        )
    except Exception as e:
        return None, f"启动Wrapper进程失败: {e}"

    _set_wrapper_process(process)
    _start_wrapper_output_reader(process)
    return process, ""


def _wait_wrapper_ready_or_prompt(timeout_seconds: int) -> str:
    start_ts = time.time()
    prompt_seen_at: Optional[float] = None
    while True:
        state = _wrapper_copy_state()

        if _is_wrapper_running():
            _mark_wrapper_success("Wrapper正在运行。")
            return "running"

        if state.get("awaiting_input"):
            if prompt_seen_at is None:
                prompt_seen_at = time.time()
            # Guard against transient prompt-like log lines during startup.
            if (time.time() - prompt_seen_at) >= 8.0:
                return "awaiting_input"
        else:
            prompt_seen_at = None

        process = _get_wrapper_process()
        if process is None:
            _mark_wrapper_failed("Wrapper进程未启动。")
            return "error"

        return_code = process.poll()
        if return_code is not None:
            if _is_wrapper_running():
                _mark_wrapper_success("Wrapper正在运行。")
                return "running"

            state_now = _wrapper_copy_state()
            if state_now.get("awaiting_input"):
                return "awaiting_input"

            detail = _wrapper_last_output.strip()
            message = f"Wrapper进程已退出（退出码 {return_code}）。"
            if detail:
                message += f" 最近输出：{detail}"
            _mark_wrapper_failed(message)
            return "error"

        if (time.time() - start_ts) > timeout_seconds:
            _mark_wrapper_failed("等待Wrapper启动超时，请查看日志并重试。")
            return "error"

        time.sleep(0.6)


def _build_wrapper_precheck() -> Dict[str, Any]:
    wsl2_installed, wsl_hint = _detect_wsl2_installed()
    wrapper_installed = _is_wrapper_installed()
    wrapper_running = _is_wrapper_running()
    session_db_exists = _resolve_wrapper_session_db_path().exists()

    if not wsl2_installed:
        message = "请先安装WSL2。"
    elif wrapper_running:
        message = "检测到Wrapper正在运行，初始化时将执行重启与状态校验。"
    elif wrapper_installed:
        message = "检测到Wrapper已安装，可直接启动并登录。"
    else:
        message = "未检测到Wrapper，启动时将自动下载并安装。"

    return {
        "success": True,
        "can_start": bool(wsl2_installed),
        "wsl2_installed": bool(wsl2_installed),
        "wsl2_hint": wsl_hint,
        "wrapper_installed": wrapper_installed,
        "wrapper_running": wrapper_running,
        "session_db_exists": session_db_exists,
        "message": message,
    }


def _wrapper_start_or_monitor_worker(
    launch_new: bool,
    use_cached_credentials: bool = False,
    force_restart: bool = False,
) -> None:
    try:
        _wrapper_set_state(
            status="running",
            stage="precheck",
            running=True,
            completed=False,
            success_flag=False,
            awaiting_input=False,
            input_type="",
            input_prompt="",
            message="正在检查Wrapper运行环境...",
        )
        _wrapper_append_log("开始执行Wrapper安装/启动流程。")

        wsl2_installed, _wsl_hint = _detect_wsl2_installed()
        if not wsl2_installed:
            _mark_wrapper_failed("请先安装WSL2。")
            return
        _wrapper_set_state(wsl2_installed=True)

        if force_restart:
            _wrapper_set_state(stage="restart-wrapper", message="检测到初始化请求，正在重启Wrapper服务...")
            _wrapper_append_log("检测到初始化请求：即使Wrapper已运行也将强制重启。")
            _stop_wrapper_service()

        if _is_wrapper_running():
            _mark_wrapper_success("Wrapper正在运行。")
            return

        if not _is_wrapper_installed():
            ok, install_error = _ensure_wrapper_installed()
            if not ok:
                _mark_wrapper_failed(install_error or "下载Wrapper失败。")
                return
        _wrapper_set_state(wrapper_installed=_is_wrapper_installed())

        if _is_wrapper_running():
            _mark_wrapper_success("Wrapper正在运行。")
            return

        process: Optional[subprocess.Popen] = None
        if launch_new:
            _wrapper_set_state(stage="start-wrapper", message="正在启动Wrapper服务...")
            process, launch_error = _launch_wrapper_process(use_cached_credentials=use_cached_credentials)
            if not process:
                _mark_wrapper_failed(launch_error or "启动Wrapper服务失败。")
                return
        else:
            process = _get_wrapper_process()
            if process is None or process.poll() is not None:
                if use_cached_credentials and _wrapper_cached_credentials:
                    _wrapper_set_state(stage="restart-wrapper", message="正在使用已提交账号重启Wrapper...")
                    process, launch_error = _launch_wrapper_process(use_cached_credentials=True)
                    if not process:
                        _mark_wrapper_failed(launch_error or "重启Wrapper服务失败。")
                        return
                else:
                    _request_wrapper_input("credentials", "Wrapper需要登录，请输入Apple ID与密码。")
                    return

        timeout_seconds = WRAPPER_SETUP_TIMEOUT_SECONDS if launch_new else WRAPPER_STARTUP_GRACE_SECONDS
        outcome = _wait_wrapper_ready_or_prompt(timeout_seconds=timeout_seconds)
        if outcome == "awaiting_input":
            _wrapper_set_state(
                running=False,
                completed=False,
                success_flag=False,
                wrapper_running=False,
                wrapper_installed=_is_wrapper_installed(),
                wsl2_installed=True,
            )
            return
        return
    except Exception as e:
        logger.exception("Wrapper setup worker failed")
        _mark_wrapper_failed(f"Wrapper流程异常：{e}")


def _start_wrapper_worker(
    *,
    launch_new: bool,
    use_cached_credentials: bool = False,
    force_restart: bool = False,
    reset_logs: bool = False,
) -> bool:
    with _wrapper_setup_state_lock:
        if _wrapper_setup_state.get("running"):
            return False
        if reset_logs:
            _wrapper_setup_state["logs"] = []
        _wrapper_setup_state.update({
            "status": "running",
            "stage": "queued",
            "running": True,
            "completed": False,
            "success_flag": False,
            "awaiting_input": False,
            "input_type": "",
            "input_prompt": "",
            "message": "任务已启动。",
            "updated_at": time.time(),
        })

    worker = threading.Thread(
        target=_wrapper_start_or_monitor_worker,
        kwargs={
            "launch_new": launch_new,
            "use_cached_credentials": use_cached_credentials,
            "force_restart": force_restart,
        },
        daemon=True,
    )
    worker.start()
    return True


def _send_wrapper_input_lines(lines: List[str]) -> tuple[bool, str]:
    process = _get_wrapper_process()
    if process is None or process.poll() is not None:
        return False, "当前Wrapper进程未运行或已退出。"
    if process.stdin is None:
        return False, "Wrapper进程输入流不可用。"

    try:
        for line in lines:
            process.stdin.write(f"{line}\n")
        process.stdin.flush()
        return True, ""
    except Exception as e:
        return False, f"写入Wrapper输入流失败: {e}"


def _is_apple_cookie_domain(domain: str) -> bool:
    host = (domain or "").strip().lower()
    return any(keyword in host for keyword in COOKIE_SEARCH_DOMAIN_KEYWORDS)


def _chrome_expires_to_unix_seconds(expires_utc: Any) -> int:
    try:
        expires = int(expires_utc)
    except Exception:
        return 0
    if expires <= 0:
        return 0
    return max(0, int(expires / 1_000_000) - WEBKIT_EPOCH_DELTA_SECONDS)


def _score_cookie_text(text: str) -> int:
    if not text:
        return 0
    text = text.strip()
    if not text:
        return 0

    printable_ratio = sum(1 for ch in text if ch.isprintable()) / len(text)
    score = int(printable_ratio * 100) + min(30, len(text))
    if re.fullmatch(r"[A-Za-z0-9._\-+/=:%]+", text):
        score += 40
    if text.startswith("eyJ"):
        score += 20
    return score


def _decode_cookie_value_bytes(raw: bytes) -> str:
    if not raw:
        return ""

    candidates = [raw]
    if len(raw) > 32:
        candidates.append(raw[32:])

    best_text = ""
    best_score = -1
    for candidate in candidates:
        for encoding in ("utf-8", "latin-1"):
            try:
                decoded = candidate.decode(encoding).strip("\x00\r\n\t ")
            except Exception:
                continue
            score = _score_cookie_text(decoded)
            if score > best_score:
                best_score = score
                best_text = decoded

    return best_text


class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", ctypes.wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_byte)),
    ]


def _dpapi_unprotect(encrypted: bytes) -> bytes:
    if not encrypted:
        return b""
    if os.name != "nt":
        raise RuntimeError("DPAPI is only available on Windows")

    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    crypt32.CryptUnprotectData.argtypes = [
        ctypes.POINTER(_DataBlob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.wintypes.DWORD,
        ctypes.POINTER(_DataBlob),
    ]
    crypt32.CryptUnprotectData.restype = ctypes.wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p

    in_bytes = (ctypes.c_byte * len(encrypted)).from_buffer_copy(encrypted)
    blob_in = _DataBlob(len(encrypted), ctypes.cast(in_bytes, ctypes.POINTER(ctypes.c_byte)))
    blob_out = _DataBlob()

    ok = crypt32.CryptUnprotectData(
        ctypes.byref(blob_in),
        None,
        None,
        None,
        None,
        0,
        ctypes.byref(blob_out),
    )
    if not ok:
        raise ctypes.WinError()

    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        if blob_out.pbData:
            kernel32.LocalFree(blob_out.pbData)


def _load_chromium_master_key(local_state_path: Path) -> Optional[bytes]:
    if not local_state_path.exists() or not local_state_path.is_file():
        return None

    try:
        payload = json.loads(local_state_path.read_text(encoding="utf-8"))
        encrypted_key_b64 = (
            payload.get("os_crypt", {}) if isinstance(payload, dict) else {}
        ).get("encrypted_key")
        if not encrypted_key_b64:
            return None

        encrypted_key = base64.b64decode(encrypted_key_b64)
        if encrypted_key.startswith(b"DPAPI"):
            encrypted_key = encrypted_key[5:]
        return _dpapi_unprotect(encrypted_key)
    except Exception as e:
        logger.warning("Failed to load Chromium master key from %s: %s", local_state_path, e)
        return None


def _decrypt_chromium_cookie_value(raw_value: str, encrypted_value: bytes, master_key: Optional[bytes]) -> str:
    if raw_value:
        return raw_value

    if not encrypted_value:
        return ""

    prefix = encrypted_value[:3]
    if prefix in {b"v10", b"v11", b"v20"} and master_key and len(encrypted_value) > 31:
        try:
            from Crypto.Cipher import AES

            nonce = encrypted_value[3:15]
            ciphertext = encrypted_value[15:-16]
            tag = encrypted_value[-16:]
            cipher = AES.new(master_key, AES.MODE_GCM, nonce=nonce)
            decrypted = cipher.decrypt_and_verify(ciphertext, tag)
            return _decode_cookie_value_bytes(decrypted)
        except Exception:
            # Fallback below will try classic DPAPI decrypt if possible.
            pass

    try:
        return _decode_cookie_value_bytes(_dpapi_unprotect(encrypted_value))
    except Exception:
        return ""


def _to_netscape_cookie_line(cookie: Dict[str, Any]) -> str:
    domain = str(cookie.get("domain") or "").strip()
    include_subdomain = "TRUE" if domain.startswith(".") else "FALSE"
    path = str(cookie.get("path") or "/")
    secure = "TRUE" if bool(cookie.get("secure")) else "FALSE"
    expiry = str(int(cookie.get("expiry") or 0))
    name = str(cookie.get("name") or "")
    value = str(cookie.get("value") or "")
    return "\t".join([domain, include_subdomain, path, secure, expiry, name, value])


def _serialize_netscape_cookies(cookies: List[Dict[str, Any]]) -> str:
    lines = list(COOKIE_EXPORT_HEADER_LINES)
    lines.extend(_to_netscape_cookie_line(item) for item in cookies)
    lines.append("")
    return "\n".join(lines)


def _find_local_state_path_for_cookie_db(cookie_db_path: Path) -> Optional[Path]:
    parents = [cookie_db_path.parent, *cookie_db_path.parents]
    for parent in parents:
        candidate = parent / "Local State"
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def _copy_cookie_db_bundle_with_retry(source_db_path: Path) -> Path:
    temp_dir = Path(tempfile.gettempdir()) / f"lingomusic_cookie_bundle_{int(time.time() * 1000)}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    copied_main = temp_dir / source_db_path.name

    last_error: Optional[Exception] = None
    for attempt in range(COOKIE_DB_COPY_RETRY_ATTEMPTS):
        try:
            shutil.copy2(source_db_path, copied_main)
            for suffix in ("-wal", "-shm"):
                src = Path(str(source_db_path) + suffix)
                dst = Path(str(copied_main) + suffix)
                if src.exists():
                    try:
                        shutil.copy2(src, dst)
                    except Exception:
                        # Sidecar copy is best-effort; main db copy success is primary.
                        pass
            return copied_main
        except Exception as e:
            last_error = e
            if attempt < COOKIE_DB_COPY_RETRY_ATTEMPTS - 1:
                time.sleep(COOKIE_DB_COPY_RETRY_DELAY_SECONDS)
                continue
            break

    if last_error:
        raise last_error
    raise RuntimeError("Cookie DB copy failed for unknown reason")


def _query_cookie_rows(cookie_db_path: Path, read_only_uri: bool = False) -> List[tuple]:
    if read_only_uri:
        db_uri = "file:" + cookie_db_path.as_posix() + "?mode=ro&immutable=1"
        conn = sqlite3.connect(db_uri, uri=True, timeout=1.2)
    else:
        conn = sqlite3.connect(str(cookie_db_path))

    try:
        conn.execute("PRAGMA query_only = ON")
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT host_key, name, value, encrypted_value, path, expires_utc, is_secure
            FROM cookies
            """
        )
        return cursor.fetchall()
    finally:
        conn.close()


def _cleanup_temp_cookie_bundle(temp_main_db_path: Path) -> None:
    try:
        temp_dir = temp_main_db_path.parent
        shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception:
        pass


def _find_tauri_cookie_db_candidates(profile_hint: Optional[str], started_at_ms: Optional[int]) -> List[Path]:
    roots: List[Path] = []
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        roots.append(Path(local_app_data) / "com.lingomusic.downloader")
        roots.append(Path(local_app_data) / "com.tauri.dev")

    unique_candidates: Dict[str, Path] = {}
    for root in roots:
        if not root.exists():
            continue
        for candidate in root.rglob("Cookies"):
            if candidate.name != "Cookies":
                continue
            if candidate.parent.name != "Network":
                continue
            unique_candidates[str(candidate.resolve())] = candidate

    hint = (profile_hint or "").strip().lower()
    since_seconds = (started_at_ms / 1000.0) if started_at_ms else 0
    scored: List[tuple[int, float, Path]] = []

    for path in unique_candidates.values():
        score = 0
        try:
            path_lower = str(path).lower()
            mtime = path.stat().st_mtime
        except OSError:
            continue

        if hint and hint in path_lower:
            score += 200
        if "apple" in path_lower and "login" in path_lower:
            score += 80
        if since_seconds and mtime >= since_seconds - 5:
            score += 60

        scored.append((score, mtime, path))

    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [item[2] for item in scored]


def _read_apple_cookies_from_db(cookie_db_path: Path) -> List[Dict[str, Any]]:
    local_state_path = _find_local_state_path_for_cookie_db(cookie_db_path)
    master_key = _load_chromium_master_key(local_state_path) if local_state_path else None

    rows: List[tuple]
    temp_main_db_path: Optional[Path] = None
    try:
        temp_main_db_path = _copy_cookie_db_bundle_with_retry(cookie_db_path)
        rows = _query_cookie_rows(temp_main_db_path, read_only_uri=False)
    except Exception as copy_error:
        # Fallback: try opening source DB in read-only immutable URI mode.
        # This helps when copy is blocked transiently by file locking.
        logger.warning(
            "Copy cookie DB failed, fallback to direct read-only open: %s | %s",
            cookie_db_path,
            copy_error,
        )
        try:
            rows = _query_cookie_rows(cookie_db_path, read_only_uri=True)
        except Exception as direct_error:
            raise RuntimeError(
                f"Failed to read cookie DB ({cookie_db_path}): copy_error={copy_error}; direct_error={direct_error}"
            ) from direct_error
    finally:
        if temp_main_db_path:
            _cleanup_temp_cookie_bundle(temp_main_db_path)

    cookies: List[Dict[str, Any]] = []
    for row in rows:
        host_key = str(row[0] or "")
        if not _is_apple_cookie_domain(host_key):
            continue

        name = str(row[1] or "")
        value = _decrypt_chromium_cookie_value(str(row[2] or ""), row[3] or b"", master_key)
        if not name or not value:
            continue

        cookies.append(
            {
                "domain": host_key,
                "name": name,
                "value": value,
                "path": str(row[4] or "/"),
                "expiry": _chrome_expires_to_unix_seconds(row[5]),
                "secure": bool(row[6]),
            }
        )

    dedup: Dict[str, Dict[str, Any]] = {}
    for item in cookies:
        key = f"{item['domain']}\t{item['path']}\t{item['name']}"
        dedup[key] = item
    return list(dedup.values())


def _export_apple_music_cookies_from_webview(
    profile_hint: Optional[str],
    started_at_ms: Optional[int],
    write_to_file: bool = True,
) -> Dict[str, Any]:
    candidates = _find_tauri_cookie_db_candidates(profile_hint=profile_hint, started_at_ms=started_at_ms)
    if not candidates:
        return {
            "success": False,
            "message": "未找到 WebView Cookies 数据库，请先完成登录流程。",
            "cookies_count": 0,
            "has_media_user_token": False,
        }

    read_errors: List[str] = []
    selected_db: Optional[Path] = None
    all_cookies: List[Dict[str, Any]] = []
    has_token = False

    for db_path in candidates:
        try:
            cookies = _read_apple_cookies_from_db(db_path)
        except Exception as e:
            read_errors.append(f"{db_path}: {e}")
            continue

        if not cookies:
            continue

        token_cookies = [
            c for c in cookies
            if c.get("name") == "media-user-token" and "music.apple.com" in str(c.get("domain", "")).lower()
        ]
        if token_cookies:
            selected_db = db_path
            all_cookies = cookies
            has_token = True
            break

        if not all_cookies:
            selected_db = db_path
            all_cookies = cookies

    if not all_cookies:
        detail = f" 读取错误：{read_errors[0]}" if read_errors else ""
        return {
            "success": False,
            "message": "检测到 Cookies 数据库，但未提取到可用的 Apple 登录 Cookies。" + detail,
            "cookies_count": 0,
            "has_media_user_token": False,
        }

    if write_to_file:
        content = _serialize_netscape_cookies(all_cookies)
        Path(settings.COOKIES_PATH).write_text(content, encoding="utf-8")

    return {
        "success": True,
        "message": "Cookies 已导出。" if write_to_file else "Cookies 检测完成。",
        "cookies_count": len(all_cookies),
        "has_media_user_token": has_token,
        "source_db": str(selected_db) if selected_db else "",
    }


async def _initialize_manager_with_retry(
    attempts: int = COOKIE_INIT_RETRY_ATTEMPTS,
    delay_seconds: float = COOKIE_INIT_RETRY_DELAY_SECONDS,
) -> bool:
    """
    Cookie 初始化偶发会因网络/上游抖动失败，这里做短重试提升稳定性。
    """
    for index in range(max(1, attempts)):
        ok = await manager.initialize()
        if ok:
            return True
        if index < attempts - 1:
            await asyncio.sleep(delay_seconds)
    return False


def _coerce_tag_value(value: Any) -> str:
    if isinstance(value, (list, tuple)):
        if not value:
            return ""
        value = value[0]
    if value is None:
        return ""
    if isinstance(value, bytes):
        for encoding in ("utf-8", "utf-16", "latin-1"):
            try:
                return value.decode(encoding).strip()
            except Exception:
                continue
        return ""
    return str(value).strip()


def _read_tag(tags: Any, keys: List[str]) -> str:
    if not tags:
        return ""
    for key in keys:
        try:
            if key in tags:
                val = _coerce_tag_value(tags.get(key))
                if val:
                    return val
        except Exception:
            continue
    return ""


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


def _detect_local_codec(file_path: str) -> str:
    from mutagen import File as MutagenFile

    try:
        audio = MutagenFile(file_path)
        info = getattr(audio, "info", None)
        raw = getattr(info, "codec", None)
        if raw:
            return _normalize_codec_label(str(raw))
    except Exception as e:
        logger.warning("Failed to detect local codec: %s | file=%s", e, file_path)

    suffix = Path(file_path).suffix.lower()
    return _normalize_codec_label(suffix.lstrip("."))


def _extract_embedded_cover(file_path: str) -> Optional[tuple[bytes, str]]:
    from mutagen import File as MutagenFile
    from mutagen.mp4 import MP4Cover

    audio = MutagenFile(file_path)
    tags = getattr(audio, "tags", None)
    if not tags:
        return None

    covers = tags.get("covr")
    if not covers:
        return None

    first = covers[0]
    cover_bytes = bytes(first)
    imageformat = getattr(first, "imageformat", None)
    if imageformat == MP4Cover.FORMAT_PNG:
        return cover_bytes, "image/png"
    return cover_bytes, "image/jpeg"


def _filename_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "")
    normalized = normalized.casefold().strip()
    return re.sub(r"\s+", " ", normalized)


def _strip_track_prefix(name: str) -> str:
    # Matches patterns like "05 xxx", "05-xxx", "05. xxx", "05) xxx".
    return re.sub(r"^\s*\d{1,3}\s*[\-._)\]]?\s*", "", name).strip()


def _find_sidecar_lrc_path(audio_path: str, preferred_path: Optional[str] = None) -> Optional[str]:
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
        _filename_key(audio_obj.stem),
        _filename_key(_strip_track_prefix(audio_obj.stem)),
    }
    target_keys = {key for key in target_keys if key}

    try:
        lrc_files = [p for p in parent.iterdir() if p.is_file() and p.suffix.lower() == ".lrc"]
    except Exception:
        return None

    for file in lrc_files:
        if _filename_key(file.stem) in target_keys:
            return str(file)

    for file in lrc_files:
        if _filename_key(_strip_track_prefix(file.stem)) in target_keys:
            return str(file)

    if len(lrc_files) == 1:
        return str(lrc_files[0])

    return None


def _read_text_with_fallback(file_path: str) -> str:
    encodings = ["utf-8-sig", "utf-8", "gb18030", "big5", "cp1252", "latin-1"]
    for enc in encodings:
        try:
            return Path(file_path).read_text(encoding=enc)
        except Exception:
            continue
    raise RuntimeError("Unable to decode lyrics file with fallback encodings")


def _should_decode_for_web_playback(codec_label: str) -> bool:
    return codec_label in {"alac", "dolby"}


def _safe_track_id_for_filename(track_id: str) -> str:
    safe = re.sub(r"[^\w\-\.]", "_", track_id)
    return safe[:128] if safe else "track"


def _select_pcm_codec(source_path: str) -> str:
    from mutagen import File as MutagenFile

    try:
        audio = MutagenFile(source_path)
        info = getattr(audio, "info", None)
        bits_per_sample = int(getattr(info, "bits_per_sample", 16) or 16)
        if bits_per_sample >= 24:
            return "pcm_s24le"
    except Exception:
        pass
    return "pcm_s16le"


def _decoded_playback_path(track_id: str, source_path: str) -> str:
    cache_root = os.path.join(settings.BASE_DIR, "data", "playback_cache")
    os.makedirs(cache_root, exist_ok=True)

    stat = os.stat(source_path)
    fingerprint = f"{stat.st_mtime_ns}_{stat.st_size}"
    safe_id = _safe_track_id_for_filename(track_id)
    output_name = f"{safe_id}_{fingerprint}.wav"
    target_path = os.path.join(cache_root, output_name)

    if os.path.exists(target_path) and os.path.getsize(target_path) > 0:
        return target_path

    ffmpeg_bin = settings.FFMPEG_PATH
    if not os.path.exists(ffmpeg_bin):
        ffmpeg_bin = shutil.which("ffmpeg") or ""
    if not ffmpeg_bin:
        raise RuntimeError("FFmpeg not found; cannot decode ALAC/Dolby for browser playback")

    # Cleanup stale cache entries for the same track.
    prefix = f"{safe_id}_"
    for name in os.listdir(cache_root):
        if name.startswith(prefix) and name != output_name:
            try:
                os.remove(os.path.join(cache_root, name))
            except OSError:
                pass

    pcm_codec = _select_pcm_codec(source_path)
    command = [
        ffmpeg_bin,
        "-y",
        "-i",
        source_path,
        "-vn",
        "-c:a",
        pcm_codec,
        target_path,
    ]
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0 or not os.path.exists(target_path):
        raise RuntimeError(
            "FFmpeg decode failed: "
            + (completed.stderr or completed.stdout or "unknown error")[-500:]
        )

    return target_path


def _fallback_local_track_id(file_path: str) -> str:
    normalized = os.path.normcase(os.path.abspath(file_path))
    digest = hashlib.sha1(normalized.encode("utf-8", errors="ignore")).hexdigest()[:20]
    return f"local-{digest}"


def _extract_local_history_row(file_path: str) -> Dict[str, Any]:
    from mutagen import File as MutagenFile

    file_size = os.path.getsize(file_path)
    stem_title = Path(file_path).stem
    lyrics_path = _find_sidecar_lrc_path(file_path) or ""

    track_id = ""
    name = stem_title
    artist_name = "Unknown Artist"
    album_name = "Unknown Album"
    artwork_url = ""
    codec = _detect_local_codec(file_path)
    has_embedded_cover = False

    try:
        audio = MutagenFile(file_path)
        tags = getattr(audio, "tags", None)
        if tags:
            if tags.get("covr"):
                has_embedded_cover = True
            name = _read_tag(tags, ["©nam", "title"]) or name
            artist_name = _read_tag(tags, ["©ART", "aART", "artist"]) or artist_name
            album_name = _read_tag(tags, ["©alb", "album"]) or album_name

            raw_track_id = _read_tag(
                tags,
                [
                    "cnID",
                    "atID",
                    "xid ",
                    "----:com.apple.iTunes:cnID",
                ],
            )
            if raw_track_id:
                # Keep a compact and safe id format for API path usage.
                sanitized = re.sub(r"[^\w\-.:]", "", raw_track_id)
                track_id = sanitized or raw_track_id
    except Exception as e:
        logger.warning("Failed to read local media tags: %s | file=%s", e, file_path)

    if not track_id:
        track_id = _fallback_local_track_id(file_path)

    if has_embedded_cover:
        artwork_url = f"{LOCAL_API_BASE_URL}/local-artwork/{track_id}"

    return {
        "track_id": str(track_id),
        "name": name,
        "artist_name": artist_name,
        "album_name": album_name,
        "artwork_url": artwork_url,
        "codec": codec,
        "file_path": file_path,
        "lyrics_path": lyrics_path,
        "file_size": file_size,
    }


def _scan_local_library_impl(root_path: str) -> Dict[str, Any]:
    summary = {
        "scanned_files": 0,
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "failed": 0,
        "errors": [],
    }

    if not os.path.exists(root_path):
        return summary

    for root, _, files in os.walk(root_path):
        for filename in files:
            suffix = Path(filename).suffix.lower()
            if suffix not in LOCAL_SCAN_EXTENSIONS:
                continue

            summary["scanned_files"] += 1
            full_path = os.path.join(root, filename)
            try:
                row = _extract_local_history_row(full_path)
                existing = get_history_by_track_id(row["track_id"])

                if existing:
                    existing_artwork = str(existing.get("artwork_url") or "")
                    new_artwork = str(row.get("artwork_url") or "")

                    # Keep high-quality remote artwork if we already have it.
                    if existing_artwork.startswith("http") and "/api/local-artwork/" not in existing_artwork and new_artwork.startswith(LOCAL_API_BASE_URL):
                        row["artwork_url"] = existing_artwork

                    unchanged = all(
                        str(existing.get(key) or "") == str(row.get(key) or "")
                        for key in [
                            "name",
                            "artist_name",
                            "album_name",
                            "artwork_url",
                            "codec",
                            "file_path",
                            "lyrics_path",
                            "file_size",
                        ]
                    )
                    if unchanged:
                        summary["skipped"] += 1
                        continue

                insert_history(row)
                if existing:
                    summary["updated"] += 1
                else:
                    summary["inserted"] += 1
            except Exception as e:
                summary["failed"] += 1
                if len(summary["errors"]) < 8:
                    summary["errors"].append(f"{filename}: {str(e)}")

    return summary


def _check_port(host: str, port: int, timeout: float = 1.5) -> bool:
    """Return True if something is listening on host:port."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _get_wrapper_runtime_health() -> Dict[str, bool]:
    decrypt_ok = _check_port("127.0.0.1", WRAPPER_DECRYPT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
    m3u8_ok = _check_port("127.0.0.1", WRAPPER_M3U8_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
    account_ok = _check_port("127.0.0.1", WRAPPER_ACCOUNT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
    return {
        "decrypt_ok": decrypt_ok,
        "m3u8_ok": m3u8_ok,
        "account_ok": account_ok,
        "all_ok": decrypt_ok and m3u8_ok and account_ok,
    }


def _normalize_search_results(raw_payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Normalize Apple Music search payload into frontend-friendly shape:
    { "<category>": { "data": [...] } }
    """
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

    # Keep any extra category that still has a proper "data" list.
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


def _search_cache_key(term: str, limit: int) -> str:
    return f"{term.strip().lower()}::{limit}"


def _prune_search_cache(now_ts: float) -> None:
    expired = [
        key for key, (saved_ts, _) in _search_cache.items()
        if now_ts - saved_ts > SEARCH_CACHE_STALE_SECONDS
    ]
    for key in expired:
        _search_cache.pop(key, None)

    if len(_search_cache) <= SEARCH_CACHE_MAX_ENTRIES:
        return

    # Keep most recent entries when cache exceeds capacity.
    ordered = sorted(_search_cache.items(), key=lambda item: item[1][0], reverse=True)
    keep = dict(ordered[:SEARCH_CACHE_MAX_ENTRIES])
    _search_cache.clear()
    _search_cache.update(keep)


def _get_cached_search(term: str, limit: int, allow_stale: bool = False) -> Optional[Dict[str, Any]]:
    key = _search_cache_key(term, limit)
    cached = _search_cache.get(key)
    if not cached:
        return None

    saved_ts, payload = cached
    age = time.time() - saved_ts
    if age <= SEARCH_CACHE_TTL_SECONDS:
        return payload
    if allow_stale and age <= SEARCH_CACHE_STALE_SECONDS:
        return payload

    # Hard-expired stale entries are cleaned up eagerly.
    _search_cache.pop(key, None)
    return None


def _save_cached_search(term: str, limit: int, payload: Dict[str, Any]) -> None:
    now_ts = time.time()
    _search_cache[_search_cache_key(term, limit)] = (now_ts, payload)
    _prune_search_cache(now_ts)


async def _search_catalog_direct(term: str, limit: int) -> Dict[str, Any]:
    global _search_http_client

    if not manager.apple_music_api:
        raise RuntimeError("Apple Music API is not initialized")

    api = manager.apple_music_api
    uri = "https://amp-api.music.apple.com" + APPLE_MUSIC_SEARCH_API_URI.format(
        storefront=api.storefront
    )
    params = {
        "term": term,
        "types": FAST_SEARCH_TYPES,
        "limit": limit,
        "offset": 0,
    }
    headers = dict(api.client.headers)

    # Reuse a dedicated client to avoid repeated TCP/TLS handshakes.
    if _search_http_client is None or _search_http_client.is_closed:
        _search_http_client = httpx.AsyncClient(
            timeout=FAST_SEARCH_DIRECT_TIMEOUT_SECONDS,
            headers=headers,
        )
    else:
        _search_http_client.headers.clear()
        _search_http_client.headers.update(headers)

    response = await _search_http_client.get(uri, params=params)
    response.raise_for_status()
    payload = response.json()

    if not isinstance(payload, dict):
        raise RuntimeError("Apple Music direct search returned invalid payload")
    if "errors" in payload:
        raise RuntimeError(f"Apple Music API error: {payload['errors']}")
    return payload


async def _search_catalog_fast(term: str, limit: int = FAST_SEARCH_LIMIT) -> Dict[str, Any]:
    """
    Faster search path for the new frontend:
    - Fetch all frontend-visible resource types in one request
    - Keep result count bounded to reduce API latency and payload size
    - Add short-lived in-memory cache to speed repeated terms
    - Deduplicate concurrent identical requests
    - Fail fast on upstream stalls, instead of hanging for a long retry chain
    """
    if not manager.apple_music_api:
        raise RuntimeError("Apple Music API is not initialized")

    safe_limit = max(1, min(limit, 50))
    cached_payload = _get_cached_search(term, safe_limit, allow_stale=False)
    if cached_payload is not None:
        return cached_payload

    cache_key = _search_cache_key(term, safe_limit)
    inflight = _search_inflight.get(cache_key)
    if inflight is not None:
        return await inflight

    async def _fetch() -> Dict[str, Any]:
        try:
            # Direct AMP request is usually faster and avoids large debug payload logging.
            try:
                payload = await _search_catalog_direct(term, safe_limit)
            except Exception as direct_error:
                logger.warning(
                    "Direct AMP search failed, falling back to gamdl path: %s",
                    direct_error,
                )
                payload = await asyncio.wait_for(
                    manager.apple_music_api.get_search_results(
                        term,
                        types=FAST_SEARCH_TYPES,
                        limit=safe_limit,
                        offset=0,
                    ),
                    timeout=FAST_SEARCH_TIMEOUT_SECONDS,
                )

            if not isinstance(payload, dict):
                raise RuntimeError("Apple Music search returned invalid payload")
            _save_cached_search(term, safe_limit, payload)
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
        # On transient upstream failures, try stale cache so the UI still responds.
        stale_payload = _get_cached_search(term, safe_limit, allow_stale=True)
        if stale_payload is not None:
            logger.warning("Search upstream failed; serving stale cache for term '%s'", term)
            return stale_payload
        raise
    finally:
        _search_inflight.pop(cache_key, None)


class DownloadRequest(BaseModel):
    url: str
    codec: str = "aac-legacy"
    video_resolution: str = "1080p"
    use_wrapper: bool = False

@router.post("/download")
async def start_download(request: DownloadRequest):
    if not manager.is_initialized:
        success = await manager.initialize()
        if not success:
            raise HTTPException(
                status_code=500, 
                detail="Downloader not initialized. Please ensure cookies.txt is provided and valid."
            )

    normalized_codec = _normalize_codec_label(request.codec)
    if normalized_codec in {"alac", "dolby"} and not request.use_wrapper:
        raise HTTPException(
            status_code=400,
            detail="当前音质需要Wrapper支持。请先启用并确保Wrapper正在运行后重试。",
        )

    if request.use_wrapper:
        wrapper_health = await asyncio.to_thread(_get_wrapper_runtime_health)
        if not wrapper_health.get("all_ok"):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Wrapper未就绪，已拒绝自动降级下载。"
                    f" 端口状态: decrypt={wrapper_health.get('decrypt_ok')},"
                    f" m3u8={wrapper_health.get('m3u8_ok')},"
                    f" account={wrapper_health.get('account_ok')}。"
                    " 请在“安装Wrapper并登录”中重启Wrapper后重试。"
                ),
            )
    
    added = await manager.add_to_queue(
        request.url, 
        codec=request.codec, 
        video_resolution=request.video_resolution,
        use_wrapper=request.use_wrapper
    )
    if not added:
        raise HTTPException(status_code=500, detail="Failed to add to download queue")
        
    return {"message": "Download started", "url": request.url}

class CookieRequest(BaseModel):
    content: str

@router.post("/cookies")
async def save_cookies(request: CookieRequest):
    """Save raw Netscape cookies.txt content and reinitialize downloader."""
    try:
        with open(settings.COOKIES_PATH, "w", encoding="utf-8") as f:
            f.write(request.content.strip())
        
        # Reinitialize with retries so transient AMP failures don't cause false negatives.
        success = await _initialize_manager_with_retry()
        if not success:
            return {"success": False, "message": "Cookies saved, but downloader initialization failed."}
            
        return {"success": True, "message": "Cookies saved and downloader initialized successfully!"}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to save cookies: {str(e)}")


class CookieLoginFinalizeRequest(BaseModel):
    profile_hint: Optional[str] = None
    started_at_ms: Optional[int] = None


@router.post("/cookie-login/probe")
async def probe_cookie_login(request: CookieLoginFinalizeRequest):
    """
    Lightweight probe for login detection while the login window is still open.
    Does not write cookies.txt, only checks whether media-user-token is observable.
    """
    try:
        probe_result = await asyncio.to_thread(
            _export_apple_music_cookies_from_webview,
            request.profile_hint,
            request.started_at_ms,
            False,
        )
    except Exception as e:
        logger.exception("Cookie login probe failed")
        return {
            "success": False,
            "message": f"登录状态检测失败: {e}",
            "login_detected": False,
            "cookies_count": 0,
            "has_media_user_token": False,
        }

    login_detected = bool(probe_result.get("has_media_user_token"))
    return {
        **probe_result,
        "login_detected": login_detected,
        "success": True,
        "message": "已检测到登录态" if login_detected else "未检测到完整登录态",
    }


@router.post("/cookie-login/finalize")
async def finalize_cookie_login(request: CookieLoginFinalizeRequest):
    """
    Extract Apple Music cookies from Tauri WebView profile, export to cookies.txt,
    then reinitialize downloader to validate login completeness.
    """
    try:
        export_result = await asyncio.to_thread(
            _export_apple_music_cookies_from_webview,
            request.profile_hint,
            request.started_at_ms,
            True,
        )
    except Exception as e:
        logger.exception("Failed to export cookies from WebView")
        raise HTTPException(status_code=500, detail=f"Cookie export failed: {e}")

    if not export_result.get("success"):
        return {
            **export_result,
            "login_detected": False,
            "downloader_initialized": False,
            "apple_login_url": APPLE_LOGIN_URL,
        }

    initialized = await _initialize_manager_with_retry()
    has_token = bool(export_result.get("has_media_user_token"))
    success = bool(initialized and has_token)
    message = (
        "登录成功，Cookies 已导出并完成核心初始化。"
        if success
        else "Cookies 已导出，但未检测到完整登录态，请确认 Apple Music 账户已登录。"
    )

    return {
        **export_result,
        "success": success,
        "message": message,
        "login_detected": has_token,
        "downloader_initialized": initialized,
        "apple_login_url": APPLE_LOGIN_URL,
    }

@router.get("/status")
async def get_status() -> Dict[str, Any]:
    return {
        "is_initialized": manager.is_initialized,
        "downloads": manager.download_status
    }


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Check wrapper port connectivity and cookies status."""
    global _health_cache

    now_ts = time.time()
    if _health_cache and (now_ts - _health_cache[0] <= HEALTH_CACHE_TTL_SECONDS):
        return _health_cache[1]

    async with _health_lock:
        now_ts = time.time()
        if _health_cache and (now_ts - _health_cache[0] <= HEALTH_CACHE_TTL_SECONDS):
            return _health_cache[1]

        wrapper_health = await asyncio.to_thread(_get_wrapper_runtime_health)
        decrypt_ok = wrapper_health["decrypt_ok"]
        m3u8_ok = wrapper_health["m3u8_ok"]
        account_ok = wrapper_health["account_ok"]

        cookies_ok = (
            os.path.exists(settings.COOKIES_PATH)
            and os.path.getsize(settings.COOKIES_PATH) > 10
        )
        payload = {
            "wrapper": {
                "decrypt_port": {"port": WRAPPER_DECRYPT_PORT, "reachable": decrypt_ok},
                "m3u8_port":    {"port": WRAPPER_M3U8_PORT,    "reachable": m3u8_ok},
                "account_port": {"port": WRAPPER_ACCOUNT_PORT, "reachable": account_ok},
                "all_ok": decrypt_ok and m3u8_ok and account_ok,
            },
            "cookies_ok": cookies_ok,
            "downloader_initialized": manager.is_initialized,
        }
        _health_cache = (time.time(), payload)
        return payload


class WrapperSetupStartRequest(BaseModel):
    force_restart: Optional[bool] = False


class WrapperSetupInputRequest(BaseModel):
    input_type: str = "credentials"   # credentials | 2fa
    apple_id: Optional[str] = None
    password: Optional[str] = None
    code: Optional[str] = None


@router.get("/wrapper/setup/precheck")
async def wrapper_setup_precheck():
    precheck = _build_wrapper_precheck()
    return precheck


@router.post("/wrapper/setup/start")
async def start_wrapper_setup(request: WrapperSetupStartRequest):
    precheck = _build_wrapper_precheck()

    if not precheck.get("can_start"):
        _wrapper_set_state(
            status="error",
            stage="precheck",
            running=False,
            completed=True,
            success_flag=False,
            awaiting_input=False,
            input_type="",
            input_prompt="",
            wsl2_installed=bool(precheck.get("wsl2_installed")),
            wrapper_installed=bool(precheck.get("wrapper_installed")),
            wrapper_running=bool(precheck.get("wrapper_running")),
            message=precheck.get("message") or "请先安装WSL2。",
        )
        return {
            "success": False,
            "status": "error",
            "message": precheck.get("message") or "请先安装WSL2。",
        }

    current_state = _wrapper_copy_state()
    if current_state.get("running"):
        return {
            "success": True,
            "status": "running",
            "message": "Wrapper任务已在进行中。",
        }

    global _wrapper_cached_credentials
    force_restart = bool(request.force_restart) or bool(precheck.get("wrapper_running"))
    if force_restart:
        _wrapper_cached_credentials = None
        _set_wrapper_process(None)

    started = _start_wrapper_worker(
        launch_new=True,
        use_cached_credentials=False,
        force_restart=force_restart,
        reset_logs=True,
    )
    if not started:
        return {
            "success": True,
            "status": "running",
            "message": "Wrapper任务已在进行中。",
        }

    return {
        "success": True,
        "status": "running",
        "message": "Wrapper安装/登录流程已启动。" if not force_restart else "Wrapper重启与登录流程已启动。",
    }


@router.get("/wrapper/setup/status")
async def get_wrapper_setup_status():
    state = _wrapper_copy_state()
    if _is_wrapper_running() and state.get("status") != "success":
        _wrapper_set_state(
            status="success",
            stage="completed",
            running=False,
            completed=True,
            success_flag=True,
            awaiting_input=False,
            input_type="",
            input_prompt="",
            wsl2_installed=True,
            wrapper_installed=True,
            wrapper_running=True,
            message="Wrapper正在运行。",
        )
        state = _wrapper_copy_state()
    state["wsl2_installed"] = bool(state.get("wsl2_installed"))
    state["wrapper_installed"] = _is_wrapper_installed()
    state["wrapper_running"] = _is_wrapper_running()
    return {"success": True, **state}


@router.post("/wrapper/setup/input")
async def submit_wrapper_setup_input(request: WrapperSetupInputRequest):
    state = _wrapper_copy_state()
    expected = str(state.get("input_type") or "").strip().lower()
    requested = (request.input_type or "").strip().lower()

    if not state.get("awaiting_input"):
        return {
            "success": False,
            "status": "error",
            "message": "当前Wrapper未处于等待输入状态。",
        }

    input_type = requested or expected
    if expected and input_type != expected:
        return {
            "success": False,
            "status": "error",
            "message": f"当前期待输入类型为 {expected}，请按提示输入。",
        }

    if input_type == "credentials":
        apple_id = (request.apple_id or "").strip()
        password = (request.password or "").strip()
        if not apple_id or not password:
            return {"success": False, "status": "error", "message": "请输入Apple ID与密码。"}

        global _wrapper_cached_credentials
        _wrapper_cached_credentials = (apple_id, password)

        sent, err = _send_wrapper_input_lines([apple_id, password])
        if sent:
            _wrapper_append_log("已提交Apple ID与密码，等待2FA或服务启动。")
            _wrapper_set_state(
                status="running",
                stage="auth-credentials",
                running=True,
                completed=False,
                success_flag=False,
                awaiting_input=False,
                input_type="",
                input_prompt="",
                message="账号密码已提交，正在继续登录流程...",
            )
            _start_wrapper_worker(
                launch_new=False,
                use_cached_credentials=True,
                reset_logs=False,
            )
            return {"success": True, "status": "running", "message": "账号密码已提交。"}

        _wrapper_append_log(f"当前进程不接受输入，将重启Wrapper继续登录。原因: {err}")
        _wrapper_set_state(
            status="running",
            stage="restart-wrapper",
            running=True,
            completed=False,
            success_flag=False,
            awaiting_input=False,
            input_type="",
            input_prompt="",
            message="正在重启Wrapper并继续登录...",
        )
        _start_wrapper_worker(
            launch_new=True,
            use_cached_credentials=True,
            reset_logs=False,
        )
        return {"success": True, "status": "running", "message": "正在重启Wrapper并继续登录。"}

    if input_type == "2fa":
        code = (request.code or "").strip()
        if not code:
            return {"success": False, "status": "error", "message": "请输入2FA验证码。"}

        sent, err = _send_wrapper_input_lines([code])
        if not sent:
            return {"success": False, "status": "error", "message": err or "提交2FA验证码失败。"}

        _wrapper_append_log("已提交2FA验证码，等待Wrapper完成启动。")
        _wrapper_set_state(
            status="running",
            stage="auth-2fa",
            running=True,
            completed=False,
            success_flag=False,
            awaiting_input=False,
            input_type="",
            input_prompt="",
            message="2FA验证码已提交，正在等待服务就绪...",
        )
        _start_wrapper_worker(
            launch_new=False,
            use_cached_credentials=True,
            reset_logs=False,
        )
        return {"success": True, "status": "running", "message": "2FA验证码已提交。"}

    return {"success": False, "status": "error", "message": "未知的输入类型。"}


class Wsl2InstallStartRequest(BaseModel):
    required_gb: Optional[float] = WSL2_REQUIRED_FREE_GB


@router.get("/wsl2/install/precheck")
async def wsl2_install_precheck():
    if os.name != "nt":
        return {
            "success": False,
            "can_install": False,
            "already_installed": False,
            "install_hint": "当前系统非Windows。",
            "message": "当前系统非Windows，无法安装WSL2。",
            "required_gb": WSL2_REQUIRED_FREE_GB,
            "selected_drive": "",
            "target_path": "",
            "use_custom_location": False,
            "d_drive_exists": False,
            "d_free_gb": 0.0,
            "c_free_gb": 0.0,
            "is_admin": False,
        }
    return _build_wsl2_precheck(WSL2_REQUIRED_FREE_GB)


@router.post("/wsl2/install/start")
async def start_wsl2_install(request: Wsl2InstallStartRequest):
    if os.name != "nt":
        raise HTTPException(status_code=400, detail="Current OS does not support WSL2 installation.")

    required_gb = request.required_gb if request.required_gb is not None else WSL2_REQUIRED_FREE_GB
    precheck = _build_wsl2_precheck(required_gb)
    if precheck.get("already_installed"):
        with _wsl2_install_state_lock:
            _wsl2_install_state.update({
                "status": "success",
                "stage": "completed",
                "running": False,
                "completed": True,
                "success_flag": True,
                "message": precheck.get("message") or "检测到本机已安装WSL2，无需重复安装。",
                "required_gb": precheck.get("required_gb", WSL2_REQUIRED_FREE_GB),
                "selected_drive": "",
                "target_path": "",
                "use_custom_location": False,
                "logs": [
                    f"[{time.strftime('%H:%M:%S')}] 检测到本机已安装WSL2，已直接判定完成。"
                ],
                "updated_at": time.time(),
            })
        return {
            "success": True,
            "status": "success",
            "message": precheck.get("message") or "检测到本机已安装WSL2，无需重复安装。",
            "target_path": "",
            "selected_drive": "",
        }

    if not precheck.get("can_install"):
        return {
            "success": False,
            "status": "error",
            "message": precheck.get("message") or "安装前检查失败",
            "target_path": precheck.get("target_path", ""),
            "selected_drive": precheck.get("selected_drive", ""),
        }

    with _wsl2_install_state_lock:
        if _wsl2_install_state.get("running"):
            return {
                "success": True,
                "status": "running",
                "message": "WSL2 安装任务已在进行中。",
                "target_path": _wsl2_install_state.get("target_path", ""),
                "selected_drive": _wsl2_install_state.get("selected_drive", ""),
            }

        _wsl2_install_state.update({
            "status": "running",
            "stage": "queued",
            "running": True,
            "completed": False,
            "success_flag": False,
            "message": "安装任务已启动。",
            "required_gb": precheck.get("required_gb", WSL2_REQUIRED_FREE_GB),
            "selected_drive": precheck.get("selected_drive", ""),
            "target_path": precheck.get("target_path", ""),
            "use_custom_location": precheck.get("use_custom_location", False),
            "logs": [],
            "updated_at": time.time(),
        })

    worker = threading.Thread(target=_wsl2_install_worker, args=(precheck,), daemon=True)
    worker.start()

    return {
        "success": True,
        "status": "running",
        "message": "WSL2 安装任务已启动。",
        "target_path": precheck.get("target_path", ""),
        "selected_drive": precheck.get("selected_drive", ""),
    }


@router.get("/wsl2/install/status")
async def get_wsl2_install_status():
    state = _wsl2_copy_state()
    return {"success": True, **state}

def parse_apple_music_url(url: str):
    try:
        parsed = urlparse(url)
        if "music.apple.com" not in parsed.netloc:
            return None, None
        
        # Check query param first for song id
        qs = parse_qs(parsed.query)
        if "i" in qs:
            return "songs", qs["i"][0]
            
        path_parts = [p for p in parsed.path.split("/") if p]
        # path_parts looks like: [storefront, "album", name, id] or [storefront, "album", id]
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


@router.api_route("/search", methods=["GET", "HEAD"])
async def search_apple_music(request: Request, term: str = Query(..., description="Search term")):
    if not manager.is_initialized:
        success = await manager.initialize()
        if not success:
            raise HTTPException(status_code=500, detail="Downloader not initialized.")
            
    try:
        if request.method == "HEAD":
            return {}
            
        item_type, item_id = parse_apple_music_url(term)
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
                    
            return {"success": True, "results": _normalize_search_results(results)}
        else:
            start_ts = time.perf_counter()
            raw_results = await _search_catalog_fast(term=term)
            elapsed_ms = (time.perf_counter() - start_ts) * 1000
            try:
                songs_count = len((raw_results.get("results", {}).get("songs", {}) or {}).get("data", []) or [])
                mvs_count = len((raw_results.get("results", {}).get("music-videos", {}) or {}).get("data", []) or [])
                albums_count = len((raw_results.get("results", {}).get("albums", {}) or {}).get("data", []) or [])
                artists_count = len((raw_results.get("results", {}).get("artists", {}) or {}).get("data", []) or [])
                other_count = len((raw_results.get("results", {}).get("playlists", {}) or {}).get("data", []) or [])
                logger.info(
                    "Apple Music search completed in %.1fms (songs=%s, albums=%s, artists=%s, mvs=%s, others=%s)",
                    elapsed_ms,
                    songs_count,
                    albums_count,
                    artists_count,
                    mvs_count,
                    other_count,
                )
            except Exception:
                # Never fail the request just because telemetry formatting failed.
                pass
            return {"success": True, "results": _normalize_search_results(raw_results)}
    except TimeoutError as e:
        logger.warning("Apple Music search timeout: %s", e)
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        logger.exception("Error during Apple Music search")
        raise HTTPException(status_code=500, detail=str(e))


# --- Settings API ---

@router.get("/settings")
async def api_get_settings() -> Dict[str, Any]:
    return get_all_settings()

@router.post("/settings")
async def api_save_settings(settings_dict: Dict[str, Any]):
    save_settings(settings_dict)
    return {"success": True, "message": "Settings updated"}

# --- History API ---

@router.get("/history")
async def api_get_history() -> List[Dict[str, Any]]:
    return get_history()

@router.delete("/history/{track_id}")
async def api_delete_history(track_id: str, delete_file: bool = False):
    if delete_file:
        track = get_history_by_track_id(track_id)
        if track and track.get("file_path"):
            path = track["file_path"]
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass # Or log it
    delete_history(track_id)
    return {"success": True}

# --- Recommendations API ---

@router.get("/recommendations")
async def api_get_recommendations() -> Dict[str, Any]:
    recs = get_recommendations(limit=10)
    return {"success": True, "recommendations": recs}

class ReportSearchRequest(BaseModel):
    keyword: str

@router.post("/recommendations/report")
async def api_report_search(request: ReportSearchRequest):
    report_search(request.keyword)
    return {"success": True}

# --- Local Audio Playback ---

@router.get("/local-play/{track_id}")
async def stream_local_audio(track_id: str):
    track = get_history_by_track_id(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track history not found")
        
    file_path = track.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    codec = _normalize_codec_label(str(track.get("codec") or ""))
    if codec not in {"aac", "alac", "dolby"}:
        codec = await asyncio.to_thread(_detect_local_codec, file_path)

    serve_path = file_path
    headers = {"Accept-Ranges": "bytes"}

    # Chromium/WebView cannot always decode ALAC or Dolby directly.
    # Decode these formats to lossless PCM WAV for local in-app playback.
    if _should_decode_for_web_playback(codec):
        try:
            serve_path = await asyncio.to_thread(_decoded_playback_path, track_id, file_path)
            headers["X-Playback-Decoded"] = codec
        except Exception as e:
            logger.error("Local playback decode failed: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to decode local audio: {e}")

    media_type = "audio/wav" if serve_path.lower().endswith(".wav") else "audio/mp4"
    return FileResponse(serve_path, media_type=media_type, headers=headers)


@router.get("/local-artwork/{track_id}")
async def get_local_artwork(track_id: str):
    track = get_history_by_track_id(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track history not found")

    file_path = track.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    try:
        result = await asyncio.to_thread(_extract_embedded_cover, file_path)
    except Exception as e:
        logger.warning("Read local artwork failed: %s | %s", e, file_path)
        result = None

    if not result:
        raise HTTPException(status_code=404, detail="No embedded artwork found")

    cover_bytes, media_type = result
    return Response(
        content=cover_bytes,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/local-lyrics/{track_id}")
async def get_local_lyrics(track_id: str):
    track = get_history_by_track_id(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track history not found")

    file_path = track.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    preferred_path = str(track.get("lyrics_path") or "").strip() or None
    lrc_path = await asyncio.to_thread(_find_sidecar_lrc_path, file_path, preferred_path)
    if not lrc_path or not os.path.exists(lrc_path):
        raise HTTPException(status_code=404, detail="LRC lyrics file not found")

    if lrc_path != preferred_path:
        await asyncio.to_thread(update_history_lyrics_path, track_id, lrc_path)

    try:
        content = await asyncio.to_thread(_read_text_with_fallback, lrc_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read lyrics file: {e}")

    return {
        "success": True,
        "track_id": track_id,
        "path": lrc_path,
        "content": content,
    }

class OpenFolderRequest(BaseModel):
    path: Optional[str] = None

@router.post("/open-folder")
async def open_download_folder(request: OpenFolderRequest):
    import subprocess
    path = request.path
    target_path = path or settings.OUTPUT_PATH
    if not os.path.exists(target_path) and not path:
        os.makedirs(target_path, exist_ok=True)
        
    if path and not os.path.exists(target_path):
        # If it's a file path that doesn't exist, try to open its parent directory
        target_path = os.path.dirname(target_path)
        if not os.path.exists(target_path):
            raise HTTPException(status_code=404, detail="Target path not found")

    try:
        if os.name == 'nt':
            # On Windows, using explorer /select,path highlights the file if it exists
            if path and os.path.isfile(path):
                subprocess.run(["explorer", "/select,", os.path.normpath(path)])
            else:
                os.startfile(os.path.normpath(target_path))
        else:
            subprocess.run(["xdg-open", target_path])
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/open-converted-folder")
async def open_converted_folder():
    target_path = settings.CONVERTED_PATH
    os.makedirs(target_path, exist_ok=True)

    try:
        if os.name == "nt":
            os.startfile(os.path.normpath(target_path))
        else:
            subprocess.run(["xdg-open", target_path])
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scan-local")
async def scan_local_library():
    """
    Scan local download folder and backfill download_history entries.
    Useful when old tasks skipped DB insertion (e.g. file already exists).
    """
    try:
        root_path = settings.OUTPUT_PATH
        os.makedirs(root_path, exist_ok=True)
        summary = await asyncio.to_thread(_scan_local_library_impl, root_path)
        return {"success": True, "root_path": root_path, **summary}
    except Exception as e:
        logger.exception("Failed to scan local library")
        raise HTTPException(status_code=500, detail=str(e))
