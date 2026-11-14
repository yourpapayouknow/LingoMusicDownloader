# 检查、启动并跟踪Wrapper登录流程
from backend.head import argparse, getpass, json, sys, time
from backend.api.routes_wrapper import (
    bldwrprprchk, strtwrprwrkr, wrprstcpy, sndwrprint
)


# 注册wrapper子命令参数
def adargs(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("action", choices=["precheck", "start", "status"], help="执行动作")
    parser.add_argument("--force", action="store_true", help="强制重启Wrapper")
    parser.add_argument("--timeout", type=int, default=300, help="等待超时秒数")


# 请求交互输入并提交到Wrapper标准输入
def _askinp(state: dict) -> bool:
    input_type = str(state.get("input_type") or "")
    if input_type == "credentials":
        apple_id = input("Apple ID: ").strip()
        password = getpass.getpass("Password: ").strip()
        if not apple_id or not password:
            return False
        return sndwrprint([apple_id, password])[0]
    if input_type == "2fa":
        code = input("2FA Code: ").strip()
        return bool(code) and sndwrprint([code])[0]
    return False


# 轮询Wrapper状态直到完成或需要输入
def _poll(timeout: int) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        state = wrprstcpy()
        if state.get("awaiting_input"):
            _askinp(state)
            time.sleep(1)
            continue
        if state.get("completed"):
            return state
        time.sleep(1)
    state = wrprstcpy()
    state["timeout"] = True
    return state


# Wrapper子命令入口
def run(args) -> int:
    if args.action == "precheck":
        print(json.dumps(bldwrprprchk(), ensure_ascii=False, indent=2))
        return 0
    if args.action == "status":
        print(json.dumps(wrprstcpy(), ensure_ascii=False, indent=2))
        return 0

    started = strtwrprwrkr(
        launch_new=True,
        force_restart=args.force,
        reset_logs=True,
        message="命令行启动Wrapper流程。",
    )
    if not started:
        print("Wrapper任务已在进行中。", file=sys.stderr)
    state = _poll(max(30, args.timeout))
    print(json.dumps(state, ensure_ascii=False, indent=2))
    return 0 if state.get("completed") and state.get("success_flag") else 1