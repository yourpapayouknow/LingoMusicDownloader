# 扫描本地音乐库或列出下载历史
from backend.head import argparse, json
from backend.core.config import settings
from backend.db.database import gthstry
from backend.services.local_library import scnlcllb


# 注册library子命令参数
def adargs(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("action", choices=["scan", "list"], help="scan扫描下载目录，list列出历史")


# 本地库子命令入口
def run(args) -> int:
    if args.action == "scan":
        summary = scnlcllb(settings.outpth())
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    print(json.dumps(gthstry(), ensure_ascii=False, indent=2))
    return 0