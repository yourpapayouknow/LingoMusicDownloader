# 搜索Apple Music音乐目录
from backend.head import argparse, asyncio, json, sys
from backend.services.downloader import manager
from backend.services.search import srchfast, nrmlsrchrst


# 注册search子命令参数
def adargs(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("term", help="搜索关键词")
    parser.add_argument("--limit", type=int, default=20, help="每类结果数量")


# 执行搜索并输出JSON
async def _srch(term: str, limit: int) -> dict:
    if not await manager.ensinit():
        raise RuntimeError("下载器初始化失败，请检查cookies.txt")
    payload = await srchfast(term, limit)
    return {"success": True, "results": nrmlsrchrst(payload)}


# 搜索子命令入口
def run(args) -> int:
    try:
        payload = asyncio.run(_srch(args.term, max(1, min(args.limit, 50))))
    except Exception as exc:
        print(f"搜索失败: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0