# 核心功能命令行入口与子命令分发
from backend.head import argparse
from . import serve, search, download, settings, library, wrapper, wsl

# 子命令模块注册表
COMMANDS = {
    "serve": serve,
    "search": search,
    "download": download,
    "settings": settings,
    "library": library,
    "wrapper": wrapper,
    "wsl": wsl,
}


# 构建命令行解析器
def bldprsr() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lingo-cli",
        description="LingoMusicDownloader 核心功能命令行入口",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name, module in COMMANDS.items():
        sub = subparsers.add_parser(name, help=module.__doc__ or name)
        module.adargs(sub)
        sub.set_defaults(handler=module.run)
    return parser


# 分发并执行子命令
def runcmd(args) -> int:
    return int(args.handler(args) or 0)


# 命令行主入口
def main() -> int:
    parser = bldprsr()
    args = parser.parse_args()
    return runcmd(args)