# 提交并跟踪单个下载任务
from backend.head import argparse, asyncio, json, sys, time
from backend.services.downloader import manager


# 注册download子命令参数
def adargs(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("url", help="Apple Music链接")
    parser.add_argument("--codec", default="aac-legacy", choices=["aac-legacy", "aac", "alac", "dolby"])
    parser.add_argument("--resolution", default="1080p", choices=["480p", "720p", "1080p", "2160p"])
    parser.add_argument("--wrapper", action="store_true", help="使用Wrapper高规格能力")
    parser.add_argument("--region", default=None, help="元数据地区，例如cn/us/jp")
    parser.add_argument("--timeout", type=int, default=900, help="等待超时秒数")


# 等待任务进入终态
async def _wait(url: str, timeout: int) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        state = manager.download_status.get(url) or {}
        if state.get("status") in {"completed", "error"}:
            return state
        await asyncio.sleep(1)
    return manager.download_status.get(url) or {"status": "timeout"}


# 提交任务并等待完成
async def _dl(args) -> dict:
    if not await manager.ensinit():
        raise RuntimeError("下载器初始化失败，请检查cookies.txt")
    added = await manager.adque(
        args.url,
        codec=args.codec,
        video_resolution=args.resolution,
        use_wrapper=args.wrapper,
        metadata_region=args.region,
    )
    if not added:
        raise RuntimeError("任务入队失败（可能URL在执行中或初始化未完成）")
    return await _wait(args.url, max(10, args.timeout))


# 下载子命令入口
def run(args) -> int:
    try:
        state = asyncio.run(_dl(args))
    except Exception as exc:
        print(f"下载失败: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(state, ensure_ascii=False, indent=2))
    return 0 if state.get("status") == "completed" else 1