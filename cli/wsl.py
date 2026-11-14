# 检查或安装WSL2运行环境
from backend.head import argparse, json, threading, time
from backend.api.routes_wsl import bldwslprchk, wslinstwrkr, wslstcpy


# 注册wsl子命令参数
def adargs(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("action", choices=["precheck", "install", "status"], help="执行动作")
    parser.add_argument("--timeout", type=int, default=1800, help="等待超时秒数")


# 轮询WSL安装状态直到完成
def _poll(timeout: int) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        state = wslstcpy()
        if state.get("completed"):
            return state
        time.sleep(1)
    state = wslstcpy()
    state["timeout"] = True
    return state


# WSL子命令入口
def run(args) -> int:
    if args.action == "precheck":
        print(json.dumps(bldwslprchk(), ensure_ascii=False, indent=2))
        return 0
    if args.action == "status":
        print(json.dumps(wslstcpy(), ensure_ascii=False, indent=2))
        return 0

    precheck = bldwslprchk()
    if not precheck.get("can_install") and not precheck.get("already_installed"):
        print(json.dumps(precheck, ensure_ascii=False, indent=2))
        return 1
    worker = threading.Thread(target=wslinstwrkr, args=(precheck,), daemon=True)
    worker.start()
    state = _poll(max(60, args.timeout))
    print(json.dumps(state, ensure_ascii=False, indent=2))
    return 0 if state.get("completed") and state.get("success_flag") else 1