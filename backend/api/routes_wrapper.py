# Wrapper服务部署、解压、进程生命周期与交互认证管理模块
from backend.head import (
    APIRouter, HTTPException, BaseModel, Optional, List, Dict, Any,
    os, time, subprocess, threading, Path, re, shlex, shutil, urllib, zipfile, logging
)
from backend.core.config import settings
from backend.api.common import (
    WRAPPER_DECRYPT_PORT, WRAPPER_M3U8_PORT, WRAPPER_ACCOUNT_PORT,
    WRAPPER_PORT_CHECK_TIMEOUT_SECONDS, WRAPPER_RELEASE_ZIP_URL,
    WRAPPER_SETUP_TIMEOUT_SECONDS, WRAPPER_STARTUP_GRACE_SECONDS,
    WRAPPER_SESSION_DB_RELATIVE_PATH,
    chkprt, rncptr, wrprstcpy, wrprstset, wrprstlog, setwrprprc, gtwrprprc,
    _wrapper_setup_state_lock, _wrapper_process_lock
)
from backend.api.routes_wsl import dtctwsl

# 日志记录器与路由器
logger = logging.getLogger(__name__)
router = APIRouter()

# 内部状态变量
_wrapper_last_output: str = ""
_wrapper_cached_credentials: Optional[tuple[str, str]] = None
_wrapper_reader_thread: Optional[threading.Thread] = None


# 请求模型定义
class WrapperSetupStartRequest(BaseModel):
    force_restart: Optional[bool] = False


class WrapperSetupInputRequest(BaseModel):
    input_type: str = "credentials"
    apple_id: Optional[str] = None
    password: Optional[str] = None
    code: Optional[str] = None


# 解析Wrapper运行目录绝对路径
def rslvwrprdir() -> Path:
    candidates = [
        Path(settings.bsdir()) / "backend" / "wsl_wrapper",
        Path(settings.bsdir()) / "wsl_wrapper",
        Path(__file__).resolve().parents[1] / "wsl_wrapper",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


# 解析Wrapper二进制可执行文件路径
def rslvwrprbin() -> Path:
    return rslvwrprdir() / "wrapper"


# 解析Wrapper账户凭证数据库路径
def rslvwrprdb() -> Path:
    return rslvwrprdir() / WRAPPER_SESSION_DB_RELATIVE_PATH


# 将Windows路径转换为WSL挂载路径
def wntowslpth(path_obj: Path) -> str:
    path_str = str(path_obj.resolve())
    drive, tail = os.path.splitdrive(path_str)
    if not drive:
        raise RuntimeError(f"无法将路径转换为WSL路径: {path_str}")
    drive_letter = drive[0].lower()
    tail = tail.replace("\\", "/").lstrip("/")
    return f"/mnt/{drive_letter}/{tail}"


# 检查Wrapper可执行文件是否已就绪
def iswrprinst() -> bool:
    wrapper_binary = rslvwrprbin()
    return wrapper_binary.exists() and wrapper_binary.is_file() and wrapper_binary.stat().st_size > 0


# 检查Wrapper核心端口是否处于监听状态
def iswrprrun() -> bool:
    return (
        chkprt("127.0.0.1", WRAPPER_DECRYPT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
        and chkprt("127.0.0.1", WRAPPER_M3U8_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
        and chkprt("127.0.0.1", WRAPPER_ACCOUNT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
    )


# 停止当前运行的Wrapper服务与外部WSL进程
def stpwrprsrv() -> None:
    process = gtwrprprc()
    if process and process.poll() is None:
        try:
            process.terminate()
            process.wait(timeout=5)
            wrprstlog("已终止当前Wrapper进程。")
        except Exception:
            try:
                process.kill()
                wrprstlog("已强制结束当前Wrapper进程。")
            except Exception:
                pass
    setwrprprc(None)

    rncptr(
        ["wsl", "-e", "bash", "-lc", "pkill -f '/wrapper' >/dev/null 2>&1 || true"],
        tmout=20,
    )
    rncptr(
        ["wsl", "-e", "bash", "-lc", "pkill -f 'wrapper -H 0.0.0.0' >/dev/null 2>&1 || true"],
        tmout=20,
    )

    for _ in range(20):
        if not (
            chkprt("127.0.0.1", WRAPPER_DECRYPT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
            or chkprt("127.0.0.1", WRAPPER_M3U8_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
            or chkprt("127.0.0.1", WRAPPER_ACCOUNT_PORT, WRAPPER_PORT_CHECK_TIMEOUT_SECONDS)
        ):
            break
        time.sleep(0.3)


# 标记Wrapper流程失败状态
def mrkwrprfld(msg: str) -> None:
    wrprstlog(msg)
    wrprstset(
        status="error",
        stage="failed",
        running=False,
        completed=True,
        success_flag=False,
        awaiting_input=False,
        input_type="",
        input_prompt="",
        wrapper_running=iswrprrun(),
        message=msg,
    )


# 标记Wrapper流程成功就绪状态
def mrkwrprscc(msg: str) -> None:
    wrprstlog(msg)
    wrprstset(
        status="success",
        stage="completed",
        running=False,
        completed=True,
        success_flag=True,
        awaiting_input=False,
        input_type="",
        input_prompt="",
        wrapper_running=True,
        message=msg,
    )


# 请求前端提供交互输入
def rqstwrprint(input_type: str, prompt: str) -> None:
    state = wrprstcpy()
    if state.get("awaiting_input") and state.get("input_type") == input_type:
        return

    wrprstlog(prompt)
    wrprstset(
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


# 探测终端输出文本中期待的输入类型
def dtctprmptyp(text: str) -> Optional[str]:
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


# 处理Wrapper实时输出文本片段
def hndlwrprout(text: str) -> None:
    global _wrapper_last_output
    cleaned = (text or "").strip()
    if not cleaned:
        return

    _wrapper_last_output = cleaned
    wrprstlog(cleaned)

    prompt_type = dtctprmptyp(cleaned)
    if prompt_type == "2fa":
        rqstwrprint("2fa", "检测到Wrapper需要2FA验证码，请输入验证码后继续。")
    elif prompt_type == "credentials":
        rqstwrprint("credentials", "检测到Wrapper等待Apple ID与密码，请输入后继续。")


# 异步读取Wrapper进程输出日志流
def wrproutrdr(process: subprocess.Popen) -> None:
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
                    hndlwrprout(line)

            tail = carry[-220:]
            prompt_type = dtctprmptyp(tail)
            if prompt_type == "2fa":
                rqstwrprint("2fa", "检测到Wrapper需要2FA验证码，请输入验证码后继续。")
            elif prompt_type == "credentials":
                rqstwrprint("credentials", "检测到Wrapper等待Apple ID与密码，请输入后继续。")
    except Exception as e:
        wrprstlog(f"读取Wrapper输出流异常: {e}")
    finally:
        if carry.strip():
            hndlwrprout(carry)


# 启动Wrapper输出流监控线程
def strtwrprrdr(process: subprocess.Popen) -> None:
    global _wrapper_reader_thread
    thread = threading.Thread(target=wrproutrdr, args=(process,), daemon=True)
    _wrapper_reader_thread = thread
    thread.start()


# 确保Wrapper程序已下载并具有执行权限
def ensrwrprinst() -> tuple[bool, str]:
    wrapper_dir = rslvwrprdir()
    wrapper_binary = rslvwrprbin()
    wrapper_dir.mkdir(parents=True, exist_ok=True)

    if not iswrprinst():
        wrprstset(stage="download-wrapper", message="正在下载Wrapper组件...")
        wrprstlog("未检测到本地Wrapper，开始下载。")
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

        wrprstlog("Wrapper下载完成。")
    else:
        wrprstlog("检测到本地Wrapper已存在，跳过下载。")

    try:
        wrapper_binary_wsl = wntowslpth(wrapper_binary)
    except Exception as e:
        return False, f"Wrapper路径转换失败: {e}"

    chmod_cmd = f"chmod +x {shlex.quote(wrapper_binary_wsl)}"
    rc, output = rncptr(["wsl", "-e", "bash", "-lc", chmod_cmd], tmout=20)
    if rc != 0:
        reason = (output or "").strip()
        return False, f"设置Wrapper执行权限失败: {reason}"
    wrprstlog("Wrapper执行权限已就绪。")
    return True, ""


# 启动Wrapper服务子进程
def lnchwrprprc(use_cached_credentials: bool = False) -> tuple[Optional[subprocess.Popen], str]:
    wrapper_dir = rslvwrprdir()
    wrapper_binary = rslvwrprbin()
    if not wrapper_binary.exists():
        return None, "Wrapper可执行文件不存在。"

    try:
        wrapper_dir_wsl = wntowslpth(wrapper_dir)
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
    wrprstlog(f"启动命令: ./wrapper{log_login_part} -H 0.0.0.0")

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

    setwrprprc(process)
    strtwrprrdr(process)
    return process, ""


# 等待Wrapper服务端口就绪或捕获等待输入状态
def wtwrprrdy(timeout_seconds: int) -> str:
    start_ts = time.time()
    prompt_seen_at: Optional[float] = None
    while True:
        state = wrprstcpy()

        if iswrprrun():
            mrkwrprscc("Wrapper正在运行。")
            return "running"

        if state.get("awaiting_input"):
            if prompt_seen_at is None:
                prompt_seen_at = time.time()
            if (time.time() - prompt_seen_at) >= 8.0:
                return "awaiting_input"
        else:
            prompt_seen_at = None

        process = gtwrprprc()
        if process is None:
            mrkwrprfld("Wrapper进程未启动。")
            return "error"

        return_code = process.poll()
        if return_code is not None:
            if iswrprrun():
                mrkwrprscc("Wrapper正在运行。")
                return "running"

            state_now = wrprstcpy()
            if state_now.get("awaiting_input"):
                return "awaiting_input"

            detail = _wrapper_last_output.strip()
            message = f"Wrapper进程已退出（退出码 {return_code}）。"
            if detail:
                message += f" 最近输出：{detail}"
            mrkwrprfld(message)
            return "error"

        if (time.time() - start_ts) > timeout_seconds:
            mrkwrprfld("等待Wrapper启动超时，请查看日志并重试。")
            return "error"

        time.sleep(0.6)


# 构建Wrapper环境预检状态概览
def bldwrprprchk() -> Dict[str, Any]:
    wsl2_installed, wsl_hint = dtctwsl()
    wrapper_installed = iswrprinst()
    wrapper_running = iswrprrun()
    session_db_exists = rslvwrprdb().exists()

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


# Wrapper启动与监控后台执行线程
def wrprmntrwrkr(
    launch_new: bool,
    use_cached_credentials: bool = False,
    force_restart: bool = False,
) -> None:
    try:
        wrprstset(
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
        wrprstlog("开始执行Wrapper安装/启动流程。")

        wsl2_installed, _wsl_hint = dtctwsl()
        if not wsl2_installed:
            mrkwrprfld("请先安装WSL2。")
            return
        wrprstset(wsl2_installed=True)

        if force_restart:
            wrprstset(stage="restart-wrapper", message="检测到初始化请求，正在重启Wrapper服务...")
            wrprstlog("检测到初始化请求：即使Wrapper已运行也将强制重启。")
            stpwrprsrv()

        if iswrprrun():
            mrkwrprscc("Wrapper正在运行。")
            return

        if not iswrprinst():
            ok, install_error = ensrwrprinst()
            if not ok:
                mrkwrprfld(install_error or "下载Wrapper失败。")
                return
        wrprstset(wrapper_installed=iswrprinst())

        if iswrprrun():
            mrkwrprscc("Wrapper正在运行。")
            return

        process: Optional[subprocess.Popen] = None
        if launch_new:
            wrprstset(stage="start-wrapper", message="正在启动Wrapper服务...")
            process, launch_error = lnchwrprprc(use_cached_credentials=use_cached_credentials)
            if not process:
                mrkwrprfld(launch_error or "启动Wrapper服务失败。")
                return
        else:
            process = gtwrprprc()
            if process is None or process.poll() is not None:
                if use_cached_credentials and _wrapper_cached_credentials:
                    wrprstset(stage="restart-wrapper", message="正在使用已提交账号重启Wrapper...")
                    process, launch_error = lnchwrprprc(use_cached_credentials=True)
                    if not process:
                        mrkwrprfld(launch_error or "重启Wrapper服务失败。")
                        return
                else:
                    rqstwrprint("credentials", "Wrapper需要登录，请输入Apple ID与密码。")
                    return

        timeout_seconds = WRAPPER_SETUP_TIMEOUT_SECONDS if launch_new else WRAPPER_STARTUP_GRACE_SECONDS
        outcome = wtwrprrdy(timeout_seconds=timeout_seconds)
        if outcome == "awaiting_input":
            wrprstset(
                running=False,
                completed=False,
                success_flag=False,
                wrapper_running=False,
                wrapper_installed=iswrprinst(),
                wsl2_installed=True,
            )
            return
        return
    except Exception as e:
        logger.exception("Wrapper setup worker failed")
        mrkwrprfld(f"Wrapper流程异常：{e}")


# 触发Wrapper守护线程
def strtwrprwrkr(
    *,
    launch_new: bool,
    use_cached_credentials: bool = False,
    force_restart: bool = False,
    reset_logs: bool = False,
) -> bool:
    with _wrapper_setup_state_lock:
        st = wrprstcpy()
        if st.get("running"):
            return False
        if reset_logs:
            _wrapper_setup_state_lock.acquire()
            try:
                pass
            finally:
                _wrapper_setup_state_lock.release()
        wrprstset(
            status="running",
            stage="queued",
            running=True,
            completed=False,
            success_flag=False,
            awaiting_input=False,
            input_type="",
            input_prompt="",
            message="任务已启动。",
            logs=[] if reset_logs else st.get("logs", []),
        )

    worker = threading.Thread(
        target=wrprmntrwrkr,
        kwargs={
            "launch_new": launch_new,
            "use_cached_credentials": use_cached_credentials,
            "force_restart": force_restart,
        },
        daemon=True,
    )
    worker.start()
    return True


# 向Wrapper标准输入流写入字符串
def sndwrprint(lines: List[str]) -> tuple[bool, str]:
    process = gtwrprprc()
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


# Wrapper部署环境预检端点
@router.get("/wrapper/setup/precheck")
async def wrapper_setup_precheck():
    return bldwrprprchk()


# 启动Wrapper部署与初始化流程端点
@router.post("/wrapper/setup/start")
async def start_wrapper_setup(request: WrapperSetupStartRequest):
    precheck = bldwrprprchk()

    if not precheck.get("can_start"):
        wrprstset(
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

    current_state = wrprstcpy()
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
        setwrprprc(None)

    started = strtwrprwrkr(
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


# 获取Wrapper部署与认证进度端点
@router.get("/wrapper/setup/status")
async def get_wrapper_setup_status():
    state = wrprstcpy()
    if iswrprrun() and state.get("status") != "success":
        wrprstset(
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
        state = wrprstcpy()
    state["wsl2_installed"] = bool(state.get("wsl2_installed"))
    state["wrapper_installed"] = iswrprinst()
    state["wrapper_running"] = iswrprrun()
    return {"success": True, **state}


# 提交Wrapper交互凭证或验证码端点
@router.post("/wrapper/setup/input")
async def submit_wrapper_setup_input(request: WrapperSetupInputRequest):
    state = wrprstcpy()
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

        sent, err = sndwrprint([apple_id, password])
        if sent:
            wrprstlog("已提交Apple ID与密码，等待2FA或服务启动。")
            wrprstset(
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
            strtwrprwrkr(
                launch_new=False,
                use_cached_credentials=True,
                reset_logs=False,
            )
            return {"success": True, "status": "running", "message": "账号密码已提交。"}

        wrprstlog(f"当前进程不接受输入，将重启Wrapper继续登录。原因: {err}")
        wrprstset(
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
        strtwrprwrkr(
            launch_new=True,
            use_cached_credentials=True,
            reset_logs=False,
        )
        return {"success": True, "status": "running", "message": "正在重启Wrapper并继续登录。"}

    if input_type == "2fa":
        code = (request.code or "").strip()
        if not code:
            return {"success": False, "status": "error", "message": "请输入2FA验证码。"}

        sent, err = sndwrprint([code])
        if not sent:
            return {"success": False, "status": "error", "message": err or "提交2FA验证码失败。"}

        wrprstlog("已提交2FA验证码，等待Wrapper完成启动。")
        wrprstset(
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
        strtwrprwrkr(
            launch_new=False,
            use_cached_credentials=True,
            reset_logs=False,
        )
        return {"success": True, "status": "running", "message": "2FA验证码已提交。"}

    return {"success": False, "status": "error", "message": "未知的输入类型。"}


# 兼容性别名
_is_wrapper_installed = iswrprinst
_is_wrapper_running = iswrprrun
_build_wrapper_precheck = bldwrprprchk
_stop_wrapper_service = stpwrprsrv
_ensure_wrapper_installed = ensrwrprinst
