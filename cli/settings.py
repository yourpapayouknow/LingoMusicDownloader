# 读取或写入本地客户端设置
from backend.head import argparse, json, sys
from backend.db.database import gtallstngs, svstngs


# 注册settings子命令参数
def adargs(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("action", choices=["get", "set"], help="get读取全部设置，set写入单项")
    parser.add_argument("--key", default=None, help="设置键，例如lingomusic-codec")
    parser.add_argument("--value", default=None, help="设置值；能解析为JSON时按JSON写入")


# 解析设置值文本
def prsval(raw: str):
    try:
        return json.loads(raw)
    except Exception:
        return raw


# 设置子命令入口
def run(args) -> int:
    if args.action == "get":
        print(json.dumps(gtallstngs(), ensure_ascii=False, indent=2))
        return 0
    if not args.key or not args.key.startswith("lingomusic-"):
        print("写入设置时必须提供以lingomusic-开头的--key", file=sys.stderr)
        return 1
    if args.value is None:
        print("写入设置时必须提供--value", file=sys.stderr)
        return 1
    svstngs({args.key: prsval(args.value)})
    print(json.dumps({"success": True, "key": args.key}, ensure_ascii=False))
    return 0