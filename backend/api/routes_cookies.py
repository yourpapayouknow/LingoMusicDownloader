# 浏览器Cookies提取、DPAPI解密与Netscape文件持久化模块
from backend.head import (
    APIRouter, HTTPException, BaseModel, Optional, List, Dict, Any,
    os, time, json, sqlite3, tempfile, Path, re, base64, shutil, ctypes,
    logging, asyncio, AES
)
from backend.core.config import settings
from backend.services.downloader import manager
from backend.api.common import (
    COOKIE_SEARCH_DOMAIN_KEYWORDS, WEBKIT_EPOCH_DELTA_SECONDS,
    COOKIE_EXPORT_HEADER_LINES, COOKIE_DB_COPY_RETRY_ATTEMPTS,
    COOKIE_DB_COPY_RETRY_DELAY_SECONDS, COOKIE_INIT_RETRY_ATTEMPTS,
    COOKIE_INIT_RETRY_DELAY_SECONDS, APPLE_LOGIN_URL
)

# 日志记录器与路由器
logger = logging.getLogger(__name__)
router = APIRouter()


# 请求模型定义
class CookieRequest(BaseModel):
    content: str


class CookieLoginFinalizeRequest(BaseModel):
    profile_hint: Optional[str] = None
    started_at_ms: Optional[int] = None


# 判定是否属于Apple服务Cookie域名
def isaplckidmn(domain: str) -> bool:
    host = (domain or "").strip().lower()
    return any(keyword in host for keyword in COOKIE_SEARCH_DOMAIN_KEYWORDS)


# 将Chromium微秒时间戳转为Unix秒
def chrmexpsec(expires_utc: Any) -> int:
    try:
        expires = int(expires_utc)
    except Exception:
        return 0
    if expires <= 0:
        return 0
    return max(0, int(expires / 1_000_000) - WEBKIT_EPOCH_DELTA_SECONDS)


# 计算Cookie文本可读性评分
def scrcktxt(text: str) -> int:
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


# 解码Cookie原始二进制字节值
def dcdckval(raw: bytes) -> str:
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
            score = scrcktxt(decoded)
            if score > best_score:
                best_score = score
                best_text = decoded
    return best_text


# Windows DPAPI数据块结构体
class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", ctypes.c_ulong),
        ("pbData", ctypes.POINTER(ctypes.c_byte)),
    ]


# 调用Windows DPAPI解密保护数据
def dpapiunprt(encrypted: bytes) -> bytes:
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
        ctypes.c_ulong,
        ctypes.POINTER(_DataBlob),
    ]
    crypt32.CryptUnprotectData.restype = ctypes.c_long
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


# 读取Chromium主加密密钥
def ldchrmmstk(local_state_path: Path) -> Optional[bytes]:
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
        return dpapiunprt(encrypted_key)
    except Exception as e:
        logger.warning("Failed to load Chromium master key from %s: %s", local_state_path, e)
        return None


# 解密Chromium加密Cookie数值
def dcryptchrmck(raw_value: str, encrypted_value: bytes, master_key: Optional[bytes]) -> str:
    if raw_value:
        return raw_value
    if not encrypted_value:
        return ""

    prefix = encrypted_value[:3]
    if prefix in {b"v10", b"v11", b"v20"} and master_key and len(encrypted_value) > 31:
        try:
            nonce = encrypted_value[3:15]
            ciphertext = encrypted_value[15:-16]
            tag = encrypted_value[-16:]
            cipher = AES.new(master_key, AES.MODE_GCM, nonce=nonce)
            decrypted = cipher.decrypt_and_verify(ciphertext, tag)
            return dcdckval(decrypted)
        except Exception:
            pass

    try:
        return dcdckval(dpapiunprt(encrypted_value))
    except Exception:
        return ""


# 序列化为单条Netscape文本行
def tonetscapeln(cookie: Dict[str, Any]) -> str:
    domain = str(cookie.get("domain") or "").strip()
    include_subdomain = "TRUE" if domain.startswith(".") else "FALSE"
    path = str(cookie.get("path") or "/")
    secure = "TRUE" if bool(cookie.get("secure")) else "FALSE"
    expiry = str(int(cookie.get("expiry") or 0))
    name = str(cookie.get("name") or "")
    value = str(cookie.get("value") or "")
    return "\t".join([domain, include_subdomain, path, secure, expiry, name, value])


# 格式化完整Netscape Cookies文本
def srlnckies(cookies: List[Dict[str, Any]]) -> str:
    lines = list(COOKIE_EXPORT_HEADER_LINES)
    lines.extend(tonetscapeln(item) for item in cookies)
    lines.append("")
    return "\n".join(lines)


# 查找Cookie数据库对应的Local State文件
def fndlcsttpth(cookie_db_path: Path) -> Optional[Path]:
    parents = [cookie_db_path.parent, *cookie_db_path.parents]
    for parent in parents:
        candidate = parent / "Local State"
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


# 带重试复制Cookie数据库及Wal文件
def cpcbdl(source_db_path: Path) -> Path:
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


# 查询数据库Cookie行记录
def qryckrows(cookie_db_path: Path, read_only_uri: bool = False) -> List[tuple]:
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


# 清理临时Cookie文件副本
def clntmpckbdl(temp_main_db_path: Path) -> None:
    try:
        temp_dir = temp_main_db_path.parent
        shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception:
        pass


# 检索Tauri WebView Cookie数据库候选路径
def fndtrckcnd(profile_hint: Optional[str], started_at_ms: Optional[int]) -> List[Path]:
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


# 从数据库读取并解密Apple服务Cookies
def rdaplcksdb(cookie_db_path: Path) -> List[Dict[str, Any]]:
    local_state_path = fndlcsttpth(cookie_db_path)
    master_key = ldchrmmstk(local_state_path) if local_state_path else None

    rows: List[tuple]
    temp_main_db_path: Optional[Path] = None
    try:
        temp_main_db_path = cpcbdl(cookie_db_path)
        rows = qryckrows(temp_main_db_path, read_only_uri=False)
    except Exception as copy_error:
        logger.warning(
            "Copy cookie DB failed, fallback to direct read-only open: %s | %s",
            cookie_db_path,
            copy_error,
        )
        try:
            rows = qryckrows(cookie_db_path, read_only_uri=True)
        except Exception as direct_error:
            raise RuntimeError(
                f"Failed to read cookie DB ({cookie_db_path}): copy_error={copy_error}; direct_error={direct_error}"
            ) from direct_error
    finally:
        if temp_main_db_path:
            clntmpckbdl(temp_main_db_path)

    cookies: List[Dict[str, Any]] = []
    for row in rows:
        host_key = str(row[0] or "")
        if not isaplckidmn(host_key):
            continue
        name = str(row[1] or "")
        value = dcryptchrmck(str(row[2] or ""), row[3] or b"", master_key)
        if not name or not value:
            continue
        cookies.append(
            {
                "domain": host_key,
                "name": name,
                "value": value,
                "path": str(row[4] or "/"),
                "expiry": chrmexpsec(row[5]),
                "secure": bool(row[6]),
            }
        )

    dedup: Dict[str, Dict[str, Any]] = {}
    for item in cookies:
        key = f"{item['domain']}\t{item['path']}\t{item['name']}"
        dedup[key] = item
    return list(dedup.values())


# 从WebView导出或检测Apple登录Cookies
def exptaplcks(
    profile_hint: Optional[str],
    started_at_ms: Optional[int],
    write_to_file: bool = True,
) -> Dict[str, Any]:
    candidates = fndtrckcnd(profile_hint=profile_hint, started_at_ms=started_at_ms)
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
            cookies = rdaplcksdb(db_path)
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
        content = srlnckies(all_cookies)
        Path(settings.ckspth()).write_text(content, encoding="utf-8")

    return {
        "success": True,
        "message": "Cookies 已导出。" if write_to_file else "Cookies 检测完成。",
        "cookies_count": len(all_cookies),
        "has_media_user_token": has_token,
        "source_db": str(selected_db) if selected_db else "",
    }


# 带短重试的下载核心初始化
async def intmngrrtr(
    attempts: int = COOKIE_INIT_RETRY_ATTEMPTS,
    delay_seconds: float = COOKIE_INIT_RETRY_DELAY_SECONDS,
) -> bool:
    for index in range(max(1, attempts)):
        ok = await manager.initialize()
        if ok:
            return True
        if index < attempts - 1:
            await asyncio.sleep(delay_seconds)
    return False


# 保存手动输入的Netscape Cookies端点
@router.post("/cookies")
async def svcksrtr(request: CookieRequest):
    try:
        with open(settings.ckspth(), "w", encoding="utf-8") as f:
            f.write(request.content.strip())
        success = await intmngrrtr()
        if not success:
            return {"success": False, "message": "Cookies saved, but downloader initialization failed."}
        return {"success": True, "message": "Cookies saved and downloader initialized successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save cookies: {str(e)}")


# 探测WebView登录Cookie就绪状态端点
@router.post("/cookie-login/probe")
async def prbcklgn(request: CookieLoginFinalizeRequest):
    try:
        probe_result = await asyncio.to_thread(
            exptaplcks,
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


# 完成WebView登录并导出Cookies端点
@router.post("/cookie-login/finalize")
async def fnlcklgn(request: CookieLoginFinalizeRequest):
    try:
        export_result = await asyncio.to_thread(
            exptaplcks,
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

    initialized = await intmngrrtr()
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


# 兼容性别名
save_cookies = svcksrtr
probe_cookie_login = prbcklgn
finalize_cookie_login = fnlcklgn
_initialize_manager_with_retry = intmngrrtr
_export_apple_music_cookies_from_webview = exptaplcks
