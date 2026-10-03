# 终端独立运行的WSL与Wrapper向导部署实用工具
from backend.head import subprocess, getpass
from backend.api.routes_wsl import dtctwsl
from backend.api.routes_wrapper import (
    rslvwrprdir, rslvwrprdb, wntowslpth, ensrwrprinst
)


# 检查WSL是否已安装并且可在系统中调用
def chkwslinst() -> bool:
    installed, _ = dtctwsl()
    return installed


# 打印引导用户安装WSL2的提示说明
def prmptinstwsl() -> None:
    print()
    print("=" * 60)
    print("  ERROR: WSL2 is not installed on this system.")
    print("=" * 60)
    print()
    print("  WSL2 is required to run the Apple Music Wrapper.")
    print("  Please install it by following these steps:")
    print()
    print("  1. Open PowerShell as Administrator.")
    print("  2. Run:  wsl --install")
    print("  3. Restart your computer when prompted.")
    print("  4. Run this script again after restarting.")
    print()
    input("  Press Enter to exit...")


# 交互式引导下载并配置WSL Wrapper
def stwrprwsl() -> None:
    if not chkwslinst():
        prmptinstwsl()
        return

    print("[OK] WSL is available.")
    wrapper_dir = rslvwrprdir()
    session_db = rslvwrprdb()
    wsl_path = wntowslpth(wrapper_dir)

    ok, err = ensrwrprinst()
    if not ok:
        print(f"[ERROR] Failed to prepare wrapper: {err}")
        return

    print()
    print("=" * 60)
    print("  Apple ID Authentication")
    print("=" * 60)
    print("  Enter your Apple ID credentials to authenticate the Wrapper.")
    print("  These are sent directly to the local Wrapper process only.")
    print()

    apple_id = input("  Apple ID (email): ").strip()
    if not apple_id:
        print("[CANCELLED] No Apple ID provided. Setup incomplete.")
        return

    password = getpass.getpass("  Password: ").strip()
    if not password:
        print("[CANCELLED] No password provided. Setup incomplete.")
        return

    print()
    print("Authenticating with Apple Music (this may take a few moments)...")
    login_arg = f"{apple_id}:{password}"
    cmd = f"cd '{wsl_path}' && ./wrapper -L '{login_arg}'"

    try:
        proc = subprocess.Popen(
            ["wsl", "-e", "bash", "-c", cmd],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
            if line:
                stripped = line.strip()
                print(f"  [wrapper] {stripped}")
                if "2FA" in stripped or "verification" in stripped.lower() or "code" in stripped.lower():
                    code = input("  Enter 2FA Code: ").strip()
                    proc.stdin.write(f"{code}\n")
                    proc.stdin.flush()

        proc.wait()
    except Exception as e:
        print(f"[ERROR] Failed to run wrapper: {e}")
        return

    if session_db.exists():
        print()
        print("=" * 60)
        print("  [SUCCESS] Apple Music Wrapper is authenticated and ready!")
        print("=" * 60)
    else:
        print()
        print("[WARNING] Setup finished but session DB was not found.")
        print("  You may need to run this script again or check your credentials.")


# 兼容性别名
check_wsl_installed = chkwslinst
prompt_install_wsl = prmptinstwsl
setup_wsl_wrapper = stwrprwsl


# 命令行独立测试执行入口
if __name__ == "__main__":
    stwrprwsl()
