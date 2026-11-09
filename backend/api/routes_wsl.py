# WSL2环境预检、自动化安装与运行状态管理模块
from backend.head import (
    APIRouter, HTTPException, BaseModel, Optional, List, Dict, Any,
    asyncio, os, time, json, subprocess, tempfile, threading, Path, re, logging
)
from backend.api.common import (
    WSL2_REQUIRED_FREE_GB, WSL2_D_INSTALL_PATH, WSL2_UBUNTU_DISTRO,
    pssqt, wslstcpy, wslstset, wslstlog, isadmin, gtfrgb, rncptr, _wsl2_install_state_lock
)

# 日志记录器与路由器
logger = logging.getLogger(__name__)
router = APIRouter()


# 请求模型定义
class Wsl2InstallStartRequest(BaseModel):
    required_gb: Optional[float] = WSL2_REQUIRED_FREE_GB


# 查询Windows可选功能启用状态
def qryfeatst(feat_name: str) -> str:
    cmd = [
        "pwsh",
        "-NoProfile",
        "-Command",
        f"(Get-WindowsOptionalFeature -Online -FeatureName {feat_name}).State",
    ]
    rc, text = rncptr(cmd, tmout=25)
    if rc != 0:
        return ""
    return (text or "").strip()


# 判断功能特性是否处于开启状态
def isfeatenbld(state_text: str) -> bool:
    text = (state_text or "").strip().lower()
    if not text:
        return False
    return ("enabled" in text) or ("已启用" in text) or ("启用" == text)


# 检测系统是否已安装配置WSL2
def dtctwsl() -> tuple[bool, str]:
    if os.name != "nt":
        return False, "当前系统非Windows。"

    rc_status, status_text = rncptr(["wsl", "--status"], tmout=20)
    status_lower = (status_text or "").lower()
    if rc_status == 0:
        if re.search(r"(default\s*version|默认版本)\s*[:：]\s*2", status_text, flags=re.IGNORECASE):
            return True, "检测到WSL默认版本为2。"
        if "kernel" in status_lower or "内核" in status_text:
            return True, "检测到WSL状态可用。"

    rc_list, list_text = rncptr(["wsl", "-l", "-v"], tmout=25)
    if rc_list == 0:
        for line in (list_text or "").splitlines():
            norm = line.strip().lstrip("*").strip()
            if not norm:
                continue
            if re.search(r"\b2\b", norm):
                return True, "检测到已安装的WSL2发行版。"

    feat_wsl = qryfeatst("Microsoft-Windows-Subsystem-Linux")
    feat_vm = qryfeatst("VirtualMachinePlatform")
    if isfeatenbld(feat_wsl) and isfeatenbld(feat_vm):
        return True, "检测到WSL与VirtualMachinePlatform特性已启用。"

    return False, "未检测到可用的WSL2安装。"


# 构建WSL2预检与磁盘空间检测信息
def bldwslprchk(required_gb: float = WSL2_REQUIRED_FREE_GB) -> Dict[str, Any]:
    required = max(1.0, float(required_gb or WSL2_REQUIRED_FREE_GB))
    already_installed, install_hint = dtctwsl()
    d_exists = os.path.exists("D:\\")
    d_free = gtfrgb("D")
    c_free = gtfrgb("C")

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
            "is_admin": isadmin(),
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
        "is_admin": isadmin(),
    }


# 带实时日志捕获的命令行执行器
def rncmdlog(command: List[str], tmout_sec: int = 3600) -> int:
    creation_flags = int(getattr(subprocess, "CREATE_NO_WINDOW", 0)) if os.name == "nt" else 0
    wslstlog("执行命令: " + " ".join(command))
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
                wslstlog(line.rstrip())
            elif process.poll() is not None:
                break
            if tmout_sec and (time.time() - start_ts) > tmout_sec:
                process.kill()
                wslstlog("命令执行超时，已终止。")
                return -1
    finally:
        if process.stdout:
            try:
                process.stdout.close()
            except Exception:
                pass
    return process.wait()


# 获取已安装WSL发行版列表
def lstwsldstr() -> List[str]:
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


# 检查是否存在Ubuntu发行版
def hasubnt() -> bool:
    distros = lstwsldstr()
    target = WSL2_UBUNTU_DISTRO.lower()
    return any(target in distro.lower() for distro in distros)


# 标记WSL安装失败状态
def mrkwslfld(msg: str) -> None:
    wslstlog(msg)
    wslstset(
        status="error",
        stage="failed",
        running=False,
        completed=True,
        success_flag=False,
        message=msg,
    )


# 生成提权安装批处理PowerShell脚本
def bldwslscrpt(
    script_path: Path,
    log_path: Path,
    status_path: Path,
    precheck: Dict[str, Any],
) -> None:
    log_literal = pssqt(str(log_path))
    status_literal = pssqt(str(status_path))
    target_literal = pssqt(str(precheck.get("target_path") or ""))
    distro_literal = pssqt(WSL2_UBUNTU_DISTRO)
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


# 启动UAC提权安装后台进程
def trylnchelv(script_path: Path) -> tuple[bool, str]:
    arg_str = f'-NoProfile -ExecutionPolicy Bypass -File "{script_path}"'
    ps_cmd = (
        "Start-Process -FilePath 'pwsh.exe' "
        f"-Verb RunAs -WindowStyle Hidden -ArgumentList { pssqt(arg_str) }"
    )
    try:
        result = subprocess.run(
            ["pwsh", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
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


# 读取执行日志增量
def rdlogincre(log_path: Path, offset: int) -> tuple[int, List[str]]:
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


# 监控执行提权安装流程
def rnelvwslinst(precheck: Dict[str, Any]) -> bool:
    runtime_dir = Path(tempfile.gettempdir()) / "lingomusic_wsl2_install"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    task_id = str(int(time.time() * 1000))
    script_path = runtime_dir / f"install_{task_id}.ps1"
    log_path = runtime_dir / f"install_{task_id}.log"
    status_path = runtime_dir / f"install_{task_id}.status.json"

    bldwslscrpt(script_path, log_path, status_path, precheck)
    wslstset(stage="request-elevation")
    wslstlog("正在请求管理员权限（UAC）...")
    ok, err_text = trylnchelv(script_path)
    if not ok:
        mrkwslfld("管理员提权失败或被取消。 " + (err_text or ""))
        return False

    wslstlog("已启动管理员安装进程，等待执行结果...")
    wslstset(stage="running-elevated")

    start_ts = time.time()
    last_offset = 0
    last_stage = ""
    while True:
        last_offset, new_lines = rdlogincre(log_path, last_offset)
        for line in new_lines:
            wslstlog(line)

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
                    wslstset(stage=stage)
                    last_stage = stage
                if message:
                    wslstset(message=message)

                if completed:
                    wslstset(
                        status="success" if success_flag else "error",
                        stage=stage or ("completed" if success_flag else "failed"),
                        running=False,
                        completed=True,
                        success_flag=success_flag,
                        message=message or ("WSL2与Ubuntu安装配置完成。" if success_flag else "安装失败"),
                    )
                    if success_flag:
                        wslstlog("管理员安装流程已完成。")
                    else:
                        wslstlog("管理员安装流程失败。")
                    return success_flag

        if (time.time() - start_ts) > 60 * 90:
            mrkwslfld("安装超时，请重试或手动安装WSL2。")
            return False

        time.sleep(1.0)


# WSL2安装后台工作线程任务
def wslinstwrkr(precheck: Dict[str, Any]) -> None:
    try:
        if os.name != "nt":
            mrkwslfld("当前系统非Windows，无法安装WSL2。")
            return

        wslstset(stage="precheck", running=True, completed=False, status="running")
        wslstlog("开始执行WSL2安装任务。")

        if bool(precheck.get("already_installed")):
            wslstset(
                status="success",
                stage="completed",
                running=False,
                completed=True,
                success_flag=True,
                message="检测到本机已安装WSL2，无需重复安装。",
            )
            wslstlog("检测到本机已安装WSL2，安装流程已跳过。")
            return

        if not isadmin():
            wslstlog("当前非管理员权限，将尝试发起UAC提权安装。")
            rnelvwslinst(precheck)
            return

        wslstset(stage="check-wsl")
        check_cmd = subprocess.run(
            ["wsl", "--status"],
            capture_output=True,
            text=True,
            timeout=20,
            encoding="utf-8",
            errors="replace",
        )
        if check_cmd.returncode != 0 and "WSL" not in (check_cmd.stdout + check_cmd.stderr):
            wslstlog("未检测到可用WSL命令，尝试继续执行安装。")
        else:
            wslstlog("已检测到WSL命令可用。")

        if hasubnt():
            wslstlog("检测到Ubuntu发行版已存在，跳过安装步骤。")
        else:
            wslstset(stage="install-ubuntu")
            install_candidates: List[List[str]] = []
            if precheck.get("use_custom_location"):
                target_path = str(precheck.get("target_path") or WSL2_D_INSTALL_PATH)
                try:
                    os.makedirs(target_path, exist_ok=True)
                except Exception as e:
                    wslstlog(f"创建安装目录失败，将继续安装: {e}")
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
                rc = rncmdlog(cmd, tmout_sec=5400)
                if rc == 0:
                    install_ok = True
                    break
                wslstlog(f"安装命令返回码 {rc}，尝试下一组参数。")

            if not install_ok:
                mrkwslfld("WSL2/Ubuntu 安装失败，请检查系统日志或手动执行 `wsl --install`。")
                return

            for _ in range(20):
                if hasubnt():
                    break
                time.sleep(1.2)
            if not hasubnt():
                mrkwslfld("安装完成后未检测到Ubuntu发行版，可能需要重启系统后重试。")
                return
            wslstlog("Ubuntu发行版安装完成。")

        wslstset(stage="configure-root")
        wslstlog("开始配置默认用户与密码（root/root）。")
        config_commands = [
            ["wsl", "-d", WSL2_UBUNTU_DISTRO, "-u", "root", "--", "bash", "-lc", "echo 'root:root' | chpasswd"],
            ["wsl", "-d", WSL2_UBUNTU_DISTRO, "-u", "root", "--", "bash", "-lc", "printf '[user]\\ndefault=root\\n' > /etc/wsl.conf"],
            ["wsl", "--shutdown"],
            ["wsl", "-d", WSL2_UBUNTU_DISTRO, "-u", "root", "--", "bash", "-lc", "id -un"],
        ]
        for cmd in config_commands:
            rc = rncmdlog(cmd, tmout_sec=180)
            if rc != 0:
                mrkwslfld("WSL2配置步骤失败，请确认Ubuntu可正常启动后重试。")
                return

        wslstset(stage="health-check")
        wslstlog("执行最终健康检查。")
        if not hasubnt():
            mrkwslfld("最终检查失败：未检测到Ubuntu发行版。")
            return

        wslstset(
            status="success",
            stage="completed",
            running=False,
            completed=True,
            success_flag=True,
            message="WSL2与Ubuntu安装配置完成。",
        )
        wslstlog("WSL2与Ubuntu安装配置完成。")
    except Exception as e:
        logger.exception("WSL2 install worker failed")
        mrkwslfld(f"安装流程异常：{e}")


# WSL2安装环境预检端点
@router.get("/wsl2/install/precheck")
async def wslprchkrtr():
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
    return await asyncio.to_thread(bldwslprchk, WSL2_REQUIRED_FREE_GB)


# 触发WSL2安装流程端点
@router.post("/wsl2/install/start")
async def strtwslrtr(request: Wsl2InstallStartRequest):
    if os.name != "nt":
        raise HTTPException(status_code=400, detail="Current OS does not support WSL2 installation.")

    required_gb = request.required_gb if request.required_gb is not None else WSL2_REQUIRED_FREE_GB
    precheck = await asyncio.to_thread(bldwslprchk, required_gb)
    if precheck.get("already_installed"):
        with _wsl2_install_state_lock:
            wslstset(
                status="success",
                stage="completed",
                running=False,
                completed=True,
                success_flag=True,
                message=precheck.get("message") or "检测到本机已安装WSL2，无需重复安装。",
                required_gb=precheck.get("required_gb", WSL2_REQUIRED_FREE_GB),
                selected_drive="",
                target_path="",
                use_custom_location=False,
                logs=[
                    f"[{time.strftime('%H:%M:%S')}] 检测到本机已安装WSL2，已直接判定完成。"
                ],
            )
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
        st = wslstcpy()
        if st.get("running"):
            return {
                "success": True,
                "status": "running",
                "message": "WSL2 安装任务已在进行中。",
                "target_path": st.get("target_path", ""),
                "selected_drive": st.get("selected_drive", ""),
            }

        wslstset(
            status="running",
            stage="queued",
            running=True,
            completed=False,
            success_flag=False,
            message="安装任务已启动。",
            required_gb=precheck.get("required_gb", WSL2_REQUIRED_FREE_GB),
            selected_drive=precheck.get("selected_drive", ""),
            target_path=precheck.get("target_path", ""),
            use_custom_location=precheck.get("use_custom_location", False),
            logs=[],
        )

    worker = threading.Thread(target=wslinstwrkr, args=(precheck,), daemon=True)
    worker.start()

    return {
        "success": True,
        "status": "running",
        "message": "WSL2 安装任务已启动。",
        "target_path": precheck.get("target_path", ""),
        "selected_drive": precheck.get("selected_drive", ""),
    }


# 获取WSL2安装进度与日志端点
@router.get("/wsl2/install/status")
async def gtwslsttsrtr():
    state = wslstcpy()
    return {"success": True, **state}


# 兼容性别名
wsl2_install_precheck = wslprchkrtr
start_wsl2_install = strtwslrtr
get_wsl2_install_status = gtwslsttsrtr
_detect_wsl2_installed = dtctwsl
_build_wsl2_precheck = bldwslprchk
_wsl2_install_worker = wslinstwrkr
